import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { notifications, actors } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /api/notifications
  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    '/api/notifications',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const limit = Math.min(Number(req.query.limit ?? 30), 50)

      const rows = await db.query.notifications.findMany({
        where: eq(notifications.recipientId, ctx.actor.id),
        orderBy: [desc(notifications.createdAt)],
        limit: limit + 1,
        with: { actor: true, post: true },
      })

      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)

      return reply.send({
        notifications: items,
        nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
      })
    },
  )

  // GET /api/notifications/unread-count
  app.get('/api/notifications/unread-count', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const unread = await db.query.notifications.findMany({
      where: and(eq(notifications.recipientId, ctx.actor.id), eq(notifications.read, false)),
    })

    return reply.send({ count: unread.length })
  })

  // POST /api/notifications/read-all — tümünü okundu işaretle
  app.post('/api/notifications/read-all', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.recipientId, ctx.actor.id), eq(notifications.read, false)),
      )

    return reply.code(204).send()
  })

  // PATCH /api/notifications/:id/read — tek bildirimi okundu işaretle
  app.patch<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, req.params.id),
            eq(notifications.recipientId, ctx.actor.id),
          ),
        )

      return reply.code(204).send()
    },
  )

  // DELETE /api/notifications/:id — bildirimi sil
  app.delete<{ Params: { id: string } }>(
    '/api/notifications/:id',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, req.params.id),
            eq(notifications.recipientId, ctx.actor.id),
          ),
        )

      return reply.code(204).send()
    },
  )
}
