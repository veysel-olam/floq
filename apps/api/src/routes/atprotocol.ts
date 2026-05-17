import type { FastifyInstance } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts } from '../db/schema.js'
import { env } from '../lib/env.js'
import { didKeyFromMultibase } from '../lib/keys.js'

function atDid(handle: string) {
  return `did:web:${env.APP_DOMAIN}:users:${handle}`
}

function atPostUri(handle: string, postId: string) {
  return `at://${atDid(handle)}/app.bsky.feed.post/${postId}`
}

function feedUri(name: string) {
  return `at://did:web:${env.APP_DOMAIN}/app.bsky.feed.generator/${name}`
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

const FEED_DEFS = [
  {
    name: 'public',
    displayName: 'floq · Herkese Açık',
    description: "floq'daki tüm herkese açık gönderiler — kronolojik sırayla.",
  },
  {
    name: 'trending',
    displayName: 'floq · Trend',
    description: "floq'da en çok beğeni ve paylaşım alan gönderiler.",
  },
]

export async function atProtocolRoutes(app: FastifyInstance) {
  // ── DID Documents ────────────────────────────────────────────────────────────

  app.get('/.well-known/did.json', async (_req, reply) => {
    reply.header('Content-Type', 'application/json')
    return reply.send({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:web:${env.APP_DOMAIN}`,
      service: [
        { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: env.APP_URL },
        { id: '#activitypub', type: 'ActivityPubServer', serviceEndpoint: env.APP_URL },
      ],
    })
  })

  app.get<{ Params: { handle: string } }>('/users/:handle/did.json', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { handle: true, isLocal: true, ed25519PublicKey: true },
    })
    if (!actor?.isLocal) return reply.code(404).send({ error: 'Not found' })

    const did = atDid(actor.handle)
    const apActorUrl = `${env.APP_URL}/users/${actor.handle}`

    const alsoKnownAs = [apActorUrl, `at://${actor.handle}.${env.APP_DOMAIN}`]
    const verificationMethod: unknown[] = []
    const assertionMethod: string[] = []

    if (actor.ed25519PublicKey) {
      try {
        const didKey = didKeyFromMultibase(actor.ed25519PublicKey)
        alsoKnownAs.push(didKey)
        verificationMethod.push({
          id: `${did}#ed25519-key`,
          type: 'Multikey',
          controller: did,
          publicKeyMultibase: actor.ed25519PublicKey,
        })
        assertionMethod.push(`${did}#ed25519-key`)
      } catch { /* skip if key is malformed */ }
    }

    const doc: Record<string, unknown> = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: did,
      alsoKnownAs,
      service: [
        { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: env.APP_URL },
        { id: '#activitypub', type: 'ActivityPubActor', serviceEndpoint: apActorUrl },
      ],
    }

    if (verificationMethod.length) {
      doc['verificationMethod'] = verificationMethod
      doc['assertionMethod'] = assertionMethod
    }

    reply.header('Content-Type', 'application/json')
    return reply.send(doc)
  })

  // ── AT Record: actor profile ─────────────────────────────────────────────────

  app.get<{ Params: { handle: string } }>(
    '/xrpc/app.bsky.actor.getProfile',
    async (req, reply) => {
      const handle = (req.query as { actor?: string }).actor ?? req.params.handle
      const bare = handle.replace(/^@/, '').split('.').at(0) ?? handle

      const actor = await db.query.actors.findFirst({
        where: eq(actors.handle, bare),
        columns: {
          handle: true, displayName: true, bio: true,
          avatarUrl: true, headerUrl: true, followersCount: true,
          followingCount: true, postsCount: true, isLocal: true,
        },
      })
      if (!actor?.isLocal) return reply.code(400).send({ error: 'Profile not found' })

      return reply.send({
        did: atDid(actor.handle),
        handle: `${actor.handle}.${env.APP_DOMAIN}`,
        displayName: actor.displayName ?? actor.handle,
        description: actor.bio ?? '',
        avatar: actor.avatarUrl ?? undefined,
        banner: actor.headerUrl ?? undefined,
        followersCount: actor.followersCount,
        followsCount: actor.followingCount,
        postsCount: actor.postsCount,
        indexedAt: new Date().toISOString(),
      })
    },
  )

  // ── AT Record: individual post ───────────────────────────────────────────────

  app.get<{ Params: { handle: string; postId: string } }>(
    '/users/:handle/app.bsky.feed.post/:postId',
    async (req, reply) => {
      const actor = await db.query.actors.findFirst({
        where: eq(actors.handle, req.params.handle),
        columns: { id: true, handle: true, isLocal: true },
      })
      if (!actor?.isLocal) return reply.code(404).send({ error: 'Not found' })

      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, req.params.postId), eq(posts.authorId, actor.id)),
        columns: { id: true, content: true, createdAt: true, visibility: true, isDeleted: true, apInReplyTo: true },
      })
      if (!post || post.isDeleted || post.visibility !== 'public') {
        return reply.code(404).send({ error: 'Not found' })
      }

      const record: Record<string, unknown> = {
        $type: 'app.bsky.feed.post',
        text: stripHtml(post.content),
        createdAt: post.createdAt.toISOString(),
        langs: ['tr'],
      }

      if (post.apInReplyTo) {
        record['reply'] = {
          root: { uri: post.apInReplyTo, cid: '' },
          parent: { uri: post.apInReplyTo, cid: '' },
        }
      }

      reply.header('Content-Type', 'application/json')
      return reply.send({
        uri: atPostUri(actor.handle, post.id),
        value: record,
      })
    },
  )

  // ── com.atproto.* ─────────────────────────────────────────────────────────────

  app.get('/xrpc/com.atproto.server.describeServer', async (_req, reply) => {
    return reply.send({
      did: `did:web:${env.APP_DOMAIN}`,
      availableUserDomains: [env.APP_DOMAIN],
      inviteCodeRequired: false,
      links: {
        privacyPolicy: `${env.WEB_URL}/privacy`,
        termsOfService: `${env.WEB_URL}/terms`,
      },
    })
  })

  app.get<{ Querystring: { handle?: string } }>(
    '/xrpc/com.atproto.identity.resolveHandle',
    async (req, reply) => {
      const { handle } = req.query
      if (!handle) return reply.code(400).send({ error: 'handle is required' })

      const bare = handle.replace(/^@/, '').split('.').at(0) ?? handle

      const actor = await db.query.actors.findFirst({
        where: eq(actors.handle, bare),
        columns: { handle: true, isLocal: true },
      })
      if (!actor?.isLocal) return reply.code(400).send({ error: 'Could not resolve handle' })

      return reply.send({ did: atDid(actor.handle) })
    },
  )

  // ── app.bsky.feed.* ──────────────────────────────────────────────────────────

  // GET /xrpc/app.bsky.feed.describeFeedGenerator
  app.get('/xrpc/app.bsky.feed.describeFeedGenerator', async (_req, reply) => {
    return reply.send({
      did: `did:web:${env.APP_DOMAIN}`,
      feeds: FEED_DEFS.map((f) => ({
        uri: feedUri(f.name),
        displayName: f.displayName,
        description: f.description,
        likeCount: 0,
        indexedAt: new Date().toISOString(),
      })),
    })
  })

  // GET /xrpc/app.bsky.feed.getFeedSkeleton
  app.get<{
    Querystring: { feed?: string; limit?: string; cursor?: string }
  }>('/xrpc/app.bsky.feed.getFeedSkeleton', async (req, reply) => {
    const { feed, cursor } = req.query
    const limit = Math.min(Number(req.query.limit ?? 30), 100)

    const feedName = feed?.split('/').pop() ?? 'public'
    if (!FEED_DEFS.find((f) => f.name === feedName)) {
      return reply.code(400).send({ error: 'Unknown feed' })
    }

    const rows = await db
      .select({
        id: posts.id,
        createdAt: posts.createdAt,
        handle: actors.handle,
        score: sql<number>`${posts.likesCount} + ${posts.boostsCount}`,
      })
      .from(posts)
      .innerJoin(actors, eq(posts.authorId, actors.id))
      .where(
        and(
          eq(posts.visibility, 'public'),
          eq(posts.isDeleted, false),
          eq(actors.isLocal, true),
          cursor
            ? feedName === 'trending'
              ? sql`(${posts.likesCount} + ${posts.boostsCount}) < (SELECT likes_count + boosts_count FROM posts WHERE id = ${cursor}::uuid)`
              : sql`${posts.createdAt} < ${new Date(cursor)}`
            : undefined,
        ),
      )
      .orderBy(
        feedName === 'trending'
          ? desc(sql`${posts.likesCount} + ${posts.boostsCount}`)
          : desc(posts.createdAt),
      )
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const items = rows.slice(0, limit)

    const nextCursor = hasMore
      ? feedName === 'trending'
        ? items.at(-1)!.id
        : items.at(-1)!.createdAt.toISOString()
      : undefined

    return reply.send({
      feed: items.map((r) => ({ post: atPostUri(r.handle, r.id) })),
      ...(nextCursor ? { cursor: nextCursor } : {}),
    })
  })

  // GET /xrpc/app.bsky.feed.getActorFeeds
  app.get<{ Querystring: { actor?: string } }>(
    '/xrpc/app.bsky.feed.getActorFeeds',
    async (_req, reply) => {
      // floq itself is the feed generator — any actor query returns the same feeds
      return reply.send({
        feeds: FEED_DEFS.map((f) => ({
          uri: feedUri(f.name),
          cid: '',
          did: `did:web:${env.APP_DOMAIN}`,
          creator: {
            did: `did:web:${env.APP_DOMAIN}`,
            handle: env.APP_DOMAIN,
            displayName: 'floq',
          },
          displayName: f.displayName,
          description: f.description,
          likeCount: 0,
          indexedAt: new Date().toISOString(),
        })),
      })
    },
  )
}
