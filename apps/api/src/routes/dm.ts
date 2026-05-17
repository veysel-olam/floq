import type { FastifyInstance } from 'fastify'
import { eq, and, or, desc, lt, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { posts, actors, actorPreferences, mediaAttachments, conversations, conversationMembers, follows } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { enrichPosts } from '../lib/enrichPosts.js'
import { env } from '../lib/env.js'

// A "conversation" is a pair of actors exchanging direct posts
// This returns the most recent message per conversation partner
export async function dmRoutes(app: FastifyInstance) {
  // GET /api/dm — list conversations (one item per partner, most recent first)
  app.get<{ Querystring: { cursor?: string } }>('/api/dm', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const myId = ctx.actor.id

    // Fetch all direct posts involving me (as author or recipient), limit 200 for grouping
    const rows = await db.query.posts.findMany({
      where: and(
        eq(posts.visibility, 'direct'),
        eq(posts.isDeleted, false),
        or(eq(posts.authorId, myId), eq(posts.recipientId, myId)),
      ),
      orderBy: [desc(posts.createdAt)],
      limit: 200,
    })

    // Group by partner, keep only the most recent per partner
    const partnerMap = new Map<string, typeof rows[0]>()
    for (const row of rows) {
      const partnerId = row.authorId === myId ? row.recipientId! : row.authorId
      if (partnerId && !partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, row)
      }
    }

    const partnerIds = [...partnerMap.keys()]
    const partnerActors = partnerIds.length > 0
      ? await db.query.actors.findMany({ where: (a, { inArray }) => inArray(a.id, partnerIds) })
      : []
    const actorMap = new Map(partnerActors.map((a) => [a.id, a]))

    // Determine which partners follow me (their messages are NOT requests)
    const followingMe = partnerIds.length > 0
      ? await db.query.follows.findMany({
          where: and(
            inArray(follows.followerId, partnerIds),
            eq(follows.followingId, myId),
          ),
          columns: { followerId: true },
        })
      : []
    const followingMeSet = new Set(followingMe.map((f) => f.followerId))

    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : 0
    const LIMIT = 20
    const conversations = [...partnerMap.entries()]
      .slice(cursor, cursor + LIMIT)
      .map(([partnerId, lastMessage]) => ({
        partner: actorMap.get(partnerId) ?? null,
        lastMessage: { id: lastMessage.id, content: lastMessage.content, encryptedContent: lastMessage.encryptedContent, createdAt: lastMessage.createdAt, authorId: lastMessage.authorId },
        isRequest: lastMessage.authorId !== myId && !followingMeSet.has(partnerId),
      }))
      .filter((c) => c.partner !== null)

    return reply.send({
      conversations,
      nextCursor: partnerMap.size > cursor + LIMIT ? String(cursor + LIMIT) : null,
    })
  })

  // GET /api/users/:handle/dm-key — public: fetch an actor's X25519 DM public key
  app.get<{ Params: { handle: string } }>('/api/users/:handle/dm-key', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { handle: true, dmPublicKey: true },
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })
    return reply.send({ handle: actor.handle, dmPublicKey: actor.dmPublicKey ?? null })
  })

  // POST /api/dm/keys — register E2E X25519 public key for current actor
  app.post('/api/dm/keys', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    // publicKey must be a base64url-encoded 32-byte X25519 public key
    const body = z.object({ publicKey: z.string().min(40).max(64) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })
    const [updated] = await db.update(actors)
      .set({ dmPublicKey: body.data.publicKey })
      .where(eq(actors.id, ctx.actor.id))
      .returning()
    return reply.send({ dmPublicKey: updated!.dmPublicKey })
  })

  // GET /api/dm/:handle — message thread with a specific user
  app.get<{ Params: { handle: string }; Querystring: { cursor?: string } }>(
    '/api/dm/:handle',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const partner = await db.query.actors.findFirst({
        where: eq(actors.handle, req.params.handle),
      })
      if (!partner) return reply.code(404).send({ error: 'Not found' })

      const myId = ctx.actor.id
      const LIMIT = 30
      const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined

      const conditions = [
        eq(posts.visibility, 'direct'),
        eq(posts.isDeleted, false),
        or(
          and(eq(posts.authorId, myId), eq(posts.recipientId, partner.id)),
          and(eq(posts.authorId, partner.id), eq(posts.recipientId, myId)),
        ),
        ...(cursor ? [lt(posts.createdAt, cursor)] : []),
      ]

      const messageRows = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: LIMIT + 1,
      })

      const hasMore = messageRows.length > LIMIT
      const items = messageRows.slice(0, LIMIT)
      const enriched = await enrichPosts(items, myId)

      return reply.send({
        partner,
        messages: enriched.reverse(), // oldest first for chat display
        nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
      })
    },
  )

  // POST /api/dm/:handle — send a direct message
  app.post<{ Params: { handle: string } }>('/api/dm/:handle', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      content: z.string().max(500).optional(),
      mediaIds: z.array(z.string().uuid()).max(1).optional(),
      // Sealed box E2E: all three fields required together
      encryptedContent: z.string().max(4096).optional(),
      encryptionIv: z.string().max(64).optional(),
      ephemeralPublicKey: z.string().max(64).optional(),
    }).refine(d =>
      (d.content && d.content.trim().length > 0) ||
      (d.encryptedContent && d.encryptionIv && d.ephemeralPublicKey) ||
      (d.mediaIds && d.mediaIds.length > 0),
      { message: 'Provide content, media, or encryptedContent+encryptionIv+ephemeralPublicKey' }
    ).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!partner) return reply.code(404).send({ error: 'Not found' })
    if (partner.id === ctx.actor.id) return reply.code(400).send({ error: 'Cannot DM yourself' })

    // Check if recipient has disabled DMs
    const recipientPrefs = await db.query.actorPreferences.findFirst({
      where: eq(actorPreferences.actorId, partner.id),
      columns: { dmEnabled: true },
    })
    if (recipientPrefs && !recipientPrefs.dmEnabled) {
      return reply.code(403).send({ error: 'Bu kullanıcı mesajlaşmayı kapatmış.' })
    }

    const { actor } = ctx

    // Validate media ownership
    const mediaIds = body.data.mediaIds ?? []
    if (mediaIds.length > 0) {
      const owned = await db.query.mediaAttachments.findMany({
        where: and(inArray(mediaAttachments.id, mediaIds), eq(mediaAttachments.actorId, actor.id)),
      })
      if (owned.length !== mediaIds.length) return reply.code(403).send({ error: 'Invalid media' })
    }

    const hasContent = !!(body.data.encryptedContent || (body.data.content && body.data.content.trim()))
    const contentText = body.data.encryptedContent ? '[Şifreli mesaj]'
      : hasContent ? body.data.content!
      : ''

    const [post] = await db
      .insert(posts)
      .values({
        authorId: actor.id,
        recipientId: partner.id,
        content: contentText,
        encryptedContent: body.data.encryptedContent ?? null,
        encryptionIv: body.data.encryptionIv ?? null,
        ephemeralPublicKey: body.data.ephemeralPublicKey ?? null,
        visibility: 'direct',
        tags: [],
        isLocal: true,
        apId: 'placeholder',
      })
      .returning()

    if (mediaIds.length > 0) {
      await db.update(mediaAttachments)
        .set({ postId: post!.id })
        .where(inArray(mediaAttachments.id, mediaIds))
    }

    const apId = `${env.APP_URL}/users/${actor.handle}/posts/${post!.id}`
    await db.update(posts).set({ apId, apUrl: apId }).where(eq(posts.id, post!.id))

    const [enriched] = await (await import('../lib/enrichPosts.js')).enrichPosts([post!], actor.id)
    return reply.code(201).send({ ...enriched, apId })
  })

  // ─── Group Conversations ────────────────────────────────────────────────────

  // POST /api/dm/conversations — create a group conversation
  app.post('/api/dm/conversations', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      memberHandles: z.array(z.string()).min(1).max(49),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    // Resolve handles to actor IDs
    const memberActors = await db.query.actors.findMany({
      where: (a, { inArray }) => inArray(a.handle, body.data.memberHandles),
      columns: { id: true, handle: true },
    })
    if (memberActors.length === 0) return reply.code(400).send({ error: 'No valid members' })

    const [conv] = await db.insert(conversations).values({
      name: body.data.name ?? null,
      createdById: ctx.actor.id,
    }).returning()

    // Add creator + all members
    const memberIds = [...new Set([ctx.actor.id, ...memberActors.map((a) => a.id)])]
    await db.insert(conversationMembers).values(memberIds.map((actorId) => ({ conversationId: conv!.id, actorId })))

    // Fetch full conversation with members for response
    const members = await db.query.conversationMembers.findMany({
      where: eq(conversationMembers.conversationId, conv!.id),
      with: { actor: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })

    return reply.code(201).send({ ...conv, members: members.map((m) => m.actor) })
  })

  // GET /api/dm/conversations — list group conversations for current user
  app.get('/api/dm/conversations', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    // Find all conversations the user is a member of
    const memberships = await db.query.conversationMembers.findMany({
      where: eq(conversationMembers.actorId, ctx.actor.id),
      columns: { conversationId: true },
    })
    const convIds = memberships.map((m) => m.conversationId)
    if (convIds.length === 0) return reply.send({ conversations: [] })

    // Fetch conversations with latest message
    const convs = await db.query.conversations.findMany({
      where: (c, { inArray }) => inArray(c.id, convIds),
      orderBy: [desc(conversations.updatedAt)],
    })

    // Fetch members for each conversation
    const allMembers = await db.query.conversationMembers.findMany({
      where: (m, { inArray }) => inArray(m.conversationId, convIds),
      with: { actor: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })
    const membersByConv = new Map<string, typeof allMembers>()
    for (const m of allMembers) {
      if (!membersByConv.has(m.conversationId)) membersByConv.set(m.conversationId, [])
      membersByConv.get(m.conversationId)!.push(m)
    }

    // Fetch last message per conversation
    const lastMessages = await Promise.all(convIds.map((id) =>
      db.query.posts.findFirst({
        where: and(eq(posts.conversationId, id), eq(posts.isDeleted, false)),
        orderBy: [desc(posts.createdAt)],
        columns: { id: true, content: true, createdAt: true, authorId: true },
      }),
    ))
    const lastMsgByConv = new Map(convIds.map((id, i) => [id, lastMessages[i]]))

    const result = convs.map((conv) => ({
      ...conv,
      members: (membersByConv.get(conv.id) ?? []).map((m) => m.actor),
      lastMessage: lastMsgByConv.get(conv.id) ?? null,
    }))

    return reply.send({ conversations: result })
  })

  // GET /api/dm/conversations/:id — thread for a group conversation
  app.get<{ Params: { id: string }; Querystring: { cursor?: string } }>(
    '/api/dm/conversations/:id',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      // Check membership
      const membership = await db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, req.params.id),
          eq(conversationMembers.actorId, ctx.actor.id),
        ),
      })
      if (!membership) return reply.code(403).send({ error: 'Not a member' })

      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, req.params.id),
      })
      if (!conv) return reply.code(404).send({ error: 'Not found' })

      const members = await db.query.conversationMembers.findMany({
        where: eq(conversationMembers.conversationId, req.params.id),
        with: { actor: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
      })

      const LIMIT = 30
      const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined
      const conditions = [
        eq(posts.conversationId, req.params.id),
        eq(posts.isDeleted, false),
        ...(cursor ? [lt(posts.createdAt, cursor)] : []),
      ]

      const messageRows = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: LIMIT + 1,
      })

      const hasMore = messageRows.length > LIMIT
      const items = messageRows.slice(0, LIMIT)
      const enriched = await enrichPosts(items, ctx.actor.id)

      return reply.send({
        conversation: { ...conv, members: members.map((m) => m.actor) },
        messages: enriched.reverse(),
        nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
      })
    },
  )

  // POST /api/dm/conversations/:id/messages — send message to group
  app.post<{ Params: { id: string } }>(
    '/api/dm/conversations/:id/messages',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const membership = await db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, req.params.id),
          eq(conversationMembers.actorId, ctx.actor.id),
        ),
      })
      if (!membership) return reply.code(403).send({ error: 'Not a member' })

      const body = z.object({
        content: z.string().max(500).optional(),
        mediaIds: z.array(z.string().uuid()).max(1).optional(),
      }).refine(d => (d.content && d.content.trim().length > 0) || (d.mediaIds && d.mediaIds.length > 0),
        { message: 'Provide content or mediaIds' }
      ).safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

      const { actor } = ctx
      const mediaIds = body.data.mediaIds ?? []
      if (mediaIds.length > 0) {
        const owned = await db.query.mediaAttachments.findMany({
          where: and(inArray(mediaAttachments.id, mediaIds), eq(mediaAttachments.actorId, actor.id)),
        })
        if (owned.length !== mediaIds.length) return reply.code(403).send({ error: 'Invalid media' })
      }

      const [post] = await db.insert(posts).values({
        authorId: actor.id,
        conversationId: req.params.id,
        content: body.data.content?.trim() ?? '',
        visibility: 'direct',
        tags: [],
        isLocal: true,
        apId: 'placeholder',
      }).returning()

      if (mediaIds.length > 0) {
        await db.update(mediaAttachments).set({ postId: post!.id }).where(inArray(mediaAttachments.id, mediaIds))
      }

      const apId = `${env.APP_URL}/users/${actor.handle}/posts/${post!.id}`
      await db.update(posts).set({ apId, apUrl: apId }).where(eq(posts.id, post!.id))

      // Update conversation updatedAt
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, req.params.id))

      const [enriched] = await enrichPosts([post!], actor.id)
      return reply.code(201).send({ ...enriched, apId })
    },
  )

  // POST /api/dm/conversations/:id/members — add a member
  app.post<{ Params: { id: string } }>(
    '/api/dm/conversations/:id/members',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const membership = await db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, req.params.id),
          eq(conversationMembers.actorId, ctx.actor.id),
        ),
      })
      if (!membership) return reply.code(403).send({ error: 'Not a member' })

      const body = z.object({ handle: z.string() }).safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

      const newMember = await db.query.actors.findFirst({
        where: eq(actors.handle, body.data.handle),
        columns: { id: true, handle: true, displayName: true, avatarUrl: true },
      })
      if (!newMember) return reply.code(404).send({ error: 'User not found' })

      await db.insert(conversationMembers)
        .values({ conversationId: req.params.id, actorId: newMember.id })
        .onConflictDoNothing()

      return reply.send(newMember)
    },
  )
}
