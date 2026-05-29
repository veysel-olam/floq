import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { composerDrafts } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

const draftSchema = z.object({
  content: z.string().max(5000).default(''),
  contentWarning: z.string().max(500).nullish(),
})

// Cross-device autosave for the in-progress home composer (separate from explicit isDraft posts).
export async function composerDraftRoutes(app: FastifyInstance) {
  // GET /api/composer-draft — current autosaved draft (or null)
  app.get('/api/composer-draft', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const row = await db.query.composerDrafts.findFirst({
      where: eq(composerDrafts.actorId, ctx.actor.id),
    })
    if (!row || (!row.content.trim() && !row.contentWarning)) return reply.send({ draft: null })
    return reply.send({
      draft: { content: row.content, contentWarning: row.contentWarning, updatedAt: row.updatedAt.toISOString() },
    })
  })

  // PUT /api/composer-draft — upsert autosave
  app.put('/api/composer-draft', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const body = draftSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const { content, contentWarning } = body.data
    // Empty draft → clear instead of storing noise
    if (!content.trim() && !contentWarning) {
      await db.delete(composerDrafts).where(eq(composerDrafts.actorId, ctx.actor.id))
      return reply.send({ ok: true })
    }

    await db
      .insert(composerDrafts)
      .values({ actorId: ctx.actor.id, content, contentWarning: contentWarning ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: composerDrafts.actorId,
        set: { content, contentWarning: contentWarning ?? null, updatedAt: new Date() },
      })
    return reply.send({ ok: true })
  })

  // DELETE /api/composer-draft — clear after posting
  app.delete('/api/composer-draft', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    await db.delete(composerDrafts).where(eq(composerDrafts.actorId, ctx.actor.id))
    return reply.send({ ok: true })
  })
}
