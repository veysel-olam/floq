import type { FastifyInstance } from 'fastify'
import { eq, and, or, desc, lt, sql, inArray, ilike } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { posts, actors, actorPreferences, mediaAttachments, conversations, conversationMembers, follows, dmReads, dmSettings } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { enrichPosts } from '../lib/enrichPosts.js'
import { env } from '../lib/env.js'
import { publish } from '../lib/pubsub.js'
import { extractFirstUrl, fetchLinkPreview } from '../lib/linkPreview.js'

export async function dmRoutes(app: FastifyInstance) {
  // GET /api/dm — list conversations (one item per partner, most recent first)
  app.get<{ Querystring: { cursor?: string } }>('/api/dm', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const myId = ctx.actor.id

    const rows = await db.query.posts.findMany({
      where: and(
        eq(posts.visibility, 'direct'),
        eq(posts.isDeleted, false),
        or(eq(posts.authorId, myId), eq(posts.recipientId, myId)),
      ),
      orderBy: [desc(posts.createdAt)],
      limit: 200,
    })

    const partnerMap = new Map<string, typeof rows[0]>()
    for (const row of rows) {
      const partnerId = row.authorId === myId ? row.recipientId! : row.authorId
      if (partnerId && !partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, row)
      }
    }

    const partnerIds = [...partnerMap.keys()]
    const [partnerActors, followingMe, settingsRows] = await Promise.all([
      partnerIds.length > 0
        ? db.query.actors.findMany({ where: (a, { inArray }) => inArray(a.id, partnerIds) })
        : Promise.resolve([]),
      partnerIds.length > 0
        ? db.query.follows.findMany({
            where: and(inArray(follows.followerId, partnerIds), eq(follows.followingId, myId)),
            columns: { followerId: true },
          })
        : Promise.resolve([]),
      partnerIds.length > 0
        ? db.query.dmSettings.findMany({
            where: and(eq(dmSettings.userId, myId), inArray(dmSettings.partnerId, partnerIds)),
          })
        : Promise.resolve([]),
    ])

    const actorMap = new Map(partnerActors.map((a) => [a.id, a]))
    const followingMeSet = new Set(followingMe.map((f) => f.followerId))
    const settingsMap = new Map(settingsRows.map((s) => [s.partnerId, s]))

    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : 0
    const LIMIT = 20
    const result = [...partnerMap.entries()]
      .slice(cursor, cursor + LIMIT)
      .map(([partnerId, lastMessage]) => {
        const settings = settingsMap.get(partnerId)
        const isRequest = lastMessage.authorId !== myId && !followingMeSet.has(partnerId)
          && settings?.requestAccepted !== true
        return {
          partner: actorMap.get(partnerId) ?? null,
          lastMessage: { id: lastMessage.id, content: lastMessage.content, encryptedContent: lastMessage.encryptedContent, createdAt: lastMessage.createdAt, authorId: lastMessage.authorId },
          isRequest,
          archived: settings?.archived ?? false,
          muted: settings?.muted ?? false,
          requestAccepted: settings?.requestAccepted ?? null,
        }
      })
      .filter((c) => c.partner !== null)

    return reply.send({
      conversations: result,
      nextCursor: partnerMap.size > cursor + LIMIT ? String(cursor + LIMIT) : null,
    })
  })

  // GET /api/users/:handle/dm-key
  app.get<{ Params: { handle: string } }>('/api/users/:handle/dm-key', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { handle: true, dmPublicKey: true },
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })
    return reply.send({ handle: actor.handle, dmPublicKey: actor.dmPublicKey ?? null })
  })

  // POST /api/dm/keys — register E2E public key
  app.post('/api/dm/keys', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
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
        sql`NOT (${myId} = ANY(deleted_for_ids))`,
        or(
          and(eq(posts.authorId, myId), eq(posts.recipientId, partner.id)),
          and(eq(posts.authorId, partner.id), eq(posts.recipientId, myId)),
        ),
        ...(cursor ? [lt(posts.createdAt, cursor)] : []),
      ]

      const [messageRows, myRead, partnerRead, settings] = await Promise.all([
        db.query.posts.findMany({
          where: and(...conditions),
          orderBy: [desc(posts.createdAt)],
          limit: LIMIT + 1,
        }),
        db.query.dmReads.findFirst({
          where: and(eq(dmReads.userId, myId), eq(dmReads.partnerId, partner.id)),
        }),
        db.query.dmReads.findFirst({
          where: and(eq(dmReads.userId, partner.id), eq(dmReads.partnerId, myId)),
        }),
        db.query.dmSettings.findFirst({
          where: and(eq(dmSettings.userId, myId), eq(dmSettings.partnerId, partner.id)),
        }),
      ])

      const hasMore = messageRows.length > LIMIT
      const items = messageRows.slice(0, LIMIT)
      const enriched = await enrichPosts(items, myId)

      return reply.send({
        partner,
        messages: enriched.reverse(),
        nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
        myReadId: myRead?.lastReadId ?? null,
        partnerReadId: partnerRead?.lastReadId ?? null,
        settings: {
          archived: settings?.archived ?? false,
          muted: settings?.muted ?? false,
          requestAccepted: settings?.requestAccepted ?? null,
        },
      })
    },
  )

  // POST /api/dm/:handle — send a direct message
  app.post<{ Params: { handle: string } }>(
    '/api/dm/:handle',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const body = z.object({
        content: z.string().max(500).optional(),
        mediaIds: z.array(z.string().uuid()).max(1).optional(),
        encryptedContent: z.string().max(4096).optional(),
        encryptionIv: z.string().max(64).optional(),
        ephemeralPublicKey: z.string().max(64).optional(),
        replyToId: z.string().uuid().optional(),
      }).refine(d =>
        (d.content && d.content.trim().length > 0) ||
        (d.encryptedContent && d.encryptionIv && d.ephemeralPublicKey) ||
        (d.mediaIds && d.mediaIds.length > 0),
        { message: 'Provide content, media, or encrypted fields' }
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

      // Check if recipient has declined messages from this user
      const theirSettings = await db.query.dmSettings.findFirst({
        where: and(eq(dmSettings.userId, partner.id), eq(dmSettings.partnerId, ctx.actor.id)),
        columns: { requestAccepted: true },
      })
      if (theirSettings?.requestAccepted === false) {
        return reply.code(403).send({ error: 'Bu kullanıcı senden mesaj almak istemiyor.' })
      }

      const { actor } = ctx
      const mediaIds = body.data.mediaIds ?? []
      if (mediaIds.length > 0) {
        const owned = await db.query.mediaAttachments.findMany({
          where: and(inArray(mediaAttachments.id, mediaIds), eq(mediaAttachments.actorId, actor.id)),
        })
        if (owned.length !== mediaIds.length) return reply.code(403).send({ error: 'Invalid media' })
      }

      // Validate replyToId belongs to this conversation
      if (body.data.replyToId) {
        const replyPost = await db.query.posts.findFirst({
          where: and(
            eq(posts.id, body.data.replyToId),
            eq(posts.visibility, 'direct'),
            eq(posts.isDeleted, false),
            or(
              and(eq(posts.authorId, actor.id), eq(posts.recipientId, partner.id)),
              and(eq(posts.authorId, partner.id), eq(posts.recipientId, actor.id)),
            ),
          ),
        })
        if (!replyPost) return reply.code(400).send({ error: 'Invalid replyToId' })
      }

      const hasContent = !!(body.data.encryptedContent || (body.data.content && body.data.content.trim()))
      const contentText = body.data.encryptedContent ? '[Şifreli mesaj]'
        : hasContent ? body.data.content!
        : ''

      const [post] = await db.insert(posts).values({
        authorId: actor.id,
        recipientId: partner.id,
        content: contentText,
        encryptedContent: body.data.encryptedContent ?? null,
        encryptionIv: body.data.encryptionIv ?? null,
        ephemeralPublicKey: body.data.ephemeralPublicKey ?? null,
        replyToId: body.data.replyToId ?? null,
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

      // Link preview
      const plainContent = body.data.content?.trim() ?? ''
      if (plainContent) {
        const previewUrl = extractFirstUrl(plainContent)
        if (previewUrl) {
          const preview = await Promise.race([
            fetchLinkPreview(previewUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]).catch(() => null)
          if (preview) {
            await db.update(posts).set({ linkPreview: preview }).where(eq(posts.id, post!.id))
          }
        }
      }

      // Federate to a remote recipient (e.g. a Mastodon user). Plain text only —
      // remote DMs can't be E2E-encrypted, so only deliver when we have plaintext.
      if (!partner.isLocal && partner.inboxUrl && plainContent) {
        const { buildDirectNote, buildCreate } = await import('../lib/activityPub.js')
        const { deliverToInbox } = await import('../lib/federation.js')
        const note = buildDirectNote({
          postId: post!.id,
          content: plainContent,
          authorHandle: actor.handle,
          recipientApId: partner.apId,
          recipientHandle: partner.handle,
          createdAt: post!.createdAt,
        })
        void deliverToInbox(actor.handle, partner.inboxUrl, buildCreate(note, actor.handle))
      }

      const [enriched] = await (await import('../lib/enrichPosts.js')).enrichPosts([post!], actor.id)
      const response = { ...enriched, apId }

      if (partner.userId) {
        void publish(partner.userId, { event: 'dm', payload: { from: actor.handle, post: response } })
      }

      return reply.code(201).send(response)
    },
  )

  // POST /api/dm/:handle/read — mark all messages from partner as read
  app.post<{ Params: { handle: string } }>('/api/dm/:handle/read', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { id: true, handle: true, userId: true },
    })
    if (!partner) return reply.code(404).send({ error: 'Not found' })

    const myId = ctx.actor.id

    // Find the most recent message in this conversation
    const lastMsg = await db.query.posts.findFirst({
      where: and(
        eq(posts.visibility, 'direct'),
        eq(posts.isDeleted, false),
        or(
          and(eq(posts.authorId, myId), eq(posts.recipientId, partner.id)),
          and(eq(posts.authorId, partner.id), eq(posts.recipientId, myId)),
        ),
      ),
      orderBy: [desc(posts.createdAt)],
      columns: { id: true },
    })

    if (!lastMsg) return reply.send({ lastReadId: null })

    await db.insert(dmReads)
      .values({ userId: myId, partnerId: partner.id, lastReadId: lastMsg.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dmReads.userId, dmReads.partnerId],
        set: { lastReadId: lastMsg.id, updatedAt: new Date() },
      })

    // Notify partner that their messages were read
    if (partner.userId) {
      void publish(partner.userId, {
        event: 'dm_read',
        payload: { from: ctx.actor.handle, lastReadId: lastMsg.id },
      })
    }

    return reply.send({ lastReadId: lastMsg.id })
  })

  // POST /api/dm/:handle/typing — publish typing indicator to partner
  app.post<{ Params: { handle: string } }>('/api/dm/:handle/typing', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { id: true, userId: true },
    })
    if (!partner?.userId) return reply.code(204).send()

    void publish(partner.userId, {
      event: 'dm_typing',
      payload: { from: ctx.actor.handle },
    })

    return reply.code(204).send()
  })

  // PATCH /api/dm/:handle/settings — archive / mute a conversation
  app.patch<{ Params: { handle: string } }>('/api/dm/:handle/settings', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      archived: z.boolean().optional(),
      muted: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { id: true },
    })
    if (!partner) return reply.code(404).send({ error: 'Not found' })

    const existing = await db.query.dmSettings.findFirst({
      where: and(eq(dmSettings.userId, ctx.actor.id), eq(dmSettings.partnerId, partner.id)),
    })

    await db.insert(dmSettings)
      .values({
        userId: ctx.actor.id,
        partnerId: partner.id,
        archived: body.data.archived ?? existing?.archived ?? false,
        muted: body.data.muted ?? existing?.muted ?? false,
        requestAccepted: existing?.requestAccepted ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dmSettings.userId, dmSettings.partnerId],
        set: {
          ...(body.data.archived !== undefined ? { archived: body.data.archived } : {}),
          ...(body.data.muted !== undefined ? { muted: body.data.muted } : {}),
          updatedAt: new Date(),
        },
      })

    return reply.code(204).send()
  })

  // POST /api/dm/requests/:handle/accept — accept a message request
  app.post<{ Params: { handle: string } }>('/api/dm/requests/:handle/accept', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { id: true },
    })
    if (!partner) return reply.code(404).send({ error: 'Not found' })

    await db.insert(dmSettings)
      .values({ userId: ctx.actor.id, partnerId: partner.id, archived: false, muted: false, requestAccepted: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dmSettings.userId, dmSettings.partnerId],
        set: { requestAccepted: true, updatedAt: new Date() },
      })

    return reply.code(204).send()
  })

  // POST /api/dm/requests/:handle/decline — decline a message request
  app.post<{ Params: { handle: string } }>('/api/dm/requests/:handle/decline', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const partner = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
      columns: { id: true },
    })
    if (!partner) return reply.code(404).send({ error: 'Not found' })

    await db.insert(dmSettings)
      .values({ userId: ctx.actor.id, partnerId: partner.id, archived: false, muted: false, requestAccepted: false, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dmSettings.userId, dmSettings.partnerId],
        set: { requestAccepted: false, updatedAt: new Date() },
      })

    return reply.code(204).send()
  })

  // PATCH /api/dm/messages/:id — edit a direct message
  app.patch<{ Params: { id: string } }>('/api/dm/messages/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ content: z.string().min(1).max(500) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const post = await db.query.posts.findFirst({
      where: and(
        eq(posts.id, req.params.id),
        eq(posts.visibility, 'direct'),
        eq(posts.isDeleted, false),
        eq(posts.authorId, ctx.actor.id),
      ),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })
    if (post.encryptedContent) return reply.code(400).send({ error: 'Cannot edit encrypted messages' })

    await db.update(posts)
      .set({ content: body.data.content, editedAt: new Date() })
      .where(eq(posts.id, post.id))

    return reply.send({ id: post.id, content: body.data.content, editedAt: new Date().toISOString() })
  })

  // DELETE /api/dm/messages/:id?mode=self|everyone
  app.delete<{ Params: { id: string }; Querystring: { mode?: string } }>(
    '/api/dm/messages/:id',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, req.params.id), eq(posts.visibility, 'direct'), eq(posts.isDeleted, false)),
      })
      if (!post) return reply.code(404).send({ error: 'Not found' })

      const myId = ctx.actor.id
      const isParticipant = post.authorId === myId || post.recipientId === myId
      if (!isParticipant) return reply.code(403).send({ error: 'Forbidden' })

      const mode = req.query.mode === 'everyone' ? 'everyone' : 'self'

      if (mode === 'everyone') {
        if (post.authorId !== myId) return reply.code(403).send({ error: 'Only author can delete for everyone' })
        await db.update(posts).set({ isDeleted: true, deletedAt: new Date() }).where(eq(posts.id, post.id))
      } else {
        const already = (post.deletedForIds ?? []).includes(myId)
        if (!already) {
          await db.update(posts)
            .set({ deletedForIds: sql`array_append(deleted_for_ids, ${myId})` })
            .where(eq(posts.id, post.id))
        }
      }

      return reply.code(204).send()
    },
  )

  // GET /api/dm/:handle/search — search messages in a conversation
  app.get<{ Params: { handle: string }; Querystring: { q: string } }>(
    '/api/dm/:handle/search',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const q = req.query.q?.trim()
      if (!q || q.length < 2) return reply.send({ messages: [] })

      const partner = await db.query.actors.findFirst({
        where: eq(actors.handle, req.params.handle),
        columns: { id: true },
      })
      if (!partner) return reply.code(404).send({ error: 'Not found' })

      const myId = ctx.actor.id
      const rows = await db.query.posts.findMany({
        where: and(
          eq(posts.visibility, 'direct'),
          eq(posts.isDeleted, false),
          sql`NOT (${myId} = ANY(deleted_for_ids))`,
          or(
            and(eq(posts.authorId, myId), eq(posts.recipientId, partner.id)),
            and(eq(posts.authorId, partner.id), eq(posts.recipientId, myId)),
          ),
          ilike(posts.content, `%${q}%`),
        ),
        orderBy: [desc(posts.createdAt)],
        limit: 30,
      })

      const enriched = await enrichPosts(rows, myId)
      return reply.send({ messages: enriched.reverse() })
    },
  )

  // ─── Group Conversations ───────────────────────────────────────────────────

  // POST /api/dm/conversations — create a group conversation
  app.post('/api/dm/conversations', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      memberHandles: z.array(z.string()).min(1).max(49),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const memberActors = await db.query.actors.findMany({
      where: (a, { inArray }) => inArray(a.handle, body.data.memberHandles),
      columns: { id: true, handle: true },
    })
    if (memberActors.length === 0) return reply.code(400).send({ error: 'No valid members' })

    const [conv] = await db.insert(conversations).values({
      name: body.data.name ?? null,
      createdById: ctx.actor.id,
    }).returning()

    const memberIds = [...new Set([ctx.actor.id, ...memberActors.map((a) => a.id)])]
    await db.insert(conversationMembers).values(memberIds.map((actorId) => ({ conversationId: conv!.id, actorId })))

    const members = await db.query.conversationMembers.findMany({
      where: eq(conversationMembers.conversationId, conv!.id),
      with: { actor: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })

    return reply.code(201).send({ ...conv, members: members.map((m) => m.actor) })
  })

  // GET /api/dm/conversations — list group conversations
  app.get('/api/dm/conversations', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const memberships = await db.query.conversationMembers.findMany({
      where: eq(conversationMembers.actorId, ctx.actor.id),
      columns: { conversationId: true },
    })
    const convIds = memberships.map((m) => m.conversationId)
    if (convIds.length === 0) return reply.send({ conversations: [] })

    const convs = await db.query.conversations.findMany({
      where: (c, { inArray }) => inArray(c.id, convIds),
      orderBy: [desc(conversations.updatedAt)],
    })

    const allMembers = await db.query.conversationMembers.findMany({
      where: (m, { inArray }) => inArray(m.conversationId, convIds),
      with: { actor: { columns: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    })
    const membersByConv = new Map<string, typeof allMembers>()
    for (const m of allMembers) {
      if (!membersByConv.has(m.conversationId)) membersByConv.set(m.conversationId, [])
      membersByConv.get(m.conversationId)!.push(m)
    }

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

  // PATCH /api/dm/conversations/:id — update group name/avatar
  app.patch<{ Params: { id: string } }>('/api/dm/conversations/:id', async (req, reply) => {
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
      name: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().max(2048).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const [updated] = await db.update(conversations)
      .set({
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.avatarUrl !== undefined ? { avatarUrl: body.data.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, req.params.id))
      .returning()

    return reply.send(updated)
  })

  // POST /api/dm/conversations/:id/leave — leave a group conversation
  app.post<{ Params: { id: string } }>('/api/dm/conversations/:id/leave', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    await db.delete(conversationMembers).where(
      and(
        eq(conversationMembers.conversationId, req.params.id),
        eq(conversationMembers.actorId, ctx.actor.id),
      ),
    )

    return reply.code(204).send()
  })

  // DELETE /api/dm/conversations/:id/members/:actorId — remove a member (creator only)
  app.delete<{ Params: { id: string; actorId: string } }>(
    '/api/dm/conversations/:id/members/:actorId',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, req.params.id),
        columns: { id: true, createdById: true },
      })
      if (!conv) return reply.code(404).send({ error: 'Not found' })
      if (conv.createdById !== ctx.actor.id) return reply.code(403).send({ error: 'Only creator can remove members' })

      await db.delete(conversationMembers).where(
        and(
          eq(conversationMembers.conversationId, req.params.id),
          eq(conversationMembers.actorId, req.params.actorId),
        ),
      )

      return reply.code(204).send()
    },
  )
}
