import type { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { actors, posts, likes, boosts, bookmarks, mediaAttachments, follows } from '../../db/schema.js'
import { requireMastodonUser, getMastodonUser } from '../../lib/mastodonAuth.js'
import { toMastodonStatus, toMastodonMedia, toMastodonAccount } from './serializers.js'
import { deliverToFollowers } from '../../lib/federation.js'
import {
  buildNote, buildCreate, buildLike, buildUndo, buildAnnounce,
  buildDelete, postUrl, actorUrl,
} from '../../lib/activityPub.js'
import { createHash } from 'node:crypto'
import { env } from '../../lib/env.js'
import {
  publish, publishPublicStream, publishPublicLocalStream, publishHashtagStream,
} from '../../lib/pubsub.js'
import { deliverToRelays } from '../../lib/federation.js'
import { notifySubscribers } from '../../lib/websub.js'
import { enqueueBlueskyCrosspost, enqueueNostrCrosspost } from '../../jobs/crosspost.js'

export async function mastodonStatusRoutes(app: FastifyInstance) {
  // POST /api/v1/statuses
  app.post('/api/v1/statuses', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({
      status: z.string().max(500).optional(),
      in_reply_to_id: z.string().uuid().optional(),
      sensitive: z.boolean().optional().default(false),
      spoiler_text: z.string().max(500).optional(),
      visibility: z.enum(['public', 'unlisted', 'private', 'direct']).optional().default('public'),
      language: z.string().max(10).optional(),
      media_ids: z.array(z.string()).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const content = body.data.status ?? ''
    const visMap: Record<string, 'public' | 'unlisted' | 'followers' | 'direct'> = { public: 'public', unlisted: 'unlisted', private: 'followers', direct: 'direct' }
    const visibility = visMap[body.data.visibility] ?? 'public'
    const contentHash = createHash('sha256').update(content).digest('hex')

    const [post] = await db.insert(posts).values({
      authorId: ctx.actor.id,
      content: content || '',
      contentWarning: body.data.spoiler_text ?? null,
      sensitive: body.data.sensitive ?? false,
      visibility,
      language: body.data.language ?? null,
      replyToId: body.data.in_reply_to_id ?? null,
      tags: [],
      isLocal: true,
      contentHash,
      apId: 'placeholder',
    }).returning()

    const apId = `${env.APP_URL}/users/${ctx.actor.handle}/posts/${post!.id}`
    await db.update(posts).set({ apId, apUrl: apId }).where(eq(posts.id, post!.id))

    // Attach media
    if (body.data.media_ids?.length) {
      await db.update(mediaAttachments)
        .set({ postId: post!.id })
        .where(inArray(mediaAttachments.id, body.data.media_ids))
    }

    const fullPost = { ...post!, apId }
    const mediaForPost = body.data.media_ids?.length
      ? await db.query.mediaAttachments.findMany({ where: inArray(mediaAttachments.id, body.data.media_ids) })
      : []

    // Federate
    if (visibility !== 'direct') {
      const note = buildNote({ ...fullPost, author: ctx.actor, apInReplyTo: fullPost.apInReplyTo ?? null })
      const create = buildCreate(note, ctx.actor.handle)
      void deliverToFollowers(ctx.actor.handle, ctx.actor.id, create)
      if (visibility === 'public') {
        const announceId = `${env.APP_URL}/actor/announces/${fullPost.id}`
        const { buildAnnounce } = await import('../../lib/activityPub.js')
        void deliverToRelays(buildAnnounce(`${env.APP_URL}/actor`, fullPost.apId, announceId))
        // WebSub fan-out for profile feed and any matching hashtag feeds
        const profileFeed = `${env.APP_URL}/${ctx.actor.handle}/rss`
        void notifySubscribers(profileFeed)
        for (const tag of fullPost.tags.filter((t) => t.startsWith('#'))) {
          void notifySubscribers(`${env.APP_URL}/tags/${tag.slice(1)}/rss`)
        }
        // Cross-post to connected bridges via the durable job queue (retry +
        // media), matching the main web post path so client-API posts behave
        // identically to web-composed ones.
        if (ctx.actor.nostrCrosspostEnabled && ctx.actor.nostrPrivateKeyEncrypted) {
          void enqueueNostrCrosspost(ctx.actor.nostrPrivateKeyEncrypted, content, fullPost.tags ?? []).catch(() => {})
        }
        const bridgeMedia = mediaForPost
          .filter((m) => m.mimeType.startsWith('image/'))
          .map((m) => ({ url: m.url, alt: m.altText }))
        void enqueueBlueskyCrosspost(ctx.userId, content, fullPost.tags ?? [], bridgeMedia, fullPost.id).catch(() => {})
      }
    }

    const serialized = toMastodonStatus(fullPost, ctx.actor, { mediaAttachments: mediaForPost })

    // Publish to streaming channels (fire-and-forget)
    void (async () => {
      const streamPayload = { event: 'update', payload: serialized }
      if (visibility === 'public' || visibility === 'unlisted') {
        await publishPublicStream(streamPayload)
        if (fullPost.isLocal) await publishPublicLocalStream(streamPayload)
        for (const tag of fullPost.tags.filter((t) => t.startsWith('#'))) {
          await publishHashtagStream(tag.slice(1), streamPayload)
        }
      }
      // Fan-out to followers' home streams
      const followers = await db.query.follows.findMany({
        where: and(eq(follows.followingId, ctx.actor.id), eq(follows.status, 'accepted')),
        columns: { followerId: true },
      })
      await Promise.all(followers.map((f) => publish(f.followerId, streamPayload)))
    })()

    return reply.code(200).send(serialized)
  })

  // GET /api/v1/statuses/:id
  app.get<{ Params: { id: string } }>('/api/v1/statuses/:id', async (req, reply) => {
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    if (!author) return reply.code(404).send({ error: 'Record not found' })
    const media = await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) })
    const ctx = await getMastodonUser(req)
    const favourited = ctx ? !!(await db.query.likes.findFirst({ where: and(eq(likes.actorId, ctx.actor.id), eq(likes.postId, post.id)) })) : false
    const reblogged = ctx ? !!(await db.query.boosts.findFirst({ where: and(eq(boosts.actorId, ctx.actor.id), eq(boosts.postId, post.id)) })) : false
    return reply.send(toMastodonStatus(post, author, { mediaAttachments: media, favourited, reblogged }))
  })

  // DELETE /api/v1/statuses/:id
  app.delete<{ Params: { id: string } }>('/api/v1/statuses/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, post.id))
    const deleteActivity = buildDelete(postUrl(ctx.actor.handle, post.id), actorUrl(ctx.actor.handle))
    void deliverToFollowers(ctx.actor.handle, ctx.actor.id, deleteActivity)
    void publishPublicStream({ event: 'delete', payload: post.id })
    if (post.isLocal) void publishPublicLocalStream({ event: 'delete', payload: post.id })
    return reply.send(toMastodonStatus(post, ctx.actor))
  })

  // POST /api/v1/statuses/:id/favourite
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/favourite', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.insert(likes).values({ actorId: ctx.actor.id, postId: post.id }).onConflictDoNothing()
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    if (author && !author.isLocal) {
      const likeActivity = buildLike(actorUrl(ctx.actor.handle), post.apId, `${actorUrl(ctx.actor.handle)}/likes/${post.id}`)
      void import('../../lib/federation.js').then(({ deliverToInbox }) => deliverToInbox(ctx.actor.handle, author.inboxUrl, likeActivity))
    }
    const media = await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { mediaAttachments: media, favourited: true }))
  })

  // POST /api/v1/statuses/:id/unfavourite
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/unfavourite', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.delete(likes).where(and(eq(likes.actorId, ctx.actor.id), eq(likes.postId, post.id)))
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    const media = await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { mediaAttachments: media, favourited: false }))
  })

  // POST /api/v1/statuses/:id/reblog
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/reblog', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.insert(boosts).values({ actorId: ctx.actor.id, postId: post.id }).onConflictDoNothing()
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    const announceId = `${actorUrl(ctx.actor.handle)}/boosts/${post.id}`
    const announce = buildAnnounce(actorUrl(ctx.actor.handle), post.apId, announceId)
    void deliverToFollowers(ctx.actor.handle, ctx.actor.id, announce)
    const media = await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { mediaAttachments: media, reblogged: true }))
  })

  // POST /api/v1/statuses/:id/unreblog
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/unreblog', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.delete(boosts).where(and(eq(boosts.actorId, ctx.actor.id), eq(boosts.postId, post.id)))
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    const media = await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { mediaAttachments: media, reblogged: false }))
  })

  // POST /api/v1/statuses/:id/bookmark
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/bookmark', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.insert(bookmarks).values({ actorId: ctx.actor.id, postId: post.id }).onConflictDoNothing()
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { bookmarked: true }))
  })

  // POST /api/v1/statuses/:id/unbookmark
  app.post<{ Params: { id: string } }>('/api/v1/statuses/:id/unbookmark', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })
    await db.delete(bookmarks).where(and(eq(bookmarks.actorId, ctx.actor.id), eq(bookmarks.postId, post.id)))
    const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    return reply.send(toMastodonStatus(post, author ?? ctx.actor, { bookmarked: false }))
  })

  // GET /api/v1/statuses/:id/favourited_by
  app.get<{ Params: { id: string } }>('/api/v1/statuses/:id/favourited_by', async (req, reply) => {
    const rows = await db.query.likes.findMany({
      where: eq(likes.postId, req.params.id),
      with: { actor: true },
      limit: 40,
    })
    return reply.send(rows.map((r) => toMastodonAccount(r.actor!)))
  })

  // GET /api/v1/statuses/:id/reblogged_by
  app.get<{ Params: { id: string } }>('/api/v1/statuses/:id/reblogged_by', async (req, reply) => {
    const rows = await db.query.boosts.findMany({
      where: eq(boosts.postId, req.params.id),
      with: { actor: true },
      limit: 40,
    })
    return reply.send(rows.map((r) => toMastodonAccount(r.actor!)))
  })

  // GET /api/v1/statuses/:id/context (thread)
  app.get<{ Params: { id: string } }>('/api/v1/statuses/:id/context', async (req, reply) => {
    const post = await db.query.posts.findFirst({ where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)) })
    if (!post) return reply.code(404).send({ error: 'Record not found' })

    const ancestors: typeof posts.$inferSelect[] = []
    let current = post
    while (current.replyToId) {
      const parent = await db.query.posts.findFirst({ where: and(eq(posts.id, current.replyToId), eq(posts.isDeleted, false)) })
      if (!parent) break
      ancestors.unshift(parent)
      current = parent
    }

    const descendants = await db.query.posts.findMany({
      where: and(eq(posts.rootId, post.rootId ?? post.id), eq(posts.isDeleted, false)),
      limit: 60,
    })

    const allPosts = [...ancestors, ...descendants]
    const authorIds = [...new Set(allPosts.map((p) => p.authorId))]
    const authorMap = authorIds.length
      ? new Map((await db.query.actors.findMany({ where: inArray(actors.id, authorIds) })).map((a) => [a.id, a]))
      : new Map()

    return reply.send({
      ancestors: ancestors.map((p) => {
        const a = authorMap.get(p.authorId)
        return a ? toMastodonStatus(p, a) : null
      }).filter(Boolean),
      descendants: descendants.filter((p) => p.id !== post.id).map((p) => {
        const a = authorMap.get(p.authorId)
        return a ? toMastodonStatus(p, a) : null
      }).filter(Boolean),
    })
  })
}
