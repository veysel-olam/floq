import type { FastifyInstance } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import { eq, and, or, desc, lt, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts, follows, apActivities, polls, pollOptions, pollVotes, customEmojis, postEdits, boosts, likes, reactions, reports } from '../db/schema.js'
import { env } from '../lib/env.js'
import {
  buildActor,
  buildNote,
  buildQuestion,
  buildCreate,
  buildFollow,
  buildAccept,
  buildUndo,
  buildUpdateQuestion,
  actorUrl,
  postUrl,
  AP_CONTEXT,
  AP_CONTENT_TYPE,
} from '../lib/activityPub.js'
import { verifySignature } from '../lib/httpSignatures.js'
import { deliverToFollowers, deliverToInbox, fetchRemoteActor, isSuspendedDomain, getInstanceActor, acceptRelayFollow } from '../lib/federation.js'
import { ingestRemoteNote, attachRemoteMediaAndPreview } from '../lib/ingest.js'
import { verifyObjectProof, issueVerifiableCredential } from '../lib/objectIntegrity.js'
import { didKeyFromMultibase } from '../lib/keys.js'
import { notifyFollow, notifyLike, notifyBoost, notifyReply } from '../lib/notify.js'
import { publish } from '../lib/pubsub.js'
import { enrichPosts } from '../lib/enrichPosts.js'
import { sql } from 'drizzle-orm'

// Verify HTTP Signature on AP GET requests (Authorized Fetch).
// Returns false and sends 401 if the request is unsigned or signature is invalid.
// Only enforced in production; skipped in development for local testing ease.
// Actor documents and public collections (actor, outbox, individual posts) are
// PUBLIC AP objects — like Mastodon's defaults. They must be servable to anyone,
// including a remote server's SIGNED actor-fetch while it verifies our Follow.
// Requiring/verifying a signature here ("authorized fetch" / secure mode) breaks
// the handshake (and crashed on instance actors), so these endpoints are public.
async function requireApSignature(
  _req: { method: string; url: string; headers: Record<string, string | string[] | undefined> },
  _reply: { code: (n: number) => { send: (b: unknown) => void } },
): Promise<boolean> {
  return true
}

function isAPRequest(req: { headers: Record<string, string | string[] | undefined> }) {
  const accept = req.headers['accept'] ?? ''
  return (
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json')
  )
}

