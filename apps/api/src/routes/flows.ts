import type { FastifyInstance } from 'fastify'
import { eq, and, desc, lt, sql, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import {
  flows,
  flowMemberships,
  flowSubscriptions,
  flowPinnedPosts,
  flowInvites,
  posts,
  actors,
  notifications,
} from '../db/schema.js'
import { requireActor, getSession } from '../lib/session.js'
import { env } from '../lib/env.js'

const createFlowSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
})

export async function flowsRoutes(app: FastifyInstance) {
  // GET /api/flows — discover public flows + joined flows
  app.get('/api/flows', async (req, reply) => {
    const session = await getSession(req)
    const query = (req.query as Record<string, string>)['q']
    const limit = 20

    let actorId: string | undefined
    if (session) {
      const actor = await db.query.actors.findFirst({
        where: eq(actors.userId, session.user.id),
      })
      actorId = actor?.id
    }

    const conditions = [eq(flows.isPublic, true)]
    if (query) {
      conditions.push(
        or(
          ilike(flows.name, `%${query}%`),
          ilike(flows.slug, `%${query}%`),
          ilike(flows.description ?? '', `%${query}%`),
        )!,
      )
    }

    const sortBy = (req.query as Record<string, string>)['sort']
    const publicFlows = await db.query.flows.findMany({
      where: and(...conditions),
      orderBy: sortBy === 'trending' ? [desc(flows.postsCount)] : [desc(flows.membersCount)],
      limit,
      with: { owner: true },
    })

    let joinedFlows: typeof publicFlows = []
    if (actorId) {
      const memberships = await db.query.flowMemberships.findMany({
        where: eq(flowMemberships.actorId, actorId),
        with: { flow: { with: { owner: true } } },
      })
      joinedFlows = memberships.map((m) => m.flow)
    }

    const joinedIds = new Set(joinedFlows.map((f) => f.id))
    const discover = publicFlows.filter((f) => !joinedIds.has(f.id))

    return reply.send({ joined: joinedFlows, discover })
  })

  // GET /api/flows/:slug — flow detail
  app.get<{ Params: { slug: string } }>('/api/flows/:slug', async (req, reply) => {
    const flow = await db.query.flows.findFirst({
      where: eq(flows.slug, req.params.slug),
      with: { owner: true },
    })
    if (!flow) return reply.code(404).send({ error: 'Not found' })

    const session = await getSession(req)
    let isMember = false
    let isSubscribed = false
    let role: string | null = null
    if (session) {
      const actor = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      if (actor) {
        const membership = await db.query.flowMemberships.findFirst({
          where: and(eq(flowMemberships.flowId, flow.id), eq(flowMemberships.actorId, actor.id)),
        })
        isMember = !!membership
        role = membership?.role ?? null
        const subscription = await db.query.flowSubscriptions.findFirst({
          where: and(eq(flowSubscriptions.flowId, flow.id), eq(flowSubscriptions.actorId, actor.id)),
        })
        isSubscribed = !!subscription
      }
    }

    return reply.send({ ...flow, isMember, role, isSubscribed })
  })

  // POST /api/flows — create flow
  app.post('/api/flows', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = createFlowSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body', issues: body.error.issues })

    const existing = await db.query.flows.findFirst({ where: eq(flows.slug, body.data.slug) })
    if (existing) return reply.code(409).send({ error: 'Slug already taken' })

    const [flow] = await db
      .insert(flows)
      .values({
        ...body.data,
        description: body.data.description ?? null,
        ownerId: ctx.actor.id,
        membersCount: 1,
      })
      .returning()

    // Owner auto-joins as owner
    await db.insert(flowMemberships).values({
      flowId: flow!.id,
      actorId: ctx.actor.id,
      role: 'owner',
    })

    return reply.code(201).send(flow)
  })

  // PATCH /api/flows/:slug — update (owner only)
  app.patch<{ Params: { slug: string } }>('/api/flows/:slug', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })

    const body = createFlowSchema.partial().safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const [updated] = await db
      .update(flows)
      .set(body.data)
      .where(eq(flows.id, flow.id))
      .returning()

    return reply.send(updated)
  })

  // DELETE /api/flows/:slug — delete (owner only)
  app.delete<{ Params: { slug: string } }>('/api/flows/:slug', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })

    await db.delete(flows).where(eq(flows.id, flow.id))
    return reply.code(204).send()
  })

  // POST /api/flows/:slug/join
  app.post<{ Params: { slug: string } }>('/api/flows/:slug/join', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (!flow.isPublic) return reply.code(403).send({ error: 'Flow is private' })

    await db
      .insert(flowMemberships)
      .values({ flowId: flow.id, actorId: ctx.actor.id, role: 'member' })
      .onConflictDoNothing()

    await db
      .update(flows)
      .set({ membersCount: sql`${flows.membersCount} + 1` })
      .where(eq(flows.id, flow.id))

    return reply.code(204).send()
  })

  // DELETE /api/flows/:slug/join — leave
  app.delete<{ Params: { slug: string } }>('/api/flows/:slug/join', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId === ctx.actor.id) return reply.code(400).send({ error: 'Owner cannot leave' })

    const deleted = await db
      .delete(flowMemberships)
      .where(and(eq(flowMemberships.flowId, flow.id), eq(flowMemberships.actorId, ctx.actor.id)))
      .returning()

    if (deleted.length > 0) {
      await db
        .update(flows)
        .set({ membersCount: sql`GREATEST(${flows.membersCount} - 1, 0)` })
        .where(eq(flows.id, flow.id))
    }

    return reply.code(204).send()
  })

  // GET /api/flows/:slug/timeline
  app.get<{
    Params: { slug: string }
    Querystring: { cursor?: string; limit?: string }
  }>('/api/flows/:slug/timeline', async (req, reply) => {
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })

    if (!flow.isPublic) {
      const session = await getSession(req)
      if (!session) return reply.code(401).send({ error: 'Unauthorized' })
      const actor = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      if (!actor) return reply.code(401).send({ error: 'Unauthorized' })
      const membership = await db.query.flowMemberships.findFirst({
        where: and(eq(flowMemberships.flowId, flow.id), eq(flowMemberships.actorId, actor.id)),
      })
      if (!membership) return reply.code(403).send({ error: 'Not a member' })
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const conditions = [
      eq(posts.flowId, flow.id),
      eq(posts.isDeleted, false),
      eq(posts.isEphemeral, false),
    ]
    if (req.query.cursor) {
      conditions.push(lt(posts.createdAt, new Date(req.query.cursor)))
    }

    const page = await db.query.posts.findMany({
      where: and(...conditions),
      orderBy: [desc(posts.createdAt)],
      limit: limit + 1,
      with: { author: true },
    })

    const hasMore = page.length > limit
    const items = page.slice(0, limit)
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null

    return reply.send({ flow, posts: items, nextCursor })
  })

  // POST /api/flows/:slug/posts — post to a flow
  app.post<{ Params: { slug: string } }>('/api/flows/:slug/posts', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })

    const membership = await db.query.flowMemberships.findFirst({
      where: and(eq(flowMemberships.flowId, flow.id), eq(flowMemberships.actorId, ctx.actor.id)),
    })
    if (!membership) return reply.code(403).send({ error: 'Not a member' })

    const body = z
      .object({
        content: z.string().min(1).max(500),
        contentWarning: z.string().max(500).optional(),
        sensitive: z.boolean().default(false),
      })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const [post] = await db
      .insert(posts)
      .values({
        authorId: ctx.actor.id,
        content: body.data.content,
        contentWarning: body.data.contentWarning ?? null,
        sensitive: body.data.sensitive,
        visibility: flow.isPublic ? 'public' : 'followers',
        isLocal: true,
        isEphemeral: false,
        flowId: flow.id,
        apId: 'placeholder',
      })
      .returning()

    const apId = `${env.APP_URL}/users/${ctx.actor.handle}/posts/${post!.id}`
    await db.update(posts).set({ apId, apUrl: apId }).where(eq(posts.id, post!.id))

    await db
      .update(flows)
      .set({ postsCount: sql`${flows.postsCount} + 1` })
      .where(eq(flows.id, flow.id))

    // Notify subscribers
    const subs = await db.query.flowSubscriptions.findMany({
      where: and(eq(flowSubscriptions.flowId, flow.id), sql`${flowSubscriptions.actorId} != ${ctx.actor.id}`),
    })
    if (subs.length > 0) {
      await db.insert(notifications).values(
        subs.map((s) => ({
          recipientId: s.actorId,
          actorId: ctx.actor.id,
          type: 'flow_post' as const,
          postId: post!.id,
          read: false,
        })),
      )
    }

    return reply.code(201).send({ ...post, apId })
  })

  // POST /api/flows/:slug/subscribe
  app.post<{ Params: { slug: string } }>('/api/flows/:slug/subscribe', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    await db.insert(flowSubscriptions).values({ flowId: flow.id, actorId: ctx.actor.id }).onConflictDoNothing()
    return reply.code(204).send()
  })

  // DELETE /api/flows/:slug/subscribe
  app.delete<{ Params: { slug: string } }>('/api/flows/:slug/subscribe', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    await db.delete(flowSubscriptions).where(and(eq(flowSubscriptions.flowId, flow.id), eq(flowSubscriptions.actorId, ctx.actor.id)))
    return reply.code(204).send()
  })

  // GET /api/flows/:slug/pinned
  app.get<{ Params: { slug: string } }>('/api/flows/:slug/pinned', async (req, reply) => {
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    const pinned = await db.query.flowPinnedPosts.findMany({
      where: eq(flowPinnedPosts.flowId, flow.id),
      with: { post: { with: { author: true } } },
      orderBy: [desc(flowPinnedPosts.pinnedAt)],
    })
    return reply.send(pinned.map((p) => p.post))
  })

  // POST /api/flows/:slug/posts/:postId/pin
  app.post<{ Params: { slug: string; postId: string } }>('/api/flows/:slug/posts/:postId/pin', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })
    await db.insert(flowPinnedPosts).values({ flowId: flow.id, postId: req.params.postId, pinnedBy: ctx.actor.id }).onConflictDoNothing()
    return reply.code(204).send()
  })

  // DELETE /api/flows/:slug/posts/:postId/pin
  app.delete<{ Params: { slug: string; postId: string } }>('/api/flows/:slug/posts/:postId/pin', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })
    await db.delete(flowPinnedPosts).where(and(eq(flowPinnedPosts.flowId, flow.id), eq(flowPinnedPosts.postId, req.params.postId)))
    return reply.code(204).send()
  })

  // DELETE /api/flows/:slug/posts/:postId — owner can remove any post from flow
  app.delete<{ Params: { slug: string; postId: string } }>('/api/flows/:slug/posts/:postId', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    const post = await db.query.posts.findFirst({ where: eq(posts.id, req.params.postId) })
    if (!post || post.flowId !== flow.id) return reply.code(404).send({ error: 'Not found' })
    const isOwner = flow.ownerId === ctx.actor.id
    const isAuthor = post.authorId === ctx.actor.id
    if (!isOwner && !isAuthor) return reply.code(403).send({ error: 'Forbidden' })
    await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, post.id))
    await db.update(flows).set({ postsCount: sql`GREATEST(${flows.postsCount} - 1, 0)` }).where(eq(flows.id, flow.id))
    return reply.code(204).send()
  })

  // GET /api/flows/:slug/members
  app.get<{ Params: { slug: string } }>('/api/flows/:slug/members', async (req, reply) => {
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    const members = await db.query.flowMemberships.findMany({
      where: eq(flowMemberships.flowId, flow.id),
      with: { actor: true },
      orderBy: [desc(flowMemberships.createdAt)],
      limit: 50,
    })
    return reply.send(members)
  })

  // POST /api/flows/:slug/invites — create invite (owner only)
  app.post<{ Params: { slug: string } }>('/api/flows/:slug/invites', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })
    const code = randomBytes(6).toString('hex') // 12-char hex code
    const [invite] = await db.insert(flowInvites).values({ flowId: flow.id, code, createdBy: ctx.actor.id }).returning()
    return reply.code(201).send(invite)
  })

  // GET /api/flows/:slug/invites — list invites (owner only)
  app.get<{ Params: { slug: string } }>('/api/flows/:slug/invites', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const flow = await db.query.flows.findFirst({ where: eq(flows.slug, req.params.slug) })
    if (!flow) return reply.code(404).send({ error: 'Not found' })
    if (flow.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Forbidden' })
    const invites = await db.query.flowInvites.findMany({
      where: eq(flowInvites.flowId, flow.id),
      orderBy: [desc(flowInvites.createdAt)],
    })
    return reply.send(invites)
  })

  // POST /api/flows/join-invite — join via invite code
  app.post('/api/flows/join-invite', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const { code } = req.body as { code: string }
    if (!code) return reply.code(400).send({ error: 'Code required' })
    const invite = await db.query.flowInvites.findFirst({ where: eq(flowInvites.code, code), with: { flow: true } })
    if (!invite) return reply.code(404).send({ error: 'Invalid invite code' })
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.code(400).send({ error: 'Invite expired' })
    if (invite.usedCount >= invite.maxUses) return reply.code(400).send({ error: 'Invite limit reached' })
    await db.insert(flowMemberships).values({ flowId: invite.flowId, actorId: ctx.actor.id, role: 'member' }).onConflictDoNothing()
    await db.update(flows).set({ membersCount: sql`${flows.membersCount} + 1` }).where(eq(flows.id, invite.flowId))
    await db.update(flowInvites).set({ usedCount: sql`${flowInvites.usedCount} + 1` }).where(eq(flowInvites.id, invite.id))
    return reply.send(invite.flow)
  })
}
