import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { feedRules } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { DEFAULT_RULES, PRESETS, type FeedRulesConfig } from '../lib/feedRules.js'

const rulesConfigSchema = z.object({
  sort: z.enum(['chronological', 'engagement', 'mixed']),
  hideReplies: z.boolean(),
  sources: z.object({
    following: z.boolean(),
    lists: z.array(z.string().uuid()),
  }),
})

export async function feedRulesRoutes(app: FastifyInstance) {
  // GET /api/feed-rules/presets
  app.get('/api/feed-rules/presets', async (_req, reply) => {
    return reply.send({ presets: PRESETS })
  })

  // GET /api/feed-rules
  app.get('/api/feed-rules', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rules = await db.query.feedRules.findMany({
      where: eq(feedRules.actorId, ctx.actor.id),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    })

    return reply.send({ feedRules: rules })
  })

  // POST /api/feed-rules
  app.post('/api/feed-rules', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({ name: z.string().min(1).max(255), rules: rulesConfigSchema })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    // First rule becomes default automatically
    const existing = await db.query.feedRules.findFirst({
      where: eq(feedRules.actorId, ctx.actor.id),
    })

    const [created] = await db
      .insert(feedRules)
      .values({
        actorId: ctx.actor.id,
        name: body.data.name,
        rules: body.data.rules,
        isDefault: !existing,
      })
      .returning()

    return reply.code(201).send(created)
  })

  // PATCH /api/feed-rules/:id
  app.patch<{ Params: { id: string } }>('/api/feed-rules/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({
        name: z.string().min(1).max(255).optional(),
        rules: rulesConfigSchema.optional(),
      })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const rule = await db.query.feedRules.findFirst({
      where: and(eq(feedRules.id, req.params.id), eq(feedRules.actorId, ctx.actor.id)),
    })
    if (!rule) return reply.code(404).send({ error: 'Not found' })

    const [updated] = await db
      .update(feedRules)
      .set({
        ...(body.data.name !== undefined && { name: body.data.name }),
        ...(body.data.rules !== undefined && { rules: body.data.rules }),
        updatedAt: new Date(),
      })
      .where(eq(feedRules.id, req.params.id))
      .returning()

    return reply.send(updated)
  })

  // POST /api/feed-rules/:id/default — set as default
  app.post<{ Params: { id: string } }>('/api/feed-rules/:id/default', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rule = await db.query.feedRules.findFirst({
      where: and(eq(feedRules.id, req.params.id), eq(feedRules.actorId, ctx.actor.id)),
    })
    if (!rule) return reply.code(404).send({ error: 'Not found' })

    // Clear existing default, set new one
    await db
      .update(feedRules)
      .set({ isDefault: false })
      .where(eq(feedRules.actorId, ctx.actor.id))

    await db
      .update(feedRules)
      .set({ isDefault: true })
      .where(eq(feedRules.id, req.params.id))

    return reply.code(204).send()
  })

  // DELETE /api/feed-rules/:id
  app.delete<{ Params: { id: string } }>('/api/feed-rules/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(feedRules)
      .where(and(eq(feedRules.id, req.params.id), eq(feedRules.actorId, ctx.actor.id)))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' })

    // If deleted rule was default, promote next rule
    if (deleted[0]?.isDefault) {
      const next = await db.query.feedRules.findFirst({
        where: eq(feedRules.actorId, ctx.actor.id),
      })
      if (next) {
        await db.update(feedRules).set({ isDefault: true }).where(eq(feedRules.id, next.id))
      }
    }

    return reply.code(204).send()
  })

  // POST /api/feed-rules/preset — apply a preset (creates or updates default rule)
  app.post('/api/feed-rules/preset', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ preset: z.enum(['chronological', 'originals', 'trending', 'mixed']) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid preset' })

    const preset = PRESETS[body.data.preset]!
    const config: FeedRulesConfig = { ...preset.config }

    const existing = await db.query.feedRules.findFirst({
      where: and(eq(feedRules.actorId, ctx.actor.id), eq(feedRules.isDefault, true)),
    })

    if (existing) {
      await db
        .update(feedRules)
        .set({ name: preset.name, rules: config, updatedAt: new Date() })
        .where(eq(feedRules.id, existing.id))
      return reply.code(204).send()
    }

    await db.insert(feedRules).values({
      actorId: ctx.actor.id,
      name: preset.name,
      rules: config,
      isDefault: true,
    })

    return reply.code(204).send()
  })
}
