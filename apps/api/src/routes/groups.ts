import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { actors, posts, follows, apGroups, mediaAttachments } from '../db/schema.js'
import { requireMastodonUser, getMastodonUser } from '../lib/mastodonAuth.js'
import { toMastodonAccount, toMastodonStatus } from './mastodon/serializers.js'
import { generateActorKeyPair } from '../lib/keys.js'
import { env } from '../lib/env.js'
import { buildActor, AP_CONTENT_TYPE, AP_CONTEXT } from '../lib/activityPub.js'
import { deliverToFollowers } from '../lib/federation.js'

// ── POST /api/groups — create a new AP group ──────────────────────────────────
// ── GET  /api/groups/:handle — group profile ─────────────────────────────────
// ── GET  /api/groups/:handle/members — group followers ────────────────────────
// ── GET  /api/groups/:handle/statuses — group posts (boosted) ─────────────────

export async function groupRoutes(app: FastifyInstance) {
  // Create group
  app.post('/api/groups', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({
      handle: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/),
      display_name: z.string().max(100).optional(),
      note: z.string().max(500).optional(),
      locked: z.boolean().optional().default(false),
      rules: z.string().max(2000).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const { handle, display_name, note, locked, rules } = body.data

    const existing = await db.query.actors.findFirst({ where: eq(actors.handle, handle) })
    if (existing) return reply.code(422).send({ error: 'Handle already taken' })

    const { publicKeyPem, privateKeyEncrypted } = await generateActorKeyPair()
    const apId = `${env.APP_URL}/users/${handle}`

    const [groupActor] = await db.insert(actors).values({
      handle,
      displayName: display_name ?? handle,
      bio: note ?? null,
      isLocal: true,
      isBot: false,
      actorType: 'Group',
      isLocked: locked,
      publicKey: publicKeyPem,
      privateKeyEncrypted,
      apId,
      inboxUrl: `${apId}/inbox`,
      outboxUrl: `${apId}/outbox`,
      profileUrl: apId,
      followersUrl: `${apId}/followers`,
      followingUrl: `${apId}/following`,
    }).returning()

    await db.insert(apGroups).values({
      actorId: groupActor!.id,
      ownerId: ctx.actor.id,
      rules: rules ?? null,
      isOpen: !locked,
    })

    return reply.code(200).send(toMastodonAccount(groupActor!))
  })

  // Get group profile
  app.get<{ Params: { handle: string } }>('/api/groups/:handle', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.actorType, 'Group')),
    })
    if (!actor) return reply.code(404).send({ error: 'Record not found' })

    const group = await db.query.apGroups.findFirst({ where: eq(apGroups.actorId, actor.id) })
    const ctx = await getMastodonUser(req)
    const following = ctx ? !!(await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
    })) : false

    return reply.send({
      ...toMastodonAccount(actor),
      rules: group?.rules ?? null,
      is_open: group?.isOpen ?? true,
      following,
    })
  })

  // Group members (followers)
  app.get<{ Params: { handle: string }; Querystring: { limit?: string } }>(
    '/api/groups/:handle/members',
    async (req, reply) => {
      const actor = await db.query.actors.findFirst({
        where: and(eq(actors.handle, req.params.handle), eq(actors.actorType, 'Group')),
      })
      if (!actor) return reply.code(404).send({ error: 'Record not found' })

      const n = Math.min(Number(req.query.limit ?? 40), 80)
      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')),
        with: { follower: true },
        limit: n,
      })
      return reply.send(rows.map((r) => toMastodonAccount(r.follower!)))
    },
  )

  // Group feed — posts that were boosted by the group (sent to group inbox)
  app.get<{ Params: { handle: string }; Querystring: { limit?: string; max_id?: string } }>(
    '/api/groups/:handle/statuses',
    async (req, reply) => {
      const actor = await db.query.actors.findFirst({
        where: and(eq(actors.handle, req.params.handle), eq(actors.actorType, 'Group')),
      })
      if (!actor) return reply.code(404).send({ error: 'Record not found' })

      const n = Math.min(Number(req.query.limit ?? 20), 40)
      // Group feed = posts authored by group members, boosted (announced) by the group
      // We store group boosts in the regular boosts table with actorId = group actor
      const { boosts } = await import('../db/schema.js')
      const { inArray } = await import('drizzle-orm')
      const groupBoosts = await db.query.boosts.findMany({
        where: eq(boosts.actorId, actor.id),
        orderBy: [desc(boosts.createdAt)],
        limit: n,
        columns: { postId: true },
      })
      if (!groupBoosts.length) return reply.send([])

      const postIds = groupBoosts.map((b) => b.postId)
      const postRows = await db.query.posts.findMany({
        where: and(inArray(posts.id, postIds), eq(posts.isDeleted, false)),
      })
      const authorIds = [...new Set(postRows.map((p) => p.authorId))]
      const authorMap = authorIds.length
        ? new Map((await db.query.actors.findMany({ where: inArray(actors.id, authorIds) })).map((a) => [a.id, a]))
        : new Map()
      const allMedia = await db.query.mediaAttachments.findMany({
        where: inArray(mediaAttachments.postId, postIds),
      })
      const mediaByPost = new Map(postIds.map((id) => [id, allMedia.filter((m) => m.postId === id)]))

      return reply.send(postRows.flatMap((p) => {
        const author = authorMap.get(p.authorId)
        if (!author) return []
        return [toMastodonStatus(p, author, { mediaAttachments: mediaByPost.get(p.id) ?? [] })]
      }))
    },
  )

  // AP actor endpoint for groups
  app.get<{ Params: { handle: string } }>('/groups/:handle', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.actorType, 'Group')),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const accept = req.headers.accept ?? ''
    if (!accept.includes('application/activity+json') && !accept.includes('application/ld+json')) {
      return reply.redirect(`${env.WEB_URL}/groups/${actor.handle}`)
    }

    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send({
      ...buildActor({ ...actor, actorType: 'Group' }),
      // FEP-1b12: groups advertise their capabilities
      capabilities: { announce: 'https://w3id.org/fep/1b12' },
    })
  })
}
