import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { closeFriends, actors, follows } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function closeFriendsRoutes(app: FastifyInstance) {
  // GET /api/close-friends — benim yakın çevrem
  app.get('/api/close-friends', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db.query.closeFriends.findMany({
      where: eq(closeFriends.actorId, ctx.actor.id),
      with: { target: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
      orderBy: [closeFriends.createdAt],
    })

    return reply.send({ closeFriends: rows.map((r) => r.target) })
  })

  // PUT /api/close-friends/:handle — ekle
  app.put<{ Params: { handle: string } }>('/api/close-friends/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!target) return reply.code(404).send({ error: 'Actor not found' })
    if (target.id === ctx.actor.id) return reply.code(400).send({ error: 'Cannot add yourself' })

    // Must follow the target
    const follow = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id), eq(follows.status, 'accepted')),
    })
    if (!follow) return reply.code(403).send({ error: 'You must follow this person first' })

    await db.insert(closeFriends).values({ actorId: ctx.actor.id, targetId: target.id }).onConflictDoNothing()
    return reply.code(201).send({ ok: true })
  })

  // DELETE /api/close-friends/:handle — çıkar
  app.delete<{ Params: { handle: string } }>('/api/close-friends/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!target) return reply.code(404).send({ error: 'Actor not found' })

    await db.delete(closeFriends).where(and(eq(closeFriends.actorId, ctx.actor.id), eq(closeFriends.targetId, target.id)))
    return reply.code(204).send()
  })

  // GET /api/close-friends/check/:handle — bu kişi benim yakın çevremde mi?
  app.get<{ Params: { handle: string } }>('/api/close-friends/check/:handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!target) return reply.send({ isCloseFriend: false })

    const row = await db.query.closeFriends.findFirst({
      where: and(eq(closeFriends.actorId, ctx.actor.id), eq(closeFriends.targetId, target.id)),
    })
    return reply.send({ isCloseFriend: !!row })
  })
}
