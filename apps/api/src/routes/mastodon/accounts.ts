import type { FastifyInstance } from 'fastify'
import { eq, and, or, desc, lt, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { actors, follows, blocks, mutes, likes, boosts, posts, mediaAttachments } from '../../db/schema.js'
import { requireMastodonUser, getMastodonUser } from '../../lib/mastodonAuth.js'
import { toMastodonAccount, toMastodonStatus } from './serializers.js'
import { deliverToInbox, fetchRemoteActor } from '../../lib/federation.js'
import { buildFollow, buildUndo, buildFollow as buildUnfollow, actorUrl } from '../../lib/activityPub.js'
import { env } from '../../lib/env.js'

const LIMIT = 40

export async function mastodonAccountRoutes(app: FastifyInstance) {
  // GET /api/v1/accounts/verify_credentials
  app.get('/api/v1/accounts/verify_credentials', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    return reply.send({ ...toMastodonAccount(ctx.actor), source: { privacy: 'public', sensitive: false, language: 'tr', note: ctx.actor.bio ?? '', fields: [] } })
  })

  // PATCH /api/v1/accounts/update_credentials
  app.patch('/api/v1/accounts/update_credentials', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const body = z.object({
      display_name: z.string().max(255).optional(),
      note: z.string().max(2000).optional(),
      locked: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })
    const update: Partial<typeof actors.$inferInsert> = {}
    if (body.data.display_name !== undefined) update.displayName = body.data.display_name
    if (body.data.note !== undefined) update.bio = body.data.note
    if (body.data.locked !== undefined) update.isLocked = body.data.locked
    const [updated] = await db.update(actors).set(update).where(eq(actors.id, ctx.actor.id)).returning()
    return reply.send(toMastodonAccount(updated!))
  })

  // GET /api/v1/accounts/:id
  app.get<{ Params: { id: string } }>('/api/v1/accounts/:id', async (req, reply) => {
    const actor = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    if (!actor) return reply.code(404).send({ error: 'Record not found' })
    return reply.send(toMastodonAccount(actor))
  })

  // GET /api/v1/accounts/lookup?acct=...
  app.get<{ Querystring: { acct?: string } }>('/api/v1/accounts/lookup', async (req, reply) => {
    const acct = req.query.acct?.replace(/^@/, '')
    if (!acct) return reply.code(422).send({ error: 'acct required' })
    const handle = acct.includes('@') ? acct : acct
    const actor = await db.query.actors.findFirst({ where: eq(actors.handle, handle) })
    if (!actor) return reply.code(404).send({ error: 'Record not found' })
    return reply.send(toMastodonAccount(actor))
  })

  // GET /api/v1/accounts/:id/statuses
  app.get<{
    Params: { id: string }
    Querystring: { limit?: string; max_id?: string; since_id?: string; exclude_replies?: string; only_media?: string }
  }>('/api/v1/accounts/:id/statuses', async (req, reply) => {
    const { limit = '20', max_id, exclude_replies, only_media } = req.query
    const ctx = await getMastodonUser(req)
    const actor = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    if (!actor) return reply.code(404).send({ error: 'Record not found' })

    const conditions = [eq(posts.authorId, actor.id), eq(posts.isDeleted, false)]
    if (max_id) conditions.push(lt(posts.id, max_id))
    if (exclude_replies === 'true') conditions.push(eq(posts.replyToId, null as unknown as string))

    const rows = await db.query.posts.findMany({
      where: and(...conditions),
      orderBy: [desc(posts.createdAt)],
      limit: Math.min(Number(limit), LIMIT),
    })

    // Fetch media for batch
    const postIds = rows.map((p) => p.id)
    const allMedia = postIds.length ? await db.query.mediaAttachments.findMany({
      where: inArray(mediaAttachments.postId, postIds),
    }) : []
    const mediaByPost = new Map(postIds.map((id) => [id, allMedia.filter((m) => m.postId === id)]))

    // Fetch likes/boosts status for current user
    const likedSet = new Set<string>()
    const boostedSet = new Set<string>()
    if (ctx) {
      const myLikes = await db.query.likes.findMany({ where: and(eq(likes.actorId, ctx.actor.id), inArray(likes.postId, postIds)), columns: { postId: true } })
      const myBoosts = await db.query.boosts.findMany({ where: and(eq(boosts.actorId, ctx.actor.id), inArray(boosts.postId, postIds)), columns: { postId: true } })
      myLikes.forEach((l) => likedSet.add(l.postId))
      myBoosts.forEach((b) => boostedSet.add(b.postId))
    }

    const statuses = rows.map((p) => toMastodonStatus(p, actor, {
      mediaAttachments: mediaByPost.get(p.id) ?? [],
      favourited: likedSet.has(p.id),
      reblogged: boostedSet.has(p.id),
    }))

    if (only_media === 'true') {
      return reply.send(statuses.filter((s) => s.media_attachments.length > 0))
    }
    return reply.send(statuses)
  })

  // GET /api/v1/accounts/:id/followers
  app.get<{ Params: { id: string }; Querystring: { limit?: string; max_id?: string } }>(
    '/api/v1/accounts/:id/followers',
    async (req, reply) => {
      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followingId, req.params.id), eq(follows.status, 'accepted')),
        limit: Math.min(Number(req.query.limit ?? 40), LIMIT),
        with: { follower: true },
      })
      return reply.send(rows.map((r) => toMastodonAccount(r.follower!)))
    },
  )

  // GET /api/v1/accounts/:id/following
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/v1/accounts/:id/following',
    async (req, reply) => {
      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followerId, req.params.id), eq(follows.status, 'accepted')),
        limit: Math.min(Number(req.query.limit ?? 40), LIMIT),
        with: { following: true },
      })
      return reply.send(rows.map((r) => toMastodonAccount(r.following!)))
    },
  )

  // POST /api/v1/accounts/:id/follow
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/follow', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const target = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    if (!target) return reply.code(404).send({ error: 'Record not found' })
    if (target.id === ctx.actor.id) return reply.code(422).send({ error: 'Cannot follow yourself' })

    const existing = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)),
    })
    if (!existing) {
      const status = target.isLocked ? 'pending' : 'accepted'
      await db.insert(follows).values({ followerId: ctx.actor.id, followingId: target.id, status }).onConflictDoNothing()
      if (!target.isLocal) {
        const followActivity = buildFollow(actorUrl(ctx.actor.handle), target.apId, `${actorUrl(ctx.actor.handle)}/follow/${target.id}`)
        void deliverToInbox(ctx.actor.handle, target.inboxUrl, followActivity)
      }
    }
    return reply.send(await buildRelationship(ctx.actor.id, target.id))
  })

  // POST /api/v1/accounts/:id/unfollow
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/unfollow', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const target = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    if (!target) return reply.code(404).send({ error: 'Record not found' })

    const existing = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)),
    })
    if (existing) {
      await db.delete(follows).where(and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)))
      if (!target.isLocal) {
        const followActivity = buildFollow(actorUrl(ctx.actor.handle), target.apId, `${actorUrl(ctx.actor.handle)}/follow/${target.id}`)
        const undoActivity = buildUndo(actorUrl(ctx.actor.handle), followActivity)
        void deliverToInbox(ctx.actor.handle, target.inboxUrl, undoActivity)
      }
    }
    return reply.send(await buildRelationship(ctx.actor.id, target.id))
  })

  // POST /api/v1/accounts/:id/block
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/block', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.insert(blocks).values({ blockerId: ctx.actor.id, blockedId: req.params.id }).onConflictDoNothing()
    await db.delete(follows).where(or(
      and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, req.params.id)),
      and(eq(follows.followerId, req.params.id), eq(follows.followingId, ctx.actor.id)),
    ))
    return reply.send(await buildRelationship(ctx.actor.id, req.params.id))
  })

  // POST /api/v1/accounts/:id/unblock
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/unblock', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.delete(blocks).where(and(eq(blocks.blockerId, ctx.actor.id), eq(blocks.blockedId, req.params.id)))
    return reply.send(await buildRelationship(ctx.actor.id, req.params.id))
  })

  // POST /api/v1/accounts/:id/mute
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/mute', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.insert(mutes).values({ muterId: ctx.actor.id, mutedId: req.params.id }).onConflictDoNothing()
    return reply.send(await buildRelationship(ctx.actor.id, req.params.id))
  })

  // POST /api/v1/accounts/:id/unmute
  app.post<{ Params: { id: string } }>('/api/v1/accounts/:id/unmute', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.delete(mutes).where(and(eq(mutes.muterId, ctx.actor.id), eq(mutes.mutedId, req.params.id)))
    return reply.send(await buildRelationship(ctx.actor.id, req.params.id))
  })

  // GET /api/v1/accounts/relationships
  app.get<{ Querystring: { id?: string | string[] } }>('/api/v1/accounts/relationships', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const ids = Array.isArray(req.query.id) ? req.query.id : req.query.id ? [req.query.id] : []
    const rels = await Promise.all(ids.map((id) => buildRelationship(ctx.actor.id, id)))
    return reply.send(rels)
  })

  // GET /api/v1/follow_requests
  app.get('/api/v1/follow_requests', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const rows = await db.query.follows.findMany({
      where: and(eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')),
      with: { follower: true },
    })
    return reply.send(rows.map((r) => toMastodonAccount(r.follower!)))
  })

  // POST /api/v1/follow_requests/:id/authorize
  app.post<{ Params: { id: string } }>('/api/v1/follow_requests/:id/authorize', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.update(follows).set({ status: 'accepted' }).where(
      and(eq(follows.followerId, req.params.id), eq(follows.followingId, ctx.actor.id)),
    )
    const follower = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    return reply.send(follower ? toMastodonAccount(follower) : {})
  })

  // POST /api/v1/follow_requests/:id/reject
  app.post<{ Params: { id: string } }>('/api/v1/follow_requests/:id/reject', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.delete(follows).where(
      and(eq(follows.followerId, req.params.id), eq(follows.followingId, ctx.actor.id)),
    )
    const follower = await db.query.actors.findFirst({ where: eq(actors.id, req.params.id) })
    return reply.send(follower ? toMastodonAccount(follower) : {})
  })

  // GET /api/v1/blocks
  app.get('/api/v1/blocks', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const rows = await db.query.blocks.findMany({
      where: eq(blocks.blockerId, ctx.actor.id),
      with: { blocked: true },
    })
    return reply.send(rows.map((r) => toMastodonAccount(r.blocked!)))
  })

  // GET /api/v1/mutes
  app.get('/api/v1/mutes', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const rows = await db.query.mutes.findMany({
      where: eq(mutes.muterId, ctx.actor.id),
      with: { muted: true },
    })
    return reply.send(rows.map((r) => toMastodonAccount(r.muted!)))
  })

  // GET /api/v1/favourites (liked posts)
  app.get<{ Querystring: { limit?: string; max_id?: string } }>('/api/v1/favourites', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const myLikeRows = await db.query.likes.findMany({
      where: eq(likes.actorId, ctx.actor.id),
      orderBy: [desc(likes.createdAt)],
      limit: Math.min(Number(req.query.limit ?? 20), LIMIT),
      columns: { postId: true },
    })
    const likedPostIds = myLikeRows.map((l) => l.postId)
    const likedPosts = likedPostIds.length ? await db.query.posts.findMany({ where: inArray(posts.id, likedPostIds) }) : []
    const authorIds = [...new Set(likedPosts.map((p) => p.authorId))]
    const authorMap = authorIds.length
      ? new Map((await db.query.actors.findMany({ where: inArray(actors.id, authorIds) })).map((a) => [a.id, a]))
      : new Map()
    return reply.send(likedPosts.flatMap((p) => {
      const author = authorMap.get(p.authorId)
      if (!author) return []
      return [toMastodonStatus(p, author, { favourited: true })]
    }))
  })

  // GET /api/v1/bookmarks
  app.get<{ Querystring: { limit?: string } }>('/api/v1/bookmarks', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const { bookmarks } = await import('../../db/schema.js')
    const myBookmarkRows = await db.query.bookmarks.findMany({
      where: eq(bookmarks.actorId, ctx.actor.id),
      orderBy: [desc(bookmarks.createdAt)],
      limit: Math.min(Number(req.query.limit ?? 20), LIMIT),
      columns: { postId: true },
    })
    const bookmarkedPostIds = myBookmarkRows.map((b) => b.postId)
    const bookmarkedPosts = bookmarkedPostIds.length ? await db.query.posts.findMany({ where: inArray(posts.id, bookmarkedPostIds) }) : []
    const authorIds = [...new Set(bookmarkedPosts.map((p) => p.authorId))]
    const authorMap = authorIds.length
      ? new Map((await db.query.actors.findMany({ where: inArray(actors.id, authorIds) })).map((a) => [a.id, a]))
      : new Map()
    return reply.send(bookmarkedPosts.flatMap((p) => {
      const author = authorMap.get(p.authorId)
      if (!author) return []
      return [toMastodonStatus(p, author, { bookmarked: true })]
    }))
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildRelationship(myId: string, targetId: string) {
  const [follow, reverse, block, mute] = await Promise.all([
    db.query.follows.findFirst({ where: and(eq(follows.followerId, myId), eq(follows.followingId, targetId)) }),
    db.query.follows.findFirst({ where: and(eq(follows.followerId, targetId), eq(follows.followingId, myId)) }),
    db.query.blocks.findFirst({ where: and(eq(blocks.blockerId, myId), eq(blocks.blockedId, targetId)) }),
    db.query.mutes.findFirst({ where: and(eq(mutes.muterId, myId), eq(mutes.mutedId, targetId)) }),
  ])
  return {
    id: targetId,
    following: follow?.status === 'accepted',
    requested: follow?.status === 'pending',
    followed_by: reverse?.status === 'accepted',
    blocking: !!block,
    muting: !!mute,
    muting_notifications: false,
    requested_by: false,
    showing_reblogs: true,
    notifying: false,
    languages: null,
    domain_blocking: false,
    endorsed: false,
    note: '',
  }
}
