import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { keywordFilters } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

interface FilterBody {
  keyword: string
  wholeWord?: boolean
  contexts?: string
  action?: 'warn' | 'hide'
  expiresAt?: string | null
}

export async function filtersRoutes(app: FastifyInstance) {
  // GET /api/filters — list filters
  app.get('/api/filters', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const filters = await db.query.keywordFilters.findMany({
      where: eq(keywordFilters.actorId, ctx.actor.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })

    return reply.send({ filters })
  })

  // POST /api/filters — create filter
  app.post<{ Body: FilterBody }>('/api/filters', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = req.body
    if (!body?.keyword?.trim()) return reply.code(400).send({ error: 'keyword required' })

    const [filter] = await db.insert(keywordFilters).values({
      actorId: ctx.actor.id,
      keyword: body.keyword.trim(),
      wholeWord: body.wholeWord ?? false,
      contexts: body.contexts ?? 'home',
      action: body.action ?? 'warn',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    }).returning()

    return reply.code(201).send(filter)
  })

  // PATCH /api/filters/:id — update
  app.patch<{ Params: { id: string }; Body: Partial<FilterBody> }>('/api/filters/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const filter = await db.query.keywordFilters.findFirst({
      where: and(eq(keywordFilters.id, req.params.id), eq(keywordFilters.actorId, ctx.actor.id)),
    })
    if (!filter) return reply.code(404).send({ error: 'Not found' })

    const body = req.body
    const [updated] = await db
      .update(keywordFilters)
      .set({
        keyword: body.keyword?.trim() ?? filter.keyword,
        wholeWord: body.wholeWord ?? filter.wholeWord,
        contexts: body.contexts ?? filter.contexts,
        action: body.action ?? filter.action,
        expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(body.expiresAt) : null) : filter.expiresAt,
      })
      .where(eq(keywordFilters.id, filter.id))
      .returning()

    return reply.send(updated)
  })

  // DELETE /api/filters/:id — delete
  app.delete<{ Params: { id: string } }>('/api/filters/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    await db
      .delete(keywordFilters)
      .where(and(eq(keywordFilters.id, req.params.id), eq(keywordFilters.actorId, ctx.actor.id)))

    return reply.code(204).send()
  })
}
