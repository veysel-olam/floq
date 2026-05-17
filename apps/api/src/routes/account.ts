import type { FastifyInstance } from 'fastify'
import { eq, and, gte, ne, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { db } from '../db/client.js'
import { user, session as sessionTable, actors, posts, follows, likes, boosts, blocks, bookmarks, actorPreferences } from '../db/schema.js'
import { requireActor, getSession } from '../lib/session.js'
import { uploadToS3 } from '../lib/s3.js'
import { buildActor, buildUpdate, buildMove, actorUrl } from '../lib/activityPub.js'
import { deliverToFollowers } from '../lib/federation.js'
import { env } from '../lib/env.js'
import { generateActorKeyPair, generateEd25519KeyPair } from '../lib/keys.js'

async function broadcastActorUpdate(actorId: string) {
  const updated = await db.query.actors.findFirst({ where: eq(actors.id, actorId) })
  if (!updated) return
  const ap = buildActor(updated)
  const activity = buildUpdate(ap)
  void deliverToFollowers(updated.handle, updated.id, activity)
}

export async function accountRoutes(app: FastifyInstance) {
  // PATCH /api/account/profile
  app.patch('/api/account/profile', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({
        displayName: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        website: z.string().url().max(2048).nullable().optional(),
        isLocked: z.boolean().optional(),
        profileFields: z.array(z.object({
          name: z.string().max(255),
          value: z.string().max(2048),
          verifiedAt: z.string().nullable().optional(),
        })).max(8).optional(),
      })
      .safeParse(req.body)

    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const actorUpdate: Partial<typeof actors.$inferInsert> = { updatedAt: new Date() }
    if (body.data.displayName !== undefined) actorUpdate.displayName = body.data.displayName
    if (body.data.bio !== undefined) actorUpdate.bio = body.data.bio
    if (body.data.website !== undefined) actorUpdate.website = body.data.website
    if (body.data.isLocked !== undefined) actorUpdate.isLocked = body.data.isLocked
    if (body.data.profileFields !== undefined) actorUpdate.profileFields = body.data.profileFields.map((f) => ({ ...f, verifiedAt: f.verifiedAt ?? null }))

    await db.update(actors).set(actorUpdate).where(eq(actors.id, ctx.actor.id))

    if (body.data.displayName !== undefined) {
      await db
        .update(user)
        .set({ name: body.data.displayName, updatedAt: new Date() })
        .where(eq(user.id, ctx.session.user.id))
    }

    void broadcastActorUpdate(ctx.actor.id)
    return reply.code(204).send()
  })

  // POST /api/account/avatar — upload avatar image
  app.post('/api/account/avatar', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const data = await req.file({ limits: { fileSize: 4 * 1024 * 1024 } })
    if (!data) return reply.code(400).send({ error: 'No file' })

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Unsupported file type' })

    const buffer = await data.toBuffer()
    const processed = await sharp(buffer)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer()

    const key = `avatars/${ctx.actor.id}/${randomUUID()}.jpg`
    const url = await uploadToS3({ key, body: processed, contentType: 'image/jpeg' })

    await db.update(actors).set({ avatarUrl: url, updatedAt: new Date() }).where(eq(actors.id, ctx.actor.id))
    void broadcastActorUpdate(ctx.actor.id)
    return reply.send({ url })
  })

  // POST /api/account/header — upload header/banner image
  app.post('/api/account/header', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const data = await req.file({ limits: { fileSize: 8 * 1024 * 1024 } })
    if (!data) return reply.code(400).send({ error: 'No file' })

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Unsupported file type' })

    const buffer = await data.toBuffer()
    const processed = await sharp(buffer)
      .rotate()
      .resize(1500, 500, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer()

    const key = `headers/${ctx.actor.id}/${randomUUID()}.jpg`
    const url = await uploadToS3({ key, body: processed, contentType: 'image/jpeg' })

    await db.update(actors).set({ headerUrl: url, updatedAt: new Date() }).where(eq(actors.id, ctx.actor.id))
    void broadcastActorUpdate(ctx.actor.id)
    return reply.send({ url })
  })

  // PATCH /api/account/privacy
  app.patch('/api/account/privacy', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ isLocked: z.boolean().optional(), noIndex: z.boolean().optional() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const update: Partial<typeof actors.$inferInsert> = { updatedAt: new Date() }
    if (body.data.isLocked !== undefined) update.isLocked = body.data.isLocked
    if (body.data.noIndex !== undefined) update.noIndex = body.data.noIndex

    await db
      .update(actors)
      .set(update)
      .where(eq(actors.id, ctx.actor.id))

    void broadcastActorUpdate(ctx.actor.id)
    return reply.code(204).send()
  })

  // GET /api/account/preferences
  app.get('/api/account/preferences', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const prefs = await db.query.actorPreferences.findFirst({
      where: eq(actorPreferences.actorId, ctx.actor.id),
    })
    return reply.send(prefs ?? {
      actorId: ctx.actor.id,
      dmEnabled: true, allowReplyFrom: 'everyone', hideLikesCount: false,
      hideReadReceipts: false, defaultVisibility: 'public', filterBots: false,
      hideBoosts: false, minAccountAgeFilter: 0, nsfwMode: 'blur',
      preferredLanguages: [], hideShortVideos: false, usageTimeLimit: 0,
    })
  })

  // PATCH /api/account/preferences
  app.patch('/api/account/preferences', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      dmEnabled:           z.boolean().optional(),
      allowReplyFrom:      z.enum(['everyone', 'followers', 'nobody']).optional(),
      hideLikesCount:      z.boolean().optional(),
      hideReadReceipts:    z.boolean().optional(),
      defaultVisibility:   z.enum(['public', 'followers', 'unlisted']).optional(),
      filterBots:          z.boolean().optional(),
      hideBoosts:          z.boolean().optional(),
      minAccountAgeFilter: z.number().int().min(0).max(365).optional(),
      nsfwMode:            z.enum(['hide', 'blur', 'show']).optional(),
      preferredLanguages:  z.array(z.string().max(10)).max(10).optional(),
      hideShortVideos:     z.boolean().optional(),
      usageTimeLimit:      z.number().int().min(0).max(1440).optional(),
    }).safeParse(req.body)

    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const data = { ...body.data, updatedAt: new Date() }

    await db
      .insert(actorPreferences)
      .values({ actorId: ctx.actor.id, ...data })
      .onConflictDoUpdate({ target: actorPreferences.actorId, set: data })

    return reply.code(204).send()
  })

  // GET /api/account/export
  app.get('/api/account/export', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const [actorData, userPosts, following, followers] = await Promise.all([
      db.query.actors.findFirst({ where: eq(actors.id, ctx.actor.id) }),
      db.query.posts.findMany({
        where: and(eq(posts.authorId, ctx.actor.id), eq(posts.isDeleted, false)),
        orderBy: [desc(posts.createdAt)],
      }),
      db.query.follows.findMany({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
        with: { following: { columns: { handle: true, displayName: true, apId: true } } },
      }),
      db.query.follows.findMany({
        where: and(eq(follows.followingId, ctx.actor.id), eq(follows.status, 'accepted')),
        with: { follower: { columns: { handle: true, displayName: true, apId: true } } },
      }),
    ])

    const archive = {
      exportedAt: new Date().toISOString(),
      profile: {
        handle: actorData?.handle,
        displayName: actorData?.displayName,
        bio: actorData?.bio,
        createdAt: actorData?.createdAt,
      },
      posts: userPosts.map((p) => ({
        id: p.id,
        content: p.content,
        visibility: p.visibility,
        createdAt: p.createdAt,
        editedAt: p.editedAt,
      })),
      following: following.map((f) => ({
        handle: f.following?.handle,
        displayName: f.following?.displayName,
        apId: f.following?.apId,
        since: f.createdAt,
      })),
      followers: followers.map((f) => ({
        handle: f.follower?.handle,
        displayName: f.follower?.displayName,
        apId: f.follower?.apId,
        since: f.createdAt,
      })),
    }

    // Enrich with likes, bookmarks, DMs, and blocks for GDPR completeness
    const [userLikes, userBookmarks, userDMs, userBlocks] = await Promise.all([
      db.query.likes.findMany({
        where: eq(likes.actorId, ctx.actor.id),
        orderBy: [desc(likes.createdAt)],
        limit: 5000,
      }),
      db.query.bookmarks.findMany({
        where: eq(bookmarks.actorId, ctx.actor.id),
        orderBy: [desc(bookmarks.createdAt)],
        limit: 5000,
      }),
      db.query.posts.findMany({
        where: and(eq(posts.authorId, ctx.actor.id), eq(posts.visibility, 'direct')),
        orderBy: [desc(posts.createdAt)],
        limit: 10000,
      }),
      db.query.blocks.findMany({
        where: eq(blocks.blockerId, ctx.actor.id),
        with: { blocked: { columns: { handle: true, displayName: true, apId: true } } },
      }),
    ])

    const fullArchive = {
      ...archive,
      likes: userLikes.map((l) => ({ postId: l.postId, likedAt: l.createdAt })),
      bookmarks: userBookmarks.map((b) => ({ postId: b.postId, bookmarkedAt: b.createdAt })),
      directMessages: userDMs.map((p) => ({
        id: p.id,
        content: (p as typeof p & { encryptedContent?: string | null }).encryptedContent ? '[Encrypted]' : p.content,
        createdAt: p.createdAt,
      })),
      blocks: userBlocks.map((b) => ({
        handle: (b.blocked as { handle?: string } | undefined)?.handle,
        apId: (b.blocked as { apId?: string } | undefined)?.apId,
        blockedAt: b.createdAt,
      })),
    }

    void reply.header('Content-Disposition', `attachment; filename="floq-${actorData?.handle}-gdpr.json"`)
    void reply.header('Content-Type', 'application/json')
    return reply.send(JSON.stringify(fullArchive, null, 2))
  })

  // GET /api/account/sessions
  app.get('/api/account/sessions', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    const sessions = await db.query.session.findMany({
      where: and(
        eq(sessionTable.userId, sess.user.id),
        gte(sessionTable.expiresAt, new Date()),
      ),
      orderBy: [desc(sessionTable.createdAt)],
    })

    return reply.send({
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.id === sess.session.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    })
  })

  // DELETE /api/account/sessions/:id — revoke specific session
  app.delete<{ Params: { id: string } }>('/api/account/sessions/:id', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    if (req.params.id === sess.session.id) {
      return reply.code(400).send({ error: 'Cannot revoke current session' })
    }

    await db
      .delete(sessionTable)
      .where(and(eq(sessionTable.id, req.params.id), eq(sessionTable.userId, sess.user.id)))

    return reply.code(204).send()
  })

  // DELETE /api/account/sessions — revoke all other sessions
  app.delete('/api/account/sessions', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    await db
      .delete(sessionTable)
      .where(and(eq(sessionTable.userId, sess.user.id), ne(sessionTable.id, sess.session.id)))

    return reply.code(204).send()
  })

  // POST /api/account/keys/rotate — rotate RSA + ed25519 signing keys
  // Use when a private key is suspected to be compromised.
  app.post('/api/account/keys/rotate', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const [newRsa, newEd] = await Promise.all([
      generateActorKeyPair(),
      Promise.resolve(generateEd25519KeyPair()),
    ])

    await db.update(actors).set({
      publicKey: newRsa.publicKeyPem,
      privateKeyEncrypted: newRsa.privateKeyEncrypted,
      ed25519PublicKey: newEd.publicKeyMultibase,
      ed25519PrivateKeyEncrypted: newEd.privateKeyEncrypted,
      updatedAt: new Date(),
    }).where(eq(actors.id, ctx.actor.id))

    // Broadcast the new public keys to all followers
    void broadcastActorUpdate(ctx.actor.id)

    return reply.send({
      message: 'Keys rotated successfully. New public keys are being broadcast to followers.',
      ed25519PublicKey: newEd.publicKeyMultibase,
      rsaPublicKey: newRsa.publicKeyPem,
    })
  })

  // PATCH /api/account/profile-fields — FEP-c7d3 PropertyValue fields
  app.patch('/api/account/profile-fields', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const fieldSchema = z.object({
      name: z.string().min(1).max(255),
      value: z.string().min(1).max(2048),
    })
    const body = z.object({
      fields: z.array(fieldSchema).max(4),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const existing = ctx.actor.profileFields ?? []
    const updated = body.data.fields.map((f) => {
      const prev = existing.find((e) => e.name === f.name)
      return { name: f.name, value: f.value, verifiedAt: prev?.verifiedAt ?? null }
    })

    await db.update(actors).set({ profileFields: updated, updatedAt: new Date() }).where(eq(actors.id, ctx.actor.id))
    void broadcastActorUpdate(ctx.actor.id)
    return reply.send({ fields: updated })
  })

  // POST /api/account/profile-fields/verify — verify rel="me" back-link for a field
  app.post<{ Body: { url: string } }>('/api/account/profile-fields/verify', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({ url: z.string().url().max(2048) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid URL' })

    const fields = ctx.actor.profileFields ?? []
    const field = fields.find((f) => f.value === body.data.url)
    if (!field) return reply.code(404).send({ error: 'URL not in profile fields' })

    // Fetch the target page and look for rel="me" link pointing back to our profile
    const profileUrl = `${env.WEB_URL}/${ctx.actor.handle}`
    try {
      const res = await fetch(body.data.url, {
        headers: { 'User-Agent': `floq/1.0 (+${env.APP_URL})` },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return reply.code(422).send({ error: 'Could not fetch URL', verified: false })

      const html = await res.text()
      // Check for <a rel="me" href="...profileUrl..."> or <link rel="me" href="...">
      const relMePattern = /rel=["'][^"']*\bme\b[^"']*["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["'][^"']*\bme\b[^"']*["']/gi
      let found = false
      let match: RegExpExecArray | null
      while ((match = relMePattern.exec(html)) !== null) {
        const href = match[1] ?? match[2] ?? ''
        if (href.includes(ctx.actor.handle) || href === profileUrl) {
          found = true
          break
        }
      }

      if (!found) return reply.send({ verified: false, message: 'No rel="me" link found pointing to your profile' })

      const now = new Date().toISOString()
      const updatedFields = fields.map((f) => f.value === body.data.url ? { ...f, verifiedAt: now } : f)
      await db.update(actors).set({ profileFields: updatedFields, updatedAt: new Date() }).where(eq(actors.id, ctx.actor.id))
      void broadcastActorUpdate(ctx.actor.id)
      return reply.send({ verified: true, verifiedAt: now })
    } catch {
      return reply.code(422).send({ error: 'Failed to fetch URL', verified: false })
    }
  })

  // POST /api/account/migrate — hesabı başka ActivityPub sunucusuna taşı
  app.post('/api/account/migrate', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    if (ctx.actor.movedToUri) {
      return reply.code(409).send({ error: 'Hesap zaten taşınmış.' })
    }

    const { targetActorUri } = (req.body ?? {}) as { targetActorUri?: string }
    if (!targetActorUri || typeof targetActorUri !== 'string') {
      return reply.code(400).send({ error: 'targetActorUri gerekli.' })
    }

    // Validate target URI is a reachable HTTP(S) URL on a different domain
    let targetUrl: URL
    try {
      targetUrl = new URL(targetActorUri)
      if (!['https:', 'http:'].includes(targetUrl.protocol)) throw new Error()
    } catch {
      return reply.code(400).send({ error: 'Geçersiz URI formatı.' })
    }

    if (targetUrl.hostname === env.APP_DOMAIN) {
      return reply.code(400).send({ error: 'Aynı sunucuya taşıma yapılamaz.' })
    }

    // Fetch remote actor and verify alsoKnownAs
    let remoteActor: { alsoKnownAs?: string | string[] } | null = null
    try {
      const res = await fetch(targetActorUri, {
        headers: { Accept: 'application/activity+json, application/ld+json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return reply.code(422).send({ error: 'Hedef hesap alınamadı. URI\'yi kontrol et.' })
      remoteActor = await res.json() as { alsoKnownAs?: string | string[] }
    } catch {
      return reply.code(422).send({ error: 'Hedef hesaba bağlanılamadı.' })
    }

    const localActorUrl = actorUrl(ctx.actor.handle)
    const knownAs = Array.isArray(remoteActor?.alsoKnownAs)
      ? remoteActor.alsoKnownAs
      : remoteActor?.alsoKnownAs
        ? [remoteActor.alsoKnownAs]
        : []

    if (!knownAs.includes(localActorUrl)) {
      return reply.code(422).send({
        error: `Doğrulama başarısız. Hedef hesabın alsoKnownAs dizisine şunu ekle:\n${localActorUrl}`,
      })
    }

    // Broadcast Move activity to all followers
    const moveActivity = buildMove(ctx.actor.handle, targetActorUri)
    void deliverToFollowers(ctx.actor.handle, ctx.actor.id, moveActivity)

    // Mark account as moved and lock it (no new follows)
    await db.update(actors)
      .set({ movedToUri: targetActorUri, isLocked: true, updatedAt: new Date() })
      .where(eq(actors.id, ctx.actor.id))

    return reply.code(204).send()
  })

  // PATCH /api/account/bluesky — Bluesky handle bağla / kaldır
  app.patch('/api/account/bluesky', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({ blueskyHandle: z.string().max(255).nullable() })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    await db
      .update(actors)
      .set({ blueskyHandle: body.data.blueskyHandle ?? null, updatedAt: new Date() })
      .where(eq(actors.id, ctx.actor.id))

    return reply.code(204).send()
  })

  // PUT /api/account/also-known-as — başka hesaptan taşınma için önceki hesap URI'larını kaydet
  app.put('/api/account/also-known-as', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({ uris: z.array(z.string().url()).max(5) })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz veri' })

    await db
      .update(actors)
      .set({ alsoKnownAs: body.data.uris, updatedAt: new Date() })
      .where(eq(actors.id, ctx.actor.id))

    void broadcastActorUpdate(ctx.actor.id)
    return reply.code(204).send()
  })

  // PUT /api/account/domain-handle — özel domain handle kaydet
  app.put('/api/account/domain-handle', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({ domain: z.string().max(253).nullable() })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz veri' })

    const domain = body.data.domain?.toLowerCase().trim().replace(/^@/, '') ?? null

    // Basic domain format validation
    if (domain !== null) {
      const domainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
      if (!domainRe.test(domain)) return reply.code(400).send({ error: 'Geçersiz domain formatı' })
    }

    await db
      .update(actors)
      .set({ customHandle: domain, customHandleVerifiedAt: null, updatedAt: new Date() })
      .where(eq(actors.id, ctx.actor.id))

    return reply.send({ domain, verified: false })
  })

  // POST /api/account/domain-handle/verify — domain doğrula
  app.post('/api/account/domain-handle/verify', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const domain = ctx.actor.customHandle
    if (!domain) return reply.code(400).send({ error: 'Önce bir domain kaydet' })

    // Fetch verification file from the domain
    const verificationUrl = `https://${domain}/.well-known/floq-verification`
    const expectedContent = `@${ctx.actor.handle}@${env.APP_DOMAIN}`

    try {
      const res = await fetch(verificationUrl, {
        headers: { Accept: 'text/plain, */*' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) {
        return reply.code(422).send({ error: `Doğrulama dosyası bulunamadı (HTTP ${res.status})`, verified: false })
      }
      const text = (await res.text()).trim()
      if (text !== expectedContent) {
        return reply.code(422).send({
          error: `İçerik eşleşmedi. Beklenen: "${expectedContent}"`,
          verified: false,
        })
      }
    } catch {
      return reply.code(422).send({ error: 'Domain\'e bağlanılamadı.', verified: false })
    }

    const verifiedAt = new Date()
    await db
      .update(actors)
      .set({ customHandleVerifiedAt: verifiedAt, updatedAt: new Date() })
      .where(eq(actors.id, ctx.actor.id))

    return reply.send({ verified: true, verifiedAt: verifiedAt.toISOString() })
  })

  // GET /api/account/analytics — içerik üretici istatistikleri
  app.get('/api/account/analytics', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const actorId = ctx.actor.id
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const since7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000)

    // Toplam metrikler
    const [totals] = await db
      .select({
        totalPosts:   sql<number>`COUNT(*)::int`,
        totalLikes:   sql<number>`COALESCE(SUM(${posts.likesCount}), 0)::int`,
        totalBoosts:  sql<number>`COALESCE(SUM(${posts.boostsCount}), 0)::int`,
        totalReplies: sql<number>`COALESCE(SUM(${posts.repliesCount}), 0)::int`,
        totalViews:   sql<number>`COALESCE(SUM(${posts.viewCount}), 0)::int`,
      })
      .from(posts)
      .where(and(eq(posts.authorId, actorId), eq(posts.isDeleted, false)))

    // Son 30 günde gelen beğeniler (timeline)
    const likesTimeline = await db
      .select({
        day:   sql<string>`TO_CHAR(${likes.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(likes)
      .innerJoin(posts, eq(likes.postId, posts.id))
      .where(and(eq(posts.authorId, actorId), gte(likes.createdAt, since30)))
      .groupBy(sql`TO_CHAR(${likes.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${likes.createdAt}, 'YYYY-MM-DD')`)

    // Son 30 günde gelen boostlar
    const boostsTimeline = await db
      .select({
        day:   sql<string>`TO_CHAR(${boosts.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(boosts)
      .innerJoin(posts, eq(boosts.postId, posts.id))
      .where(and(eq(posts.authorId, actorId), gte(boosts.createdAt, since30)))
      .groupBy(sql`TO_CHAR(${boosts.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${boosts.createdAt}, 'YYYY-MM-DD')`)

    // Son 7 günde gönderilen post sayısı
    const [recentActivity] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, actorId), eq(posts.isDeleted, false), gte(posts.createdAt, since7)))

    // En çok beğenilen 5 gönderi
    const topPosts = await db.query.posts.findMany({
      where: and(eq(posts.authorId, actorId), eq(posts.isDeleted, false)),
      orderBy: [desc(sql`${posts.likesCount} + ${posts.boostsCount} * 2`)],
      limit: 5,
      columns: { id: true, content: true, likesCount: true, boostsCount: true, repliesCount: true, createdAt: true },
    })

    // En çok kullanılan 8 hashtag
    const tagRows = await db
      .select({ tag: sql<string>`unnest(${posts.tags})`, count: sql<number>`COUNT(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, actorId), eq(posts.isDeleted, false)))
      .groupBy(sql`unnest(${posts.tags})`)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8)

    return reply.send({
      totals: totals ?? { totalPosts: 0, totalLikes: 0, totalBoosts: 0, totalReplies: 0, totalViews: 0 },
      recentPostCount: recentActivity?.count ?? 0,
      likesTimeline,
      boostsTimeline,
      topPosts,
      topTags: tagRows,
      followerCount: ctx.actor.followersCount,
      followingCount: ctx.actor.followingCount,
      profileViewCount: ctx.actor.profileViewCount,
    })
  })

  // DELETE /api/account — delete account (cascades via FK)
  app.delete('/api/account', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    await db.delete(user).where(eq(user.id, sess.user.id))

    return reply.code(204).send()
  })
}
