import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { relays } from '../db/schema.js'
import { requireMastodonUser } from '../lib/mastodonAuth.js'
import { followRelay, unfollowRelay, fetchRemoteActor } from '../lib/federation.js'

export async function relayRoutes(app: FastifyInstance) {
  // GET /api/v1/admin/relays — list configured relays
  app.get('/api/v1/admin/relays', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const rows = await db.query.relays.findMany()
    return reply.send(rows.map((r) => ({
      id: r.id,
      inbox_url: r.inboxUrl,
      actor_url: r.actorUrl,
      status: r.status,
      created_at: r.createdAt.toISOString(),
    })))
  })

  // POST /api/v1/admin/relays — subscribe to a relay
  app.post('/api/v1/admin/relays', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const body = z.object({ inbox_url: z.string().url() }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'inbox_url is required' })

    const inboxUrl = body.data.inbox_url

    // Resolve relay actor URL from the inbox URL
    let actorUrl = inboxUrl.replace(/\/inbox$/, '/actor')
    try {
      const remoteActor = await fetchRemoteActor(actorUrl)
      if (remoteActor) actorUrl = remoteActor.apId
    } catch { /* use derived actor URL */ }

    await followRelay(inboxUrl, actorUrl)

    const relay = await db.query.relays.findFirst({ where: eq(relays.inboxUrl, inboxUrl) })
    return reply.code(200).send({
      id: relay!.id,
      inbox_url: relay!.inboxUrl,
      actor_url: relay!.actorUrl,
      status: relay!.status,
      created_at: relay!.createdAt.toISOString(),
    })
  })

  // DELETE /api/v1/admin/relays/:id — unsubscribe from a relay
  app.delete<{ Params: { id: string } }>('/api/v1/admin/relays/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const relay = await db.query.relays.findFirst({ where: eq(relays.id, req.params.id) })
    if (!relay) return reply.code(404).send({ error: 'Record not found' })

    await unfollowRelay(relay.inboxUrl, relay.actorUrl)
    return reply.code(200).send({})
  })
}
