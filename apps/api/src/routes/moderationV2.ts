/**
 * Decentralized moderation: shared block lists, report forwarding,
 * content labels, transparent log, and appeals.
 */
import type { FastifyInstance } from 'fastify'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  blockLists, blockListEntries, contentLabels, moderationAppeals,
  reports, adminAuditLogs, actors,
} from '../db/schema.js'
import { requireMastodonUser } from '../lib/mastodonAuth.js'
import { getInstanceActor } from '../lib/federation.js'
import { env } from '../lib/env.js'

// ── Shared block list fetcher ────────────────────────────────────────────────

async function fetchAndStoreBlockList(listId: string, url: string): Promise<number> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) return 0

  const text = await res.text()
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  const entries: Array<{ listId: string; domain: string; severity: string; comment: string | null }> = []

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue

    // Support CSV: domain,severity,comment or plain domain list
    const parts = line.split(',')
    const domain = parts[0]!.trim().replace(/^[*.]/, '')
    if (!domain || domain.length < 3) continue

    const severity = parts[1]?.trim() || 'suspend'
    const comment = parts[2]?.trim() || null
    entries.push({ listId, domain, severity, comment })
  }

  if (entries.length) {
    // Upsert entries in batches
    const BATCH = 500
    for (let i = 0; i < entries.length; i += BATCH) {
      await db.insert(blockListEntries)
        .values(entries.slice(i, i + BATCH))
        .onConflictDoUpdate({
          target: [blockListEntries.listId, blockListEntries.domain],
          set: { severity: blockListEntries.severity, comment: blockListEntries.comment },
        })
    }
    await db.update(blockLists)
      .set({ entriesCount: entries.length, lastFetchedAt: new Date() })
      .where(eq(blockLists.id, listId))
  }

  return entries.length
}

// ── AP Flag activity for report forwarding ────────────────────────────────────

