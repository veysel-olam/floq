import type { FastifyInstance } from 'fastify'
import { eq, and, count, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { hashtagFollows, posts, actors } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function hashtagsRoutes(app: FastifyInstance) {
  // GET /api/hashtags/followed — kullanıcının takip ettiği hashtagler
  app.get('/api/hashtags/followed', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db.query.hashtagFollows.findMany({
      where: eq(hashtagFollows.actorId, ctx.actor.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })

    return reply.send({ hashtags: rows.map((r) => r.hashtag) })
  })

  // GET /api/hashtags/:tag — hashtag metadata (post sayısı, takipçi sayısı, takip durumu)
  app.get<{ Params: { tag: string } }>('/api/hashtags/:tag', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const tag = req.params.tag.toLowerCase()

    const [postCountRow, followerCountRow, followRow] = await Promise.all([
      db
        .select({ count: count() })
        .from(posts)
        .where(
          and(
            eq(posts.isDeleted, false),
            sql`${posts.tags} @> ARRAY[${tag}]::text[]`,
          ),
        )
        .then((r) => r[0]),
      db
        .select({ count: count() })
        .from(hashtagFollows)
        .where(eq(hashtagFollows.hashtag, tag))
        .then((r) => r[0]),
      db.query.hashtagFollows.findFirst({
        where: and(eq(hashtagFollows.actorId, ctx.actor.id), eq(hashtagFollows.hashtag, tag)),
      }),
    ])

    return reply.send({
      tag,
      postsCount: postCountRow?.count ?? 0,
      followersCount: followerCountRow?.count ?? 0,
      following: !!followRow,
    })
  })

  // POST /api/hashtags/:tag/follow — hashtag takip et
  app.post<{ Params: { tag: string } }>('/api/hashtags/:tag/follow', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const tag = req.params.tag.toLowerCase().replace(/^#/, '').trim()
    if (!tag || tag.length > 100) return reply.code(400).send({ error: 'Geçersiz hashtag' })

    await db
      .insert(hashtagFollows)
      .values({ actorId: ctx.actor.id, hashtag: tag })
      .onConflictDoNothing()

    return reply.send({ following: true, tag })
  })

  // DELETE /api/hashtags/:tag/follow — hashtag takibini bırak
  app.delete<{ Params: { tag: string } }>('/api/hashtags/:tag/follow', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const tag = req.params.tag.toLowerCase().replace(/^#/, '').trim()

    await db
      .delete(hashtagFollows)
      .where(and(eq(hashtagFollows.actorId, ctx.actor.id), eq(hashtagFollows.hashtag, tag)))

    return reply.send({ following: false, tag })
  })
}
