import type { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { lists, listMembers, actors, follows } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function listsRoutes(app: FastifyInstance) {
  // GET /api/lists
  app.get('/api/lists', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const userLists = await db.query.lists.findMany({
      where: eq(lists.ownerId, ctx.actor.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })

    // Attach member counts
    const listIds = userLists.map((l) => l.id)
    const members =
      listIds.length > 0
        ? await db.query.listMembers.findMany({ where: inArray(listMembers.listId, listIds) })
        : []
    const countMap = new Map<string, number>()
    for (const m of members) {
      countMap.set(m.listId, (countMap.get(m.listId) ?? 0) + 1)
    }

    return reply.send({
      lists: userLists.map((l) => ({ ...l, memberCount: countMap.get(l.id) ?? 0 })),
    })
  })

  // POST /api/lists
  app.post('/api/lists', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ title: z.string().min(1).max(255) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const [list] = await db
      .insert(lists)
      .values({ ownerId: ctx.actor.id, title: body.data.title })
      .returning()

    return reply.code(201).send(list)
  })

  // PATCH /api/lists/:id
  app.patch<{ Params: { id: string } }>('/api/lists/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ title: z.string().min(1).max(255) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const [updated] = await db
      .update(lists)
      .set({ title: body.data.title })
      .where(and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)))
      .returning()

    if (!updated) return reply.code(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  // DELETE /api/lists/:id
  app.delete<{ Params: { id: string } }>('/api/lists/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(lists)
      .where(and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' })
    return reply.code(204).send()
  })

  // GET /api/lists/:id/members
  app.get<{ Params: { id: string } }>('/api/lists/:id/members', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)),
    })
    if (!list) return reply.code(404).send({ error: 'Not found' })

    const members = await db.query.listMembers.findMany({
      where: eq(listMembers.listId, req.params.id),
    })
    const memberActorIds = members.map((m) => m.actorId)
    const memberActors =
      memberActorIds.length > 0
        ? await db.query.actors.findMany({ where: inArray(actors.id, memberActorIds) })
        : []

    return reply.send({ list, members: memberActors })
  })

  // POST /api/lists/:id/members — add by handle
  app.post<{ Params: { id: string } }>('/api/lists/:id/members', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ handle: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)),
    })
    if (!list) return reply.code(404).send({ error: 'Not found' })

    const target = await db.query.actors.findFirst({
      where: eq(actors.handle, body.data.handle),
    })
    if (!target) return reply.code(404).send({ error: 'Actor not found' })

    // Must be following the actor to add them
    const follow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, ctx.actor.id),
        eq(follows.followingId, target.id),
        eq(follows.status, 'accepted'),
      ),
    })
    if (!follow) return reply.code(403).send({ error: 'You must follow this user to add them' })

    // Idempotent insert
    await db
      .insert(listMembers)
      .values({ listId: req.params.id, actorId: target.id })
      .onConflictDoNothing()

    return reply.code(204).send()
  })

  // DELETE /api/lists/:id/members/:actorId
  app.delete<{ Params: { id: string; actorId: string } }>(
    '/api/lists/:id/members/:actorId',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const list = await db.query.lists.findFirst({
        where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)),
      })
      if (!list) return reply.code(404).send({ error: 'Not found' })

      await db
        .delete(listMembers)
        .where(
          and(
            eq(listMembers.listId, req.params.id),
            eq(listMembers.actorId, req.params.actorId),
          ),
        )

      return reply.code(204).send()
    },
  )
}