async function forwardReport(
  reportedActorApId: string,
  reportedPostApId: string | null,
  reason: string,
  inboxUrl: string,
): Promise<void> {
  const instanceActor = await getInstanceActor()
  const flagActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Flag',
    id: `${env.APP_URL}/actor/flags/${Date.now()}`,
    actor: `${env.APP_URL}/actor`,
    object: [reportedActorApId, ...(reportedPostApId ? [reportedPostApId] : [])],
    content: reason,
  }
  void import('./mastodon/index.js')  // warm up module cache
  const { deliverToInbox } = await import('../lib/federation.js')
  void deliverToInbox(instanceActor.handle, inboxUrl, flagActivity as Parameters<typeof deliverToInbox>[2])
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function moderationV2Routes(app: FastifyInstance) {
  // ── Shared Block Lists ──────────────────────────────────────────────────────

  app.get('/api/v1/admin/block_lists', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const lists = await db.query.blockLists.findMany({ orderBy: [desc(blockLists.createdAt)] })
    return reply.send(lists)
  })

  app.post('/api/v1/admin/block_lists', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const body = z.object({
      name: z.string().min(1).max(200),
      url: z.string().url(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const [list] = await db.insert(blockLists)
      .values({ name: body.data.name, url: body.data.url })
      .returning()

    // Fetch immediately in background
    void fetchAndStoreBlockList(list!.id, list!.url)

    return reply.code(200).send(list)
  })

  app.post<{ Params: { id: string } }>('/api/v1/admin/block_lists/:id/sync', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const list = await db.query.blockLists.findFirst({ where: eq(blockLists.id, req.params.id) })
    if (!list) return reply.code(404).send({ error: 'Not found' })

    const count = await fetchAndStoreBlockList(list.id, list.url)
    return reply.send({ synced: count })
  })

  app.delete<{ Params: { id: string } }>('/api/v1/admin/block_lists/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    await db.delete(blockLists).where(eq(blockLists.id, req.params.id))
    return reply.send({})
  })

  // ── Content Labels ──────────────────────────────────────────────────────────

  app.get<{ Params: { postId: string } }>('/api/v1/statuses/:postId/labels', async (req, reply) => {
    const labels = await db.query.contentLabels.findMany({
      where: eq(contentLabels.postId, req.params.postId),
    })
    return reply.send(labels)
  })

  app.post<{ Params: { postId: string } }>('/api/v1/admin/statuses/:postId/labels', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const body = z.object({
      label: z.string().min(1).max(64),
      confidence: z.number().int().min(0).max(100).optional().default(100),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const [label] = await db.insert(contentLabels)
      .values({ postId: req.params.postId, label: body.data.label, source: 'system', confidence: body.data.confidence })
      .returning()

    return reply.send(label)
  })

  // ── Report Forwarding ───────────────────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/api/v1/admin/reports/:id/forward', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const report = await db.query.reports.findFirst({ where: eq(reports.id, req.params.id) })
    if (!report) return reply.code(404).send({ error: 'Not found' })
    if (!report.reportedActorId) return reply.code(422).send({ error: 'No remote actor to forward to' })

    const reportedActor = await db.query.actors.findFirst({ where: eq(actors.id, report.reportedActorId) })
    if (!reportedActor || reportedActor.isLocal) return reply.code(422).send({ error: 'Cannot forward report for local actor' })

    const { posts: postsTable } = await import('../db/schema.js')
    const reportedPost = report.postId
      ? await db.query.posts.findFirst({ where: eq(postsTable.id, report.postId) })
      : null

    await forwardReport(
      reportedActor.apId,
      reportedPost?.apId ?? null,
      report.details ?? report.reason,
      reportedActor.inboxUrl,
    )

    return reply.send({ forwarded: true })
  })

  // ── Transparent Moderation Log ──────────────────────────────────────────────

  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/admin/moderation_log',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return
      if (!ctx.scopes.includes('admin:read')) return reply.code(403).send({ error: 'Insufficient scope' })

      const limit = Math.min(Number(req.query.limit ?? 40), 100)
      const offset = Number(req.query.offset ?? 0)

      const logs = await db.query.adminAuditLogs.findMany({
        orderBy: [desc(adminAuditLogs.createdAt)],
        limit,
        offset,
      })
      return reply.send(logs.map((l) => ({
        id: l.id,
        action: l.action,
        target_type: l.targetType,
        target_id: l.targetId,
        created_at: l.createdAt.toISOString(),
        // redact internal details for privacy
      })))
    },
  )

  // ── Appeals ─────────────────────────────────────────────────────────────────

  app.post<{ Params: { reportId: string } }>('/api/v1/reports/:reportId/appeal', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({ text: z.string().min(1).max(2000) }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const report = await db.query.reports.findFirst({ where: eq(reports.id, req.params.reportId) })
    if (!report) return reply.code(404).send({ error: 'Not found' })

    const [appeal] = await db.insert(moderationAppeals)
      .values({
        reportId: report.id,
        appellantId: ctx.actor.id,
        reason: body.data.text,
      })
      .onConflictDoNothing()
      .returning()

    return reply.code(200).send(appeal ?? { error: 'Appeal already submitted' })
  })

  app.get('/api/v1/admin/appeals', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const appeals = await db.query.moderationAppeals.findMany({
      orderBy: [desc(moderationAppeals.createdAt)],
      limit: 40,
    })
    return reply.send(appeals)
  })

  app.post<{ Params: { id: string } }>('/api/v1/admin/appeals/:id/approve', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    await db.update(moderationAppeals)
      .set({ status: 'approved', reviewedBy: ctx.actor.id, reviewedAt: new Date() })
      .where(eq(moderationAppeals.id, req.params.id))
    return reply.send({ status: 'approved' })
  })

  app.post<{ Params: { id: string } }>('/api/v1/admin/appeals/:id/reject', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    if (!ctx.scopes.includes('admin:write')) return reply.code(403).send({ error: 'Insufficient scope' })

    const body = z.object({ text: z.string().optional() }).safeParse(req.body)
    await db.update(moderationAppeals)
      .set({ status: 'rejected', reviewedBy: ctx.actor.id, reviewedAt: new Date(), reviewNote: body.success ? body.data.text ?? null : null })
      .where(eq(moderationAppeals.id, req.params.id))
    return reply.send({ status: 'rejected' })
  })
}
