import type { FastifyInstance } from 'fastify'
import { eq, and, desc, lt, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { actors, posts, notifications, mediaAttachments } from '../../db/schema.js'
import { requireMastodonUser } from '../../lib/mastodonAuth.js'
import { toMastodonNotification } from './serializers.js'

export async function mastodonNotificationRoutes(app: FastifyInstance) {
  // GET /api/v1/notifications
  app.get<{ Querystring: { limit?: string; max_id?: string; types?: string | string[]; exclude_types?: string | string[] } }>(
    '/api/v1/notifications',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return
      const { limit = '20', max_id } = req.query
      const n = Math.min(Number(limit), 40)

      const TYPE_MAP: Record<string, string> = {
        favourite: 'like',
        reblog: 'boost',
        mention: 'reply',
        follow: 'follow',
        follow_request: 'follow_request',
        poll: 'poll_ended',
      }
      const REVERSE_MAP: Record<string, string> = {
        like: 'favourite', boost: 'reblog', reply: 'mention',
        mention: 'mention', follow: 'follow', follow_request: 'follow_request', poll_ended: 'poll',
      }

      const conditions = [eq(notifications.recipientId, ctx.actor.id)]
      if (max_id) conditions.push(lt(notifications.id, max_id))

      const rows = await db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: [desc(notifications.createdAt)],
        limit: n,
      })

      const actorIds = [...new Set(rows.map((n) => n.actorId).filter(Boolean) as string[])]
      const postIds = [...new Set(rows.map((n) => n.postId).filter(Boolean) as string[])]
      const [actorMap, postMap] = await Promise.all([
        actorIds.length ? db.query.actors.findMany({ where: inArray(actors.id, actorIds) }).then((a) => new Map(a.map((x) => [x.id, x]))) : new Map(),
        postIds.length ? db.query.posts.findMany({ where: inArray(posts.id, postIds) }).then((p) => new Map(p.map((x) => [x.id, x]))) : new Map(),
      ])

      const allMedia = postIds.length
        ? await db.query.mediaAttachments.findMany({ where: inArray(mediaAttachments.postId, postIds) })
        : []
      const mediaByPost = new Map(postIds.map((id) => [id, allMedia.filter((m) => m.postId === id)]))

      const postAuthors = new Map<string, typeof actors.$inferSelect>()
      for (const post of postMap.values()) {
        const author = actorMap.get(post.authorId)
        if (!author) {
          const a = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
          if (a) postAuthors.set(post.id, a)
        } else {
          postAuthors.set(post.id, author)
        }
      }

      return reply.send(rows.map((n) => {
        const actor = n.actorId ? actorMap.get(n.actorId) ?? null : null
        const post = n.postId ? postMap.get(n.postId) ?? null : null
        const postWithAuthor = post ? {
          ...post,
          author: postAuthors.get(post.id) ?? null as typeof actors.$inferSelect | null,
          mediaAttachments: mediaByPost.get(post.id) ?? [],
        } : null
        return toMastodonNotification(n, actor, postWithAuthor)
      }))
    },
  )

  // GET /api/v1/notifications/:id
  app.get<{ Params: { id: string } }>('/api/v1/notifications/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const notif = await db.query.notifications.findFirst({
      where: and(eq(notifications.id, req.params.id), eq(notifications.recipientId, ctx.actor.id)),
    })
    if (!notif) return reply.code(404).send({ error: 'Record not found' })
    const actor = notif.actorId ? await db.query.actors.findFirst({ where: eq(actors.id, notif.actorId) }) : null
    const post = notif.postId ? await db.query.posts.findFirst({ where: eq(posts.id, notif.postId) }) : null
    const postAuthor = post ? await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) }) : null
    const media = post ? await db.query.mediaAttachments.findMany({ where: eq(mediaAttachments.postId, post.id) }) : []
    const postWithAuthor = post ? { ...post, author: postAuthor ?? undefined, mediaAttachments: media } as Parameters<typeof toMastodonNotification>[2] : null
    return reply.send(toMastodonNotification(notif, actor ?? null, postWithAuthor))
  })

  // DELETE /api/v1/notifications/clear
  app.delete('/api/v1/notifications', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    await db.update(notifications).set({ read: true }).where(eq(notifications.recipientId, ctx.actor.id))
    return reply.send({})
  })

  // GET /api/v1/markers
  app.get('/api/v1/markers', async (req, reply) => {
    return reply.send({})
  })

  // POST /api/v1/markers
  app.post('/api/v1/markers', async (req, reply) => {
    return reply.send({})
  })
}
