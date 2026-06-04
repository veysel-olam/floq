import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { BskyAgent } from '@atproto/api'
import { db } from '../db/client.js'
import { blueskyConnections } from '../db/schema.js'
import { requireMastodonUser } from '../lib/mastodonAuth.js'
import { importBlueskyPosts } from '../lib/bluesky.js'

export async function blueskyRoutes(app: FastifyInstance) {
  // GET /api/bluesky/connection — get current Bluesky connection
  app.get('/api/bluesky/connection', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const conn = await db.query.blueskyConnections.findFirst({
      where: eq(blueskyConnections.userId, ctx.userId),
    })
    if (!conn) return reply.send({ connected: false })

    return reply.send({
      connected: true,
      did: conn.did,
      handle: conn.handle,
      crosspost_enabled: conn.crosspostEnabled,
      import_enabled: conn.importEnabled,
    })
  })

  // POST /api/bluesky/connect — connect Bluesky account (app password auth)
  app.post('/api/bluesky/connect', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({
      identifier: z.string().min(1), // handle or DID
      app_password: z.string().min(1),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const agent = new BskyAgent({ service: 'https://bsky.social' })
    try {
      const res = await agent.login({
        identifier: body.data.identifier,
        password: body.data.app_password,
      })
      if (!res.success || !agent.session) {
        return reply.code(401).send({ error: 'Bluesky authentication failed' })
      }
    } catch {
      return reply.code(401).send({ error: 'Bluesky authentication failed' })
    }

    const session = agent.session!
    await db.insert(blueskyConnections)
      .values({
        userId: ctx.userId,
        did: session.did,
        handle: session.handle,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
      })
      .onConflictDoUpdate({
        target: blueskyConnections.userId,
        set: {
          did: session.did,
          handle: session.handle,
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,
          updatedAt: new Date(),
        },
      })

    return reply.send({
      connected: true,
      did: session.did,
      handle: session.handle,
      crosspost_enabled: true,
      import_enabled: false,
    })
  })

  // PATCH /api/bluesky/connection — update settings
  app.patch('/api/bluesky/connection', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({
      crosspost_enabled: z.boolean().optional(),
      import_enabled: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    await db.update(blueskyConnections)
      .set({
        ...(body.data.crosspost_enabled !== undefined ? { crosspostEnabled: body.data.crosspost_enabled } : {}),
        ...(body.data.import_enabled !== undefined ? { importEnabled: body.data.import_enabled } : {}),
        // Stamp the moment import is (re)enabled — the cutoff for outbound fan-out.
        ...(body.data.import_enabled === true ? { importEnabledAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(blueskyConnections.userId, ctx.userId))

    // Kick off an immediate first import so the user sees their posts appear
    // right away rather than waiting for the next 10-minute sweep.
    if (body.data.import_enabled === true) {
      void importBlueskyPosts(ctx.userId).catch(() => {})
    }

    return reply.send({ ok: true })
  })

  // DELETE /api/bluesky/connection — disconnect
  app.delete('/api/bluesky/connection', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    await db.delete(blueskyConnections).where(eq(blueskyConnections.userId, ctx.userId))
    return reply.send({ connected: false })
  })
}