export async function activityPubRoutes(app: FastifyInstance) {
  // ─── WebFinger ─────────────────────────────────────────────────────────────
  app.get('/.well-known/webfinger', async (req, reply) => {
    const resource = (req.query as Record<string, string>)['resource']
    if (!resource) return reply.code(400).send({ error: 'Missing resource' })

    // acct:handle@domain or https://...
    let handle: string | undefined
    if (resource.startsWith('acct:')) {
      const [localPart] = resource.slice(5).split('@')
      handle = localPart
    } else if (resource.startsWith('http')) {
      const match = resource.match(/\/users\/([^/]+)$/)
      handle = match?.[1]
    }

    if (!handle) return reply.code(404).send({ error: 'Not found' })

    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, handle), eq(actors.isLocal, true)),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const id = actorUrl(actor.handle)
    reply.header('Content-Type', 'application/jrd+json')
    return reply.send({
      subject: `acct:${actor.handle}@${env.APP_DOMAIN}`,
      aliases: [id],
      links: [
        {
          rel: 'self',
          type: AP_CONTENT_TYPE,
          href: id,
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: `${env.WEB_URL}/${actor.handle}`,
        },
      ],
    })
  })

  // ─── Instance Actor ────────────────────────────────────────────────────────
  // Used by other instances to verify our Authorized Fetch signatures
  app.get('/actor', async (_req, reply) => {
    const actor = await getInstanceActor()
    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send({
      '@context': AP_CONTEXT,
      id: `${env.APP_URL}/actor`,
      type: 'Application',
      preferredUsername: env.APP_DOMAIN,
      url: env.APP_URL,
      inbox: `${env.APP_URL}/actor/inbox`,
      outbox: `${env.APP_URL}/actor/outbox`,
      publicKey: {
        id: `${env.APP_URL}/actor#main-key`,
        owner: `${env.APP_URL}/actor`,
        publicKeyPem: actor.publicKey,
      },
    })
  })

  // Instance actor inbox — receives Accept/Follow from relays
  app.post('/actor/inbox', async (req, reply) => {
    await handleInbox(req, reply, 'instance.actor')
  })

  // ─── NodeInfo ──────────────────────────────────────────────────────────────
  app.get('/.well-known/nodeinfo', async (_req, reply) => {
    const links: Array<{ rel: string; href: string }> = [
      { rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: `${env.APP_URL}/nodeinfo/2.1` },
    ]
    if (env.TOR_ONION_URL) {
      links.push({ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: `${env.TOR_ONION_URL}/nodeinfo/2.1` })
    }
    reply.header('Content-Type', 'application/json')
    return reply.send({ links })
  })

  app.get('/nodeinfo/2.1', async (_req, reply) => {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(actors)
      .where(eq(actors.isLocal, true))

    const [postCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.isLocal, true), eq(posts.isDeleted, false)))

    reply.header('Content-Type', 'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"')
    const metadata: Record<string, unknown> = {}
    if (env.TOR_ONION_URL) metadata['onionService'] = env.TOR_ONION_URL
    return reply.send({
      version: '2.1',
      software: { name: 'floq', version: '0.1.0', repository: 'https://github.com/veyselolam/floq' },
      protocols: ['activitypub'],
      usage: {
        users: { total: userCount?.count ?? 0, activeMonth: userCount?.count ?? 0 },
        localPosts: postCount?.count ?? 0,
      },
      openRegistrations: true,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    })
  })

  // ─── Actor JSON ────────────────────────────────────────────────────────────
  app.get<{ Params: { handle: string } }>('/users/:handle', async (req, reply) => {
    if (!await requireApSignature(req, reply)) return

    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send(buildActor(actor))
  })

  // ─── W3C Verifiable Credential ────────────────────────────────────────────
  app.get<{ Params: { handle: string } }>('/users/:handle/vc', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
      columns: { handle: true, ed25519PublicKey: true, ed25519PrivateKeyEncrypted: true },
    })
    if (!actor || !actor.ed25519PublicKey || !actor.ed25519PrivateKeyEncrypted) {
      return reply.code(404).send({ error: 'No ed25519 key for this actor' })
    }
    const apActorUrl = `${env.APP_URL}/users/${actor.handle}`
    const did = `did:web:${env.APP_DOMAIN}:users:${actor.handle}`
    let didKey: string
    try {
      didKey = didKeyFromMultibase(actor.ed25519PublicKey)
    } catch {
      return reply.code(500).send({ error: 'Invalid ed25519 key' })
    }
    const vc = issueVerifiableCredential({
      handle: actor.handle,
      ed25519PublicKey: actor.ed25519PublicKey,
      ed25519PrivateKeyEncrypted: actor.ed25519PrivateKeyEncrypted,
      did,
      apActorUrl,
      didKey,
    })
    reply.header('Content-Type', 'application/ld+json')
    return reply.send(vc)
  })

  // ─── Followers/Following ───────────────────────────────────────────────────
  app.get<{ Params: { handle: string } }>('/users/:handle/followers', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const id = `${actorUrl(actor.handle)}/followers`
    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send({
      '@context': AP_CONTEXT,
      id,
      type: 'OrderedCollection',
      totalItems: actor.followersCount,
      first: `${id}?page=1`,
    })
  })

  app.get<{ Params: { handle: string } }>('/users/:handle/following', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const id = `${actorUrl(actor.handle)}/following`
    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send({
      '@context': AP_CONTEXT,
      id,
      type: 'OrderedCollection',
      totalItems: actor.followingCount,
      first: `${id}?page=1`,
    })
  })

  // ─── Outbox ────────────────────────────────────────────────────────────────
  app.get<{ Params: { handle: string }; Querystring: { page?: string; cursor?: string } }>(
    '/users/:handle/outbox',
    async (req, reply) => {
      if (!await requireApSignature(req, reply)) return

      const actor = await db.query.actors.findFirst({
        where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
      })
      if (!actor) return reply.code(404).send({ error: 'Not found' })

      const id = `${actorUrl(actor.handle)}/outbox`
      reply.header('Content-Type', AP_CONTENT_TYPE)

      if (!req.query.page) {
        return reply.send({
          '@context': AP_CONTEXT,
          id,
          type: 'OrderedCollection',
          totalItems: actor.postsCount,
          first: `${id}?page=true`,
        })
      }

      const limit = 20
      const conditions = [
        eq(posts.authorId, actor.id),
        eq(posts.isDeleted, false),
        eq(posts.visibility, 'public'),
      ]
      if (req.query.cursor) {
        conditions.push(lt(posts.createdAt, new Date(req.query.cursor)))
      }

      const page = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = page.length > limit
      const items = page.slice(0, limit)
      const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null

      const postIds = items.map((p) => p.id)
      const postPolls = postIds.length
        ? await db.query.polls.findMany({
            where: (t, { inArray }) => inArray(t.postId, postIds),
            with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
          })
        : []
      const pollsByPostId = Object.fromEntries(postPolls.map((p) => [p.postId, p]))

      const orderedItems = items.map((p) => {
        const poll = pollsByPostId[p.id]
        const obj = poll
          ? buildQuestion({ ...p, tags: p.tags, author: actor }, poll)
          : buildNote({ ...p, tags: p.tags, author: actor })
        return buildCreate(obj, actor.handle)
      })

      return reply.send({
        '@context': AP_CONTEXT,
        id: `${id}?page=true`,
        type: 'OrderedCollectionPage',
        partOf: id,
        orderedItems,
        ...(nextCursor && { next: `${id}?page=true&cursor=${encodeURIComponent(nextCursor)}` }),
      })
    },
  )

  // ─── Hashtag AP Collection ─────────────────────────────────────────────────
  // Mastodon and other AP instances resolve tag: href URLs here
  app.get<{ Params: { tag: string }; Querystring: { page?: string; cursor?: string } }>(
    '/tags/:tag',
    async (req, reply) => {
      const tag = req.params.tag.toLowerCase()
      const tagUrl = `${env.APP_URL}/tags/${encodeURIComponent(tag)}`

      // Without ?page=true → return Collection stub
      if (!req.query.page) {
        reply.header('Content-Type', AP_CONTENT_TYPE)
        return reply.send({
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: tagUrl,
          type: 'OrderedCollection',
          name: `#${tag}`,
          first: `${tagUrl}?page=true`,
        })
      }

      // With ?page=true → return page of Notes
      const limit = 20
      const conditions = [
        sql`${posts.tags} @> ARRAY[${tag}]::text[]`,
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
        // Respect noIndex — don't include posts from actors who opted out
        sql`NOT EXISTS (SELECT 1 FROM actors a WHERE a.id = ${posts.authorId} AND a.no_index = true)`,
      ]
      if (req.query.cursor) {
        conditions.push(lt(posts.createdAt, new Date(req.query.cursor)))
      }

      const page = await db.query.posts.findMany({
        where: and(...conditions),
        with: { author: true },
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = page.length > limit
      const items = page.slice(0, limit)
      const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null

      reply.header('Content-Type', AP_CONTENT_TYPE)
      return reply.send({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${tagUrl}?page=true`,
        type: 'OrderedCollectionPage',
        partOf: tagUrl,
        orderedItems: items.map((p) => buildNote({ ...p, tags: p.tags, author: p.author })),
        ...(nextCursor && { next: `${tagUrl}?page=true&cursor=${encodeURIComponent(nextCursor)}` }),
      })
    },
  )

  // ─── Post JSON ─────────────────────────────────────────────────────────────
  app.get<{ Params: { handle: string; postId: string } }>(
    '/users/:handle/posts/:postId',
    async (req, reply) => {
      if (!await requireApSignature(req, reply)) return

      const post = await db.query.posts.findFirst({
        where: eq(posts.id, req.params.postId),
        with: { author: true },
      })
      if (!post || post.author.handle !== req.params.handle) {
        return reply.code(404).send({ error: 'Not found' })
      }

      reply.header('Content-Type', AP_CONTENT_TYPE)

      // Deleted post → return Tombstone (AP spec §7.3)
      if (post.isDeleted) {
        return reply.code(410).send({
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: postUrl(req.params.handle, req.params.postId),
          type: 'Tombstone',
          formerType: 'Note',
          deleted: (post.deletedAt ?? new Date()).toISOString(),
        })
      }

      const poll = await db.query.polls.findFirst({
        where: eq(polls.postId, post.id),
        with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
      })

      return reply.send(
        poll
          ? buildQuestion({ ...post, tags: post.tags, author: post.author }, poll)
          : buildNote({ ...post, tags: post.tags, author: post.author }),
      )
    },
  )

  // ─── Inbox (shared + per-actor) ────────────────────────────────────────────
  app.post('/inbox', async (req, reply) => {
    await handleInbox(req, reply, null)
  })

  app.post<{ Params: { handle: string } }>('/users/:handle/inbox', async (req, reply) => {
    await handleInbox(req, reply, req.params.handle)
  })

  async function handleInbox(
    req: { body: unknown; headers: Record<string, string | string[] | undefined>; url: string; method: string },
    reply: { code: (n: number) => { send: (b: unknown) => void } },
    targetHandle: string | null,
  ) {
    const activity = req.body as {
      type?: string
      id?: string
      actor?: string
      object?: unknown
      '@context'?: unknown
    }

    if (!activity?.type || !activity?.actor) {
      return reply.code(400).send({ error: 'Invalid activity' })
    }

    // Reject activities from suspended instances
    try {
      const senderDomain = new URL(activity.actor).hostname
      if (await isSuspendedDomain(senderDomain)) {
        return reply.code(403).send({ error: 'Instance suspended' })
      }
    } catch { return reply.code(400).send({ error: 'Invalid actor URL' }) }

    // Fetch the sender's public key for signature verification
    const senderActor = await fetchRemoteActor(activity.actor)
    if (!senderActor) return reply.code(400).send({ error: 'Could not fetch actor' })

    const path = new URL(req.url, env.APP_URL).pathname
    const verified = verifySignature({
      method: req.method,
      path,
      headers: req.headers,
      publicKeyPem: senderActor.publicKey,
    })

    if (!verified) {
      return reply.code(401).send({ error: 'Invalid signature' })
    }

    // FEP-8b32: if the activity carries a Data Integrity Proof, verify it.
    // A wrong proof is a hard rejection; a missing proof is allowed (not all instances support it yet).
    const activityWithProof = activity as { proof?: { type?: string; cryptosuite?: string } }
    if (activityWithProof.proof?.cryptosuite === 'eddsa-jcs-2022') {
      const senderEd25519Key = (senderActor as typeof actors.$inferSelect & { ed25519PublicKey?: string | null }).ed25519PublicKey
      if (senderEd25519Key) {
        const proofValid = verifyObjectProof(activity as Record<string, unknown>, senderEd25519Key)
        if (!proofValid) {
          return reply.code(401).send({ error: 'Invalid object integrity proof' })
        }
      }
    }

    // Deduplicate
    if (activity.id) {
      const existing = await db.query.apActivities.findFirst({
        where: eq(apActivities.apId, activity.id),
      })
      if (existing) return reply.code(202).send({ status: 'already processed' })

      await db.insert(apActivities).values({
        apId: activity.id,
        type: activity.type,
        actorApId: activity.actor,
        objectApId: typeof activity.object === 'string'
          ? activity.object
          : (activity.object as { id?: string } | null)?.id ?? null,
        direction: 'inbound',
        status: 'processing',
        rawJson: activity as Record<string, unknown>,
      }).onConflictDoNothing()
    }

    try {
      await processActivity(activity, senderActor, targetHandle)

      if (activity.id) {
        await db
          .update(apActivities)
          .set({ status: 'done', processedAt: new Date() })
          .where(eq(apActivities.apId, activity.id!))
      }
    } catch (err) {
      if (activity.id) {
        await db
          .update(apActivities)
          .set({ status: 'failed', errorMessage: String((err as Error).message) })
          .where(eq(apActivities.apId, activity.id!))
      }
    }

    return reply.code(202).send({ status: 'accepted' })
  }

  async function processActivity(
    activity: { type?: string; actor?: string; object?: unknown; id?: string },
    senderActor: typeof actors.$inferSelect,
    targetHandle: string | null,
  ) {
    const obj = activity.object as {
      id?: string
      type?: string
      attributedTo?: string
      content?: string
      name?: string
      to?: string[]
      cc?: string[]
      published?: string
      sensitive?: boolean
      summary?: string
      inReplyTo?: string
      url?: string
      tag?: Array<{ type?: string; href?: string; name?: string }>
      // Question-specific
      endTime?: string
      votersCount?: number
      oneOf?: Array<{ type?: string; name?: string; replies?: { totalItems?: number } }>
      anyOf?: Array<{ type?: string; name?: string; replies?: { totalItems?: number } }>
      closed?: string
    } | string | null

    switch (activity.type) {
      case 'Follow': {
        const targetActorId = typeof obj === 'string' ? obj : obj?.id
        if (!targetActorId) return

        const target = await db.query.actors.findFirst({
          where: and(eq(actors.apId, targetActorId), eq(actors.isLocal, true)),
        })
        if (!target) return

        const [follow] = await db
          .insert(follows)
          .values({
            followerId: senderActor.id,
            followingId: target.id,
            status: target.isLocked ? 'pending' : 'accepted',
          })
          .onConflictDoNothing()
          .returning()

        // Counts + notification only for a brand-new follow row.
        if (follow?.status === 'accepted') {
          await Promise.all([
            db.update(actors)
              .set({ followingCount: sql`${actors.followingCount} + 1` })
              .where(eq(actors.id, senderActor.id)),
            db.update(actors)
              .set({ followersCount: sql`${actors.followersCount} + 1` })
              .where(eq(actors.id, target.id)),
          ])
          void notifyFollow(senderActor.id, target.id)
        }

        // Always (re-)send Accept for unlocked accounts — even on a re-follow where
        // the row already existed (onConflictDoNothing left `follow` undefined). The
        // remote keeps the follow "pending"/"requested" until it gets a matching
        // Accept, so skipping it on re-follow leaves the follower stuck forever.
        // Echo the EXACT Follow we received so the remote can match it.
        if (!target.isLocked) {
          const accept = buildAccept(target.handle, activity as Parameters<typeof buildAccept>[1])
          void deliverToInbox(target.handle, senderActor.inboxUrl, accept)
        }
        break
      }

      case 'Undo': {
        const innerObj = typeof obj === 'object' && obj !== null ? obj : null
        if (!innerObj) return

        if (innerObj.type === 'Follow') {
          // The unfollowed target is the Follow's `object` (NOT innerObj.id, which
          // is the Follow activity's own id). Using .id looked up a nonexistent
          // actor → the row was never deleted → re-follows hit onConflictDoNothing.
          const innerFollow = innerObj as { object?: string | { id?: string } }
          const targetActorId = typeof innerFollow.object === 'string'
            ? innerFollow.object
            : innerFollow.object?.id
          if (!targetActorId) return

          const target = await db.query.actors.findFirst({
            where: and(eq(actors.apId, targetActorId), eq(actors.isLocal, true)),
          })
          if (!target) return

          const [deleted] = await db
            .delete(follows)
            .where(and(eq(follows.followerId, senderActor.id), eq(follows.followingId, target.id)))
            .returning()

          if (deleted?.status === 'accepted') {
            await Promise.all([
              db.update(actors)
                .set({ followingCount: sql`GREATEST(${actors.followingCount} - 1, 0)` })
                .where(eq(actors.id, senderActor.id)),
              db.update(actors)
                .set({ followersCount: sql`GREATEST(${actors.followersCount} - 1, 0)` })
                .where(eq(actors.id, target.id)),
            ])
          }
        } else if (innerObj.type === 'Like') {
          const inner = innerObj as { type?: string; object?: string | { id?: string } }
          const targetId = typeof inner.object === 'string' ? inner.object : inner.object?.id
          if (!targetId) return
          const post = await db.query.posts.findFirst({ where: eq(posts.apId, targetId) })
          if (post) {
            const removed = await db.delete(likes)
              .where(and(eq(likes.actorId, senderActor.id), eq(likes.postId, post.id)))
              .returning()
            if (removed.length > 0) {
              await db.update(posts)
                .set({ likesCount: sql`GREATEST(${posts.likesCount} - 1, 0)` })
                .where(eq(posts.id, post.id))
            }
          }
        } else if (innerObj.type === 'Announce') {
          const inner = innerObj as { type?: string; object?: string | { id?: string } }
          const targetId = typeof inner.object === 'string' ? inner.object : inner.object?.id
          if (!targetId) return
          const post = await db.query.posts.findFirst({ where: eq(posts.apId, targetId) })
          if (post) {
            // Remove the boost record (timeline) only if it existed, then decrement.
            const removed = await db.delete(boosts)
              .where(and(eq(boosts.actorId, senderActor.id), eq(boosts.postId, post.id)))
              .returning()
            if (removed.length > 0) {
              await db.update(posts)
                .set({ boostsCount: sql`GREATEST(${posts.boostsCount} - 1, 0)` })
                .where(eq(posts.id, post.id))
            }
          }
        } else if (innerObj.type === 'EmojiReact') {
          const inner = innerObj as { type?: string; object?: string | { id?: string }; content?: string }
          const targetId = typeof inner.object === 'string' ? inner.object : inner.object?.id
          const emoji = inner.content?.trim()
          if (!targetId || !emoji) return
          const post = await db.query.posts.findFirst({ where: eq(posts.apId, targetId), columns: { id: true } })
          if (post) {
            await db.delete(reactions).where(and(
              eq(reactions.actorId, senderActor.id),
              eq(reactions.postId, post.id),
              eq(reactions.emoji, emoji),
            ))
          }
        }
        break
      }

      case 'Reject': {
        const followObj = typeof obj === 'object' && obj !== null ? obj : null
        if (!followObj || followObj.type !== 'Follow') return

        // Remote locked account rejected our follow — delete pending follow and adjust counts
        const [deleted] = await db
          .delete(follows)
          .where(and(
            eq(follows.followingId, senderActor.id),
            eq(follows.status, 'pending'),
          ))
          .returning()

        if (deleted?.status === 'accepted') {
          // Shouldn't happen (we only delete pending), but guard the decrement
          await Promise.all([
            db.update(actors)
              .set({ followingCount: sql`GREATEST(${actors.followingCount} - 1, 0)` })
              .where(eq(actors.id, deleted.followerId)),
            db.update(actors)
              .set({ followersCount: sql`GREATEST(${actors.followersCount} - 1, 0)` })
              .where(eq(actors.id, senderActor.id)),
          ])
        }
        break
      }

      case 'Create': {
        const note = typeof obj === 'object' && obj !== null ? obj : null
        if (!note || (note.type !== 'Note' && note.type !== 'Question')) return

        // Mastodon/Misskey vote: Create/Note with `name` (option text) and no content, inReplyTo = poll post
        if (note.type === 'Note' && !note.content && note.name && note.inReplyTo) {
          const pollPost = await db.query.posts.findFirst({
            where: and(eq(posts.apId, note.inReplyTo as string), eq(posts.isLocal, true)),
            with: { author: true },
          })
          if (pollPost) {
            const poll = await db.query.polls.findFirst({
              where: eq(polls.postId, pollPost.id),
              with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
            })
            if (poll && new Date(poll.expiresAt) > new Date()) {
              const option = poll.options.find((o) => o.text === (note.name as string))
              if (option) {
                const alreadyVoted = await db.query.pollVotes.findFirst({
                  where: and(
                    eq(pollVotes.pollId, poll.id),
                    eq(pollVotes.actorId, senderActor.id),
                  ),
                })
                if (!alreadyVoted || poll.multipleChoice) {
                  await db.insert(pollVotes).values({
                    pollId: poll.id,
                    optionId: option.id,
                    actorId: senderActor.id,
                  }).onConflictDoNothing()

                  await db.update(pollOptions)
                    .set({ votesCount: sql`${pollOptions.votesCount} + 1` })
                    .where(eq(pollOptions.id, option.id))

                  const voterCount = await db.$count(
                    pollVotes,
                    and(eq(pollVotes.pollId, poll.id)),
                  )
                  await db.update(polls)
                    .set({ votersCount: voterCount })
                    .where(eq(polls.id, poll.id))

                  // Broadcast updated vote counts to followers
                  const freshPoll = await db.query.polls.findFirst({
                    where: eq(polls.id, poll.id),
                    with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
                  })
                  const author = pollPost.author as { handle: string; id: string }
                  if (freshPoll) {
                    const question = buildQuestion(
                      { ...pollPost, apInReplyTo: pollPost.apInReplyTo ?? null, tags: pollPost.tags, author },
                      { ...freshPoll, options: freshPoll.options.map((o) => ({ text: o.text, votesCount: o.votesCount })) },
                    )
                    void deliverToFollowers(author.handle, author.id, buildUpdateQuestion(question, author.handle))
                  }
                }
              }
            }
          }
          return
        }

        if (!note.content) return

        const noteId = note.id
        if (!noteId) return

        // Find local target (for @mentions/DMs) or just store as remote post
        let replyToId: string | undefined
        let rootId: string | undefined

        if (note.inReplyTo) {
          let parent = await db.query.posts.findFirst({
            where: eq(posts.apId, note.inReplyTo),
          })
          // Don't have the parent? Fetch the remote ancestor chain so the
          // conversation connects instead of arriving as an orphan reply.
          if (!parent) {
            const parentId = await ingestRemoteNote(note.inReplyTo, { resolveParentsDepth: 8 })
            if (parentId) parent = await db.query.posts.findFirst({ where: eq(posts.id, parentId) })
          }
          if (parent) {
            replyToId = parent.id
            rootId = parent.rootId ?? parent.id
          }
        }

        const existing = await db.query.posts.findFirst({
          where: eq(posts.apId, noteId),
        })
        if (existing) return

        // Extract hashtags from AP tag array (type: 'Hashtag')
        const remoteTags = (note.tag ?? [])
          .filter((t) => t.type === 'Hashtag' && t.name)
          .map((t) => t.name!.replace(/^#/, '').toLowerCase())
          .filter(Boolean)

        // Upsert remote custom emojis (type: 'Emoji')
        const emojiTags = (note.tag ?? []).filter((t) => t.type === 'Emoji' && t.name && t.href)
        if (emojiTags.length > 0) {
          const domain = new URL(activity.actor!).hostname
          for (const e of emojiTags) {
            const shortcode = e.name!.replace(/^:|:$/g, '')
            await db.insert(customEmojis).values({
              shortcode,
              domain,
              imageUrl: e.href!,
              apId: e.href!,
              visibleInPicker: false,
            }).onConflictDoNothing()
          }
        }

        const visibility = resolveVisibility(note.to ?? [], note.cc ?? [])

        // Direct message: link it to the local recipient so it shows in the DM
        // thread (DMs are visibility='direct' posts keyed by recipientId).
        let dmRecipient: { id: string; userId: string | null } | undefined
        if (visibility === 'direct') {
          const addressed = [...(note.to ?? []), ...(note.cc ?? [])]
          if (addressed.length > 0) {
            const r = await db.query.actors.findFirst({
              where: and(inArray(actors.apId, addressed), eq(actors.isLocal, true)),
              columns: { id: true, userId: true },
            })
            if (r) dmRecipient = r
          }
        }
        const recipientId = dmRecipient?.id

        // Quote (FEP-e232): resolve the quoted note (fetch if unknown) and link it.
        let quotedPostId: string | undefined
        const nq = note as { quoteUri?: string; quoteUrl?: string; _misskey_quote?: string }
        const quoteRef = nq.quoteUri ?? nq.quoteUrl ?? nq._misskey_quote
          ?? (note.tag ?? []).find((t) => t.type === 'Link' && typeof t.href === 'string')?.href
        if (quoteRef && typeof quoteRef === 'string') {
          let quoted = await db.query.posts.findFirst({ where: eq(posts.apId, quoteRef), columns: { id: true } })
          if (!quoted) {
            const qid = await ingestRemoteNote(quoteRef)
            if (qid) quoted = { id: qid }
          }
          if (quoted) quotedPostId = quoted.id
        }

        const [created] = await db.insert(posts).values({
          apId: noteId,
          apUrl: note.url ?? noteId,
          authorId: senderActor.id,
          content: note.content,
          contentHash: createHash('sha256').update(note.content, 'utf8').digest('hex'),
          contentWarning: note.summary ?? null,
          visibility,
          sensitive: note.sensitive ?? false,
          apInReplyTo: note.inReplyTo ?? null,
          replyToId: replyToId ?? null,
          rootId: rootId ?? null,
          recipientId: recipientId ?? null,
          quotedPostId: quotedPostId ?? null,
          isLocal: false,
          tags: remoteTags,
          createdAt: note.published ? new Date(note.published) : new Date(),
        }).onConflictDoNothing().returning()

        if (created && quotedPostId) {
          await db.update(posts)
            .set({ quotesCount: sql`${posts.quotesCount} + 1` })
            .where(eq(posts.id, quotedPostId))
        }

        if (created && replyToId) {
          await db.update(posts)
            .set({ repliesCount: sql`${posts.repliesCount} + 1` })
            .where(eq(posts.id, replyToId))

          void notifyReply(senderActor.id, created.id, replyToId)
        }

        // Store media attachments + generate a link-preview card so federated
        // posts render with images/cards like local ones (best-effort).
        if (created) {
          void attachRemoteMediaAndPreview(created.id, note as { attachment?: { type?: string; mediaType?: string; url?: string; name?: string; width?: number; height?: number; blurhash?: string }[]; content?: string | null })
            .catch(() => {})
        }

        // Live push for an incoming federated DM, mirroring local DM delivery.
        if (created && dmRecipient?.userId) {
          void (async () => {
            const [enrichedDm] = await enrichPosts([created], dmRecipient!.id)
            publish(dmRecipient!.userId!, { event: 'dm', payload: { from: senderActor.handle, post: enrichedDm } })
          })().catch(() => {})
        }

        // If this is a Question, create the local poll record
        // FEP-1b12: if the note is addressed to a local group, re-announce to its followers
        if (created && targetHandle) {
          const groupActor = await db.query.actors.findFirst({
            where: and(eq(actors.handle, targetHandle), eq(actors.actorType, 'Group')),
          })
          if (groupActor) {
            const isMember = await db.query.follows.findFirst({
              where: and(eq(follows.followerId, senderActor.id), eq(follows.followingId, groupActor.id), eq(follows.status, 'accepted')),
            })
            if (isMember) {
              const { boosts } = await import('../db/schema.js')
              await db.insert(boosts).values({ actorId: groupActor.id, postId: created.id }).onConflictDoNothing()
              const { buildAnnounce, actorUrl: actUrl } = await import('../lib/activityPub.js')
              const announceId = `${actUrl(groupActor.handle)}/announces/${created.id}`
              const announce = buildAnnounce(actUrl(groupActor.handle), created.apId, announceId)
              void deliverToFollowers(groupActor.handle, groupActor.id, announce)
            }
          }
        }

        if (created && note.type === 'Question' && note.endTime) {
          const choices = (note.anyOf ?? note.oneOf) ?? []
          const isMultiple = !!note.anyOf
          const [newPoll] = await db.insert(polls).values({
            postId: created.id,
            multipleChoice: isMultiple,
            votersCount: note.votersCount ?? 0,
            expiresAt: new Date(note.endTime),
          }).returning()

          if (newPoll && choices.length > 0) {
            await db.insert(pollOptions).values(
              choices.map((c, i) => ({
                pollId: newPoll.id,
                text: c.name ?? '',
                votesCount: c.replies?.totalItems ?? 0,
                position: i,
              })),
            )
          }
        }
        break
      }

      case 'Delete': {
        const deleteId = typeof obj === 'string' ? obj : obj?.id
        if (!deleteId) return

        await db.update(posts)
          .set({ isDeleted: true })
          .where(and(eq(posts.apId, deleteId), eq(posts.authorId, senderActor.id)))
        break
      }

      case 'Like': {
        const likedId = typeof obj === 'string' ? obj : obj?.id
        if (!likedId) return

        const post = await db.query.posts.findFirst({ where: eq(posts.apId, likedId) })
        if (!post) return

        // Record the like so it shows in "who liked" (timeline/likers list), then
        // bump the count + notify only for a new like (idempotent on re-delivery).
        const [insertedLike] = await db.insert(likes)
          .values({ actorId: senderActor.id, postId: post.id })
          .onConflictDoNothing()
          .returning()
        if (insertedLike) {
          await db.update(posts)
            .set({ likesCount: sql`${posts.likesCount} + 1` })
            .where(eq(posts.id, post.id))
          void notifyLike(senderActor.id, post.id)
        }
        break
      }

      // Misskey/Pleroma emoji reaction → reactions table.
      case 'EmojiReact': {
        const reactedId = typeof obj === 'string' ? obj : obj?.id
        const emoji = (activity as { content?: string }).content?.trim()
        if (!reactedId || !emoji || emoji.length > 16) return
        const post = await db.query.posts.findFirst({ where: eq(posts.apId, reactedId), columns: { id: true } })
        if (!post) return
        await db.insert(reactions)
          .values({ actorId: senderActor.id, postId: post.id, emoji })
          .onConflictDoNothing()
        break
      }

      case 'Announce': {
        const boostedId = typeof obj === 'string' ? obj : obj?.id
        if (!boostedId) return

        // Fetch the boosted note if we don't have it yet, so a boost from a
        // followed remote user surfaces its content instead of being dropped.
        let post = await db.query.posts.findFirst({ where: eq(posts.apId, boostedId) })
        if (!post) {
          const id = await ingestRemoteNote(boostedId, { resolveParentsDepth: 2 })
          if (id) post = await db.query.posts.findFirst({ where: eq(posts.id, id) })
        }
        if (!post) return

        // Record the boost so it appears in the booster's followers' timelines
        // (the home feed reads the boosts table), then bump the count + notify.
        const [inserted] = await db.insert(boosts)
          .values({ actorId: senderActor.id, postId: post.id })
          .onConflictDoNothing()
          .returning()
        if (inserted) {
          await db.update(posts)
            .set({ boostsCount: sql`${posts.boostsCount} + 1` })
            .where(eq(posts.id, post.id))
          void notifyBoost(senderActor.id, post.id)
        }
        break
      }

      case 'Update': {
        const updateObj = typeof obj === 'object' && obj !== null ? obj : null
        if (!updateObj) return
        const updateType = (updateObj as { type?: string }).type

        if (updateType === 'Note') {
          // Update/Note — remote post was edited
          const note = updateObj as {
            id?: string; content?: string; summary?: string
            sensitive?: boolean; tag?: Array<{ type?: string; name?: string }>
            updated?: string
          }
          if (!note.id || !note.content) return

          // Save previous version to edit history before overwriting
          const existing = await db.query.posts.findFirst({
            where: and(eq(posts.apId, note.id), eq(posts.authorId, senderActor.id)),
          })
          if (!existing) return

          await db.insert(postEdits).values({
            postId: existing.id,
            content: existing.content,
            contentWarning: existing.contentWarning ?? null,
            editedAt: existing.editedAt ?? existing.createdAt,
          })

          const remoteTags = (note.tag ?? [])
            .filter((t) => t.type === 'Hashtag' && t.name)
            .map((t) => t.name!.replace(/^#/, '').toLowerCase())
            .filter(Boolean)

          await db.update(posts).set({
            content: note.content,
            contentHash: createHash('sha256').update(note.content, 'utf8').digest('hex'),
            contentWarning: note.summary ?? null,
            sensitive: note.sensitive ?? false,
            tags: remoteTags,
            editedAt: note.updated ? new Date(note.updated) : new Date(),
          }).where(eq(posts.id, existing.id))
          break
        }

        if (updateType === 'Question') {
          // Update/Question — remote poll vote counts or closed status changed
          const q = updateObj as {
            id?: string
            votersCount?: number
            closed?: string
            oneOf?: Array<{ name?: string; replies?: { totalItems?: number } }>
            anyOf?: Array<{ name?: string; replies?: { totalItems?: number } }>
          }
          if (!q.id) return

          const post = await db.query.posts.findFirst({ where: eq(posts.apId, q.id) })
          if (!post) return

          const existingPoll = await db.query.polls.findFirst({
            where: eq(polls.postId, post.id),
            with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
          })
          if (!existingPoll) return

          await db.update(polls)
            .set({ votersCount: q.votersCount ?? existingPoll.votersCount })
            .where(eq(polls.id, existingPoll.id))

          const choices = (q.anyOf ?? q.oneOf) ?? []
          for (let i = 0; i < choices.length; i++) {
            const opt = existingPoll.options[i]
            if (opt && choices[i]?.replies?.totalItems !== undefined) {
              await db.update(pollOptions)
                .set({ votesCount: choices[i]!.replies!.totalItems! })
                .where(eq(pollOptions.id, opt.id))
            }
          }
          break
        }

        // Update/Actor — remote profile was updated
        if (!['Person', 'Service', 'Application', 'Group', 'Organization'].includes(updateType ?? '')) return
        const updatedId = updateObj.id
        if (!updatedId || updatedId !== activity.actor) return

        const updatedActor = updateObj as {
          name?: string; summary?: string
          icon?: { url?: string }; image?: { url?: string }
          manuallyApprovesFollowers?: boolean
          indexable?: boolean
        }
        await db.update(actors).set({
          displayName: updatedActor.name ?? null,
          bio: updatedActor.summary ?? null,
          avatarUrl: updatedActor.icon?.url ?? null,
          headerUrl: updatedActor.image?.url ?? null,
          isLocked: updatedActor.manuallyApprovesFollowers ?? false,
          noIndex: updatedActor.indexable === false,
          lastFetchedAt: new Date(),
        }).where(eq(actors.apId, updatedId))
        break
      }

      case 'Move': {
        const targetId = (activity as unknown as { target?: string }).target
        if (!targetId || typeof targetId !== 'string') return

        // Mark old actor as moved
        await db.update(actors)
          .set({ movedToUri: targetId, updatedAt: new Date() } as Partial<typeof actors.$inferInsert>)
          .where(eq(actors.apId, activity.actor!))

        // Fetch target actor; verify alsoKnownAs contains the mover's AP ID
        let targetActor: Awaited<ReturnType<typeof fetchRemoteActor>> | null = null
        try { targetActor = await fetchRemoteActor(targetId) } catch { break }
        if (!targetActor) break

        const knownAs: string[] = Array.isArray(targetActor.alsoKnownAs)
          ? (targetActor.alsoKnownAs as string[])
          : targetActor.alsoKnownAs
            ? [targetActor.alsoKnownAs as string]
            : []
        if (!knownAs.includes(activity.actor!)) break

        // Auto-follow new account for all local users who followed the old account
        const oldActor = await db.query.actors.findFirst({ where: eq(actors.apId, activity.actor!) })
        if (!oldActor) break

        const localFollowers = await db.query.follows.findMany({
          where: and(eq(follows.followingId, oldActor.id), eq(follows.status, 'accepted')),
          with: { follower: true },
        })

        for (const follow of localFollowers) {
          if (!follow.follower.isLocal) continue
          // Check not already following
          const existing = await db.query.follows.findFirst({
            where: and(eq(follows.followerId, follow.follower.id), eq(follows.followingId, targetActor.id)),
          })
          if (existing) continue

          await db.insert(follows).values({
            followerId: follow.follower.id,
            followingId: targetActor.id,
            status: targetActor.isLocked ? 'pending' : 'accepted',
          }).onConflictDoNothing()

          if (!targetActor.isLocked) {
            await db.update(actors)
              .set({ followersCount: sql`${actors.followersCount} + 1` })
              .where(eq(actors.id, targetActor.id))
            await db.update(actors)
              .set({ followingCount: sql`${actors.followingCount} + 1` })
              .where(eq(actors.id, follow.follower.id))
          }

          const followActivity = buildFollow(follow.follower.handle, targetId, randomUUID())
          void deliverToInbox(follow.follower.handle, targetActor.inboxUrl, followActivity)
        }
        break
      }

      case 'Accept': {
        const followObj = typeof obj === 'object' && obj !== null ? obj : null
        if (!followObj || followObj.type !== 'Follow') return

        // If the target is the instance actor, this is a relay accepting our Follow
        if (targetHandle === 'instance.actor') {
          await acceptRelayFollow(senderActor.apId)
          break
        }

        // Our outgoing follow was accepted — update status
        const ourFollowId = typeof followObj.id === 'string'
          ? followObj.id.split('/').pop()
          : undefined
        if (!ourFollowId) return

        const [updated] = await db
          .update(follows)
          .set({ status: 'accepted' })
          .where(and(
            eq(follows.followingId, senderActor.id),
            eq(follows.status, 'pending'),
          ))
          .returning()

        if (updated) {
          await Promise.all([
            db.update(actors)
              .set({ followingCount: sql`${actors.followingCount} + 1` })
              .where(eq(actors.id, updated.followerId)),
            db.update(actors)
              .set({ followersCount: sql`${actors.followersCount} + 1` })
              .where(eq(actors.id, senderActor.id)),
          ])
        }
        break
      }

      // A remote actor blocks one of our users → sever the follow relationship.
      case 'Block': {
        const blockedId = typeof obj === 'string' ? obj : obj?.id
        if (!blockedId) return
        const target = await db.query.actors.findFirst({
          where: and(eq(actors.apId, blockedId), eq(actors.isLocal, true)),
          columns: { id: true },
        })
        if (!target) return
        await db.delete(follows).where(or(
          and(eq(follows.followerId, senderActor.id), eq(follows.followingId, target.id)),
          and(eq(follows.followerId, target.id), eq(follows.followingId, senderActor.id)),
        ))
        break
      }

      // A remote server forwards a report about our content/user → store it.
      case 'Flag': {
        const raw = activity.object
        const uris = (Array.isArray(raw) ? raw : [raw]).filter((o): o is string => typeof o === 'string')
        if (uris.length === 0) return
        const [reportedActor, reportedPost] = await Promise.all([
          db.query.actors.findFirst({ where: and(inArray(actors.apId, uris), eq(actors.isLocal, true)), columns: { id: true } }),
          db.query.posts.findFirst({ where: and(inArray(posts.apId, uris), eq(posts.isLocal, true)), columns: { id: true, authorId: true } }),
        ])
        if (!reportedActor && !reportedPost) return
        await db.insert(reports).values({
          reporterId: senderActor.id,
          reportedActorId: reportedActor?.id ?? reportedPost?.authorId ?? null,
          postId: reportedPost?.id ?? null,
          reason: 'other',
          details: (activity as { content?: string }).content ?? null,
        })
        break
      }

      default:
        break
    }
  }
}

function resolveVisibility(
  to: string[],
  cc: string[],
): 'public' | 'unlisted' | 'followers' | 'direct' {
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  if (to.includes(PUBLIC)) return 'public'
  if (cc.includes(PUBLIC)) return 'unlisted'
  if (to.some((t) => t.endsWith('/followers'))) return 'followers'
  return 'direct'
}
