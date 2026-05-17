import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { postCollections, postCollectionItems, posts, actors } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { enrichPosts } from '../lib/enrichPosts.js'

export async function postCollectionsRoutes(app: FastifyInstance) {
  // GET /api/collections — list own collections
  app.get('/api/collections', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const cols = await db.query.postCollections.findMany({
      where: eq(postCollections.actorId, ctx.actor.id),
      orderBy: desc(postCollections.createdAt),
    })

    const withCounts = await Promise.all(cols.map(async (c) => {
      const items = await db.query.postCollectionItems.findMany({
        where: eq(postCollectionItems.collectionId, c.id),
        columns: { id: true },
      })
      return { ...c, postCount: items.length }
    }))

    return reply.send({ collections: withCounts })
  })

  // GET /api/collections/actor/:handle — list public collections of another user
  app.get<{ Params: { handle: string } }>('/api/collections/actor/:handle', async (req, reply) => {
    const actor = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!actor) return reply.status(404).send({ error: 'not_found' })

    const cols = await db.query.postCollections.findMany({
      where: and(eq(postCollections.actorId, actor.id), eq(postCollections.isPublic, true)),
      orderBy: desc(postCollections.createdAt),
    })

    const withCounts = await Promise.all(cols.map(async (c) => {
      const items = await db.query.postCollectionItems.findMany({
        where: eq(postCollectionItems.collectionId, c.id),
        columns: { id: true },
      })
      return { ...c, postCount: items.length }
    }))

    return reply.send({ collections: withCounts })
  })

  // POST /api/collections — create
  app.post<{ Body: { name: string; description?: string; isPublic?: boolean } }>(
    '/api/collections',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const body = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional(),
      }).parse(req.body)

      const [col] = await db.insert(postCollections).values({
        actorId: ctx.actor.id,
        name: body.name,
        description: body.description ?? null,
        isPublic: body.isPublic ?? true,
      }).returning()

      return reply.status(201).send(col)
    },
  )

  // PATCH /api/collections/:id — rename/update
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string; isPublic?: boolean } }>(
    '/api/collections/:id',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const col = await db.query.postCollections.findFirst({
        where: and(eq(postCollections.id, req.params.id), eq(postCollections.actorId, ctx.actor.id)),
      })
      if (!col) return reply.status(404).send({ error: 'not_found' })

      const body = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
      }).parse(req.body)

      const [updated] = await db.update(postCollections)
        .set({ ...(body.name ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}), ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}) })
        .where(eq(postCollections.id, col.id))
        .returning()

      return reply.send(updated)
    },
  )

  // DELETE /api/collections/:id
  app.delete<{ Params: { id: string } }>('/api/collections/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const col = await db.query.postCollections.findFirst({
      where: and(eq(postCollections.id, req.params.id), eq(postCollections.actorId, ctx.actor.id)),
    })
    if (!col) return reply.status(404).send({ error: 'not_found' })

    await db.delete(postCollections).where(eq(postCollections.id, col.id))
    return reply.status(204).send()
  })

  // GET /api/collections/:id/posts — list posts in collection
  app.get<{ Params: { id: string }; Querystring: { cursor?: string } }>(
    '/api/collections/:id/posts',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const col = await db.query.postCollections.findFirst({
        where: eq(postCollections.id, req.params.id),
      })
      if (!col) return reply.status(404).send({ error: 'not_found' })

      // Only owner or public collections
      if (col.actorId !== ctx.actor.id && !col.isPublic) {
        return reply.status(403).send({ error: 'forbidden' })
      }

      const items = await db.query.postCollectionItems.findMany({
        where: eq(postCollectionItems.collectionId, col.id),
        orderBy: desc(postCollectionItems.addedAt),
        limit: 20,
      })

      const postIds = items.map((i) => i.postId)
      if (postIds.length === 0) return reply.send({ posts: [], collection: col })

      const rawPosts = await db.query.posts.findMany({
        where: (p, { inArray }) => inArray(p.id, postIds),
      })

      const enriched = await enrichPosts(rawPosts, ctx.actor.id)
      return reply.send({ posts: enriched, collection: col })
    },
  )

  // POST /api/collections/:id/posts — add post
  app.post<{ Params: { id: string }; Body: { postId: string } }>(
    '/api/collections/:id/posts',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const col = await db.query.postCollections.findFirst({
        where: and(eq(postCollections.id, req.params.id), eq(postCollections.actorId, ctx.actor.id)),
      })
      if (!col) return reply.status(404).send({ error: 'not_found' })

      const { postId } = z.object({ postId: z.string().uuid() }).parse(req.body)

      // Verify post exists and belongs to the user
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.authorId, ctx.actor.id)),
      })
      if (!post) return reply.status(404).send({ error: 'post_not_found' })

      await db.insert(postCollectionItems).values({ collectionId: col.id, postId }).onConflictDoNothing()
      return reply.status(201).send({ ok: true })
    },
  )

  // DELETE /api/collections/:id/posts/:postId — remove post
  app.delete<{ Params: { id: string; postId: string } }>(
    '/api/collections/:id/posts/:postId',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const col = await db.query.postCollections.findFirst({
        where: and(eq(postCollections.id, req.params.id), eq(postCollections.actorId, ctx.actor.id)),
      })
      if (!col) return reply.status(404).send({ error: 'not_found' })

      await db.delete(postCollectionItems).where(
        and(eq(postCollectionItems.collectionId, col.id), eq(postCollectionItems.postId, req.params.postId)),
      )
      return reply.status(204).send()
    },
  )
}
