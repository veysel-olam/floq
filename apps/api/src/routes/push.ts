import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '../db/client.js'
import { pushSubscriptions } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { env } from '../lib/env.js'

let vapidReady = false

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${env.VAPID_MAILTO}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
  vapidReady = true
}

export { webpush, vapidReady }

export async function pushRoutes(app: FastifyInstance) {
  // GET /api/push/vapid-public-key
  app.get('/api/push/vapid-public-key', async (_req, reply) => {
    if (!vapidReady) return reply.send({ enabled: false, publicKey: null })
    return reply.send({ enabled: true, publicKey: env.VAPID_PUBLIC_KEY })
  })

  // POST /api/push/subscribe — kaydet veya güncelle
  app.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string } } }>(
    '/api/push/subscribe',
    async (req, reply) => {
      if (!vapidReady) return reply.code(501).send({ error: 'Push not configured' })
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const { endpoint, keys } = req.body
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.code(400).send({ error: 'Invalid subscription' })
      }

      await db
        .insert(pushSubscriptions)
        .values({ actorId: ctx.actor.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { actorId: ctx.actor.id, p256dh: keys.p256dh, auth: keys.auth },
        })

      return reply.code(201).send({ ok: true })
    },
  )

  // DELETE /api/push/subscribe — aboneliği sil
  app.delete<{ Body: { endpoint: string } }>('/api/push/subscribe', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.actorId, ctx.actor.id),
          eq(pushSubscriptions.endpoint, req.body.endpoint),
        ),
      )

    return reply.code(204).send()
  })

  // ─── Mastodon push API (used by Ivory, Tusky, etc.) ─────────────────────────

  type MastodonPushBody = {
    subscription?: {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    data?: { alerts?: Record<string, boolean> }
  }

  function mastodonPushResponse(endpoint: string, alerts: Record<string, boolean>) {
    return {
      id: '1',
      endpoint,
      alerts: {
        follow: alerts.follow ?? true,
        favourite: alerts.favourite ?? true,
        reblog: alerts.reblog ?? true,
        mention: alerts.mention ?? true,
        poll: alerts.poll ?? false,
        status: alerts.status ?? false,
        update: alerts.update ?? false,
        'admin.sign_up': false,
        'admin.report': false,
      },
      server_key: vapidReady ? env.VAPID_PUBLIC_KEY : '',
    }
  }

  app.post<{ Body: MastodonPushBody }>('/api/v1/push/subscription', async (req, reply) => {
    if (!vapidReady) return reply.code(422).send({ error: 'Push not configured' })
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const { endpoint, keys } = req.body?.subscription ?? {}
    const alerts = req.body?.data?.alerts ?? {}

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(422).send({ error: 'Invalid subscription' })
    }

    await db
      .insert(pushSubscriptions)
      .values({ actorId: ctx.actor.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { actorId: ctx.actor.id, p256dh: keys.p256dh, auth: keys.auth },
      })

    return reply.code(200).send(mastodonPushResponse(endpoint, alerts))
  })

  app.get('/api/v1/push/subscription', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const sub = await db.query.pushSubscriptions.findFirst({
      where: eq(pushSubscriptions.actorId, ctx.actor.id),
    })
    if (!sub) return reply.code(404).send({ error: 'Not found' })
    return reply.send(mastodonPushResponse(sub.endpoint, {}))
  })

  app.put<{ Body: MastodonPushBody }>('/api/v1/push/subscription', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const sub = await db.query.pushSubscriptions.findFirst({
      where: eq(pushSubscriptions.actorId, ctx.actor.id),
    })
    if (!sub) return reply.code(404).send({ error: 'Not found' })
    return reply.send(mastodonPushResponse(sub.endpoint, req.body?.data?.alerts ?? {}))
  })

  app.delete('/api/v1/push/subscription', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.actorId, ctx.actor.id))

    return reply.code(200).send({})
  })
}

// ─── Helper: aktöre push bildirimi gönder ─────────────────────────────────────

export async function sendPushToActor(
  actorId: string,
  payload: { title: string; body: string; url?: string },
) {
  if (!vapidReady) return

  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.actorId, actorId),
  })

  const payloadStr = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
        )
      } catch (err: unknown) {
        // 410 Gone veya 404: abonelik geçersiz, sil
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
        }
      }
    }),
  )
}
