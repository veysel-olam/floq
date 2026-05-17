import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { spaces, actors } from '../db/schema.js'
import { requireActor, getSession } from '../lib/session.js'
import { publishSpace, subscribeSpace } from '../lib/pubsub.js'
import { redis } from '../lib/redis.js'
import { randomUUID } from 'node:crypto'

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
})

const signalSchema = z.object({
  targetActorId: z.string(),
  payload: z.unknown(),
})

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) + '-' + randomUUID().slice(0, 6)
}

function membersKey(spaceId: string) {
  return `halka:${spaceId}:members`
}

export async function spacesRoutes(app: FastifyInstance) {
  // GET /api/halka — list live rooms
  app.get('/api/halka', async (_req, reply) => {
    const live = await db.query.spaces.findMany({
      where: eq(spaces.isLive, true),
      orderBy: [desc(spaces.createdAt)],
      limit: 20,
      with: { host: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })
    return reply.send({ spaces: live })
  })

  // POST /api/halka — create and go live
  app.post('/api/halka', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = createSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const existing = await db.query.spaces.findFirst({
      where: and(eq(spaces.hostId, ctx.actor.id), eq(spaces.isLive, true)),
    })
    if (existing) return reply.code(409).send({ error: 'Zaten canlı bir halkan var.', space: existing })

    const [space] = await db
      .insert(spaces)
      .values({ hostId: ctx.actor.id, slug: generateSlug(body.data.title), ...body.data })
      .returning()

    return reply.code(201).send(space)
  })

  // GET /api/halka/:slug — room detail
  app.get<{ Params: { slug: string } }>('/api/halka/:slug', async (req, reply) => {
    const space = await db.query.spaces.findFirst({
      where: eq(spaces.slug, req.params.slug),
      with: { host: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })
    if (!space) return reply.code(404).send({ error: 'Not found' })
    return reply.send(space)
  })

  // POST /api/halka/:slug/signal — relay WebRTC signaling data
  app.post<{ Params: { slug: string } }>('/api/halka/:slug/signal', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = signalSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const space = await db.query.spaces.findFirst({
      where: and(eq(spaces.slug, req.params.slug), eq(spaces.isLive, true)),
      columns: { id: true },
    })
    if (!space) return reply.code(404).send({ error: 'Not found' })

    await publishSpace(space.id, {
      type: 'signal',
      from: ctx.actor.id,
      to: body.data.targetActorId,
      payload: body.data.payload,
    })

    return reply.code(204).send()
  })

  // GET /api/halka/:slug/stream — SSE: auto-join on connect, auto-leave on disconnect
  app.get<{ Params: { slug: string } }>('/api/halka/:slug/stream', async (req, reply) => {
    const session = await getSession(req)
    if (!session) return reply.code(401).send({ error: 'Unauthorized' })

    const actor = await db.query.actors.findFirst({
      where: eq(actors.userId, session.user.id),
      columns: { id: true, handle: true, displayName: true, avatarUrl: true },
    })
    if (!actor) return reply.code(403).send({ error: 'No actor' })

    const space = await db.query.spaces.findFirst({
      where: and(eq(spaces.slug, req.params.slug), eq(spaces.isLive, true)),
      columns: { id: true, participantsCount: true },
    })
    if (!space) return reply.code(404).send({ error: 'Not found' })

    // Snapshot current members before adding self
    const currentMembers = await redis.hGetAll(membersKey(space.id))
    const participants = Object.entries(currentMembers)
      .filter(([id]) => id !== actor.id)
      .map(([actorId, json]) => ({ actorId, ...(JSON.parse(json) as object) }))

    // Register self
    await redis.hSet(membersKey(space.id), actor.id, JSON.stringify({
      handle: actor.handle,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
    }))
    const newCount = Object.keys(currentMembers).length + 1
    await db.update(spaces).set({ participantsCount: newCount }).where(eq(spaces.id, space.id))

    // SSE headers
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Send current state to this client only
    res.write(`event: connected\ndata: ${JSON.stringify({ myActorId: actor.id, participants })}\n\n`)

    // Announce arrival to everyone else
    await publishSpace(space.id, {
      type: 'peer-joined',
      actorId: actor.id,
      handle: actor.handle,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
    })

    // Forward room events to this client
    const unsub = subscribeSpace(space.id, (data) => {
      const evt = data as { type: string; actorId?: string }
      // Don't echo own peer-joined back
      if (evt.type === 'peer-joined' && evt.actorId === actor.id) return
      res.write(`event: ${evt.type}\ndata: ${JSON.stringify(data)}\n\n`)
    })

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000)

    req.raw.on('close', async () => {
      clearInterval(heartbeat)
      unsub()
      await redis.hDel(membersKey(space.id), actor.id)
      const remaining = await redis.hLen(membersKey(space.id))
      await db.update(spaces)
        .set({ participantsCount: remaining })
        .where(eq(spaces.id, space.id))
      await publishSpace(space.id, { type: 'peer-left', actorId: actor.id })
    })

    await new Promise<void>((resolve) => req.raw.on('close', resolve))
  })

  // DELETE /api/halka/:slug — end room (host only)
  app.delete<{ Params: { slug: string } }>('/api/halka/:slug', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const space = await db.query.spaces.findFirst({
      where: and(eq(spaces.slug, req.params.slug), eq(spaces.hostId, ctx.actor.id)),
      columns: { id: true },
    })

    if (space) {
      await db.update(spaces)
        .set({ isLive: false, endedAt: new Date() })
        .where(eq(spaces.id, space.id))
      await redis.del(membersKey(space.id))
      await publishSpace(space.id, { type: 'halka-ended' })
    }

    return reply.code(204).send()
  })
}
