import type { FastifyInstance } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { actors, blocks, mutes, reports, posts } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function moderationRoutes(app: FastifyInstance) {
  // ─── Blocks ────────────────────────────────────────────────────────────────

  // GET /api/blocks — list blocked actors
  app.get('/api/blocks', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db
      .select({ actor: actors })
      .from(blocks)
      .innerJoin(actors, eq(blocks.blockedId, actors.id))
      .where(eq(blocks.blockerId, ctx.actor.id))
      .orderBy(desc(blocks.createdAt))

    return reply.send({ blocked: rows.map((r) => r.actor) })
  })

  // POST /api/blocks/:handle — block
  app.post<{ Params: { handle: string } }>('/api/blocks/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })
    if (target.id === ctx.actor.id) return reply.code(400).send({ error: 'Cannot block yourself' })

    await db.insert(blocks).values({ blockerId: ctx.actor.id, blockedId: target.id }).onConflictDoNothing()

    return reply.send({ ok: true })
  })

  // DELETE /api/blocks/:handle — unblock
  app.delete<{ Params: { handle: string } }>('/api/blocks/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })

    await db.delete(blocks).where(and(eq(blocks.blockerId, ctx.actor.id), eq(blocks.blockedId, target.id)))

    return reply.send({ ok: true })
  })

  // ─── Mutes ─────────────────────────────────────────────────────────────────

  // GET /api/mutes — list muted actors
  app.get('/api/mutes', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db
      .select({ actor: actors, hideNotifications: mutes.hideNotifications, expiresAt: mutes.expiresAt })
      .from(mutes)
      .innerJoin(actors, eq(mutes.mutedId, actors.id))
      .where(eq(mutes.muterId, ctx.actor.id))
      .orderBy(desc(mutes.createdAt))

    return reply.send({ muted: rows })
  })

  // POST /api/mutes/:handle — mute
  app.post<{
    Params: { handle: string }
    Body: { hideNotifications?: boolean; duration?: number }
  }>('/api/mutes/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })
    if (target.id === ctx.actor.id) return reply.code(400).send({ error: 'Cannot mute yourself' })

    const body = req.body as { hideNotifications?: boolean; duration?: number } | undefined
    const hideNotifications = body?.hideNotifications ?? true
    const expiresAt = body?.duration ? new Date(Date.now() + body.duration * 1000) : null

    await db
      .insert(mutes)
      .values({ muterId: ctx.actor.id, mutedId: target.id, hideNotifications, expiresAt })
      .onConflictDoNothing()

    return reply.send({ ok: true })
  })

  // DELETE /api/mutes/:handle — unmute
  app.delete<{ Params: { handle: string } }>('/api/mutes/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })

    await db.delete(mutes).where(and(eq(mutes.muterId, ctx.actor.id), eq(mutes.mutedId, target.id)))

    return reply.send({ ok: true })
  })

  // ─── Reports ───────────────────────────────────────────────────────────────

  // POST /api/reports — submit a report
  app.post('/api/reports', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      postId: z.string().uuid().optional(),
      reportedActorHandle: z.string().optional(),
      reason: z.enum(['spam', 'harassment', 'hate_speech', 'misinformation', 'nsfw', 'violence', 'other']),
      details: z.string().max(500).optional(),
    }).refine(d => d.postId || d.reportedActorHandle, { message: 'Provide postId or reportedActorHandle' })
      .safeParse(req.body)

    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    let reportedActorId: string | undefined
    if (body.data.reportedActorHandle) {
      const target = await db.query.actors.findFirst({ where: eq(actors.handle, body.data.reportedActorHandle) })
      if (!target) return reply.code(404).send({ error: 'User not found' })
      reportedActorId = target.id
    }

    // Prevent duplicate pending reports from same user for same post
    if (body.data.postId) {
      const existing = await db.query.reports.findFirst({
        where: and(
          eq(reports.reporterId, ctx.actor.id),
          eq(reports.postId, body.data.postId),
          eq(reports.status, 'pending'),
        ),
      })
      if (existing) return reply.code(409).send({ error: 'Already reported' })
    }

    const [report] = await db.insert(reports).values({
      reporterId: ctx.actor.id,
      postId: body.data.postId ?? null,
      reportedActorId: reportedActorId ?? null,
      reason: body.data.reason,
      details: body.data.details ?? null,
    }).returning()

    // Auto-hide: if a post gets 5+ pending reports, add content warning
    if (body.data.postId) {
      const count = await db.select({ count: sql`count(*)` }).from(reports)
        .where(and(eq(reports.postId, body.data.postId), eq(reports.status, 'pending')))
      const n = Number((count[0] as { count: string }).count)
      if (n >= 5) {
        await db.update(posts).set({ sensitive: true, contentWarning: 'Raporlanan içerik' })
          .where(and(eq(posts.id, body.data.postId), eq(posts.sensitive, false)))
      }
    }

    return reply.code(201).send(report)
  })
}
