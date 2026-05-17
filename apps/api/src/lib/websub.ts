import { createHmac, randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import { websubSubscriptions } from '../db/schema.js'
import { eq, and, gt } from 'drizzle-orm'
import { env } from './env.js'

export const HUB_URL = `${env.APP_URL}/websub/hub`
const DEFAULT_LEASE_SECONDS = 60 * 60 * 24 * 30 // 30 days

// Verify a subscription via the W3C WebSub challenge handshake
export async function verifySubscription(
  callback: string,
  mode: 'subscribe' | 'unsubscribe',
  topic: string,
  leaseSeconds: number,
): Promise<boolean> {
  const challenge = randomBytes(20).toString('hex')
  const url = new URL(callback)
  url.searchParams.set('hub.mode', mode)
  url.searchParams.set('hub.topic', topic)
  url.searchParams.set('hub.challenge', challenge)
  if (mode === 'subscribe') url.searchParams.set('hub.lease_seconds', String(leaseSeconds))

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.trim() === challenge
  } catch {
    return false
  }
}

// Add or renew a subscription (verifies first)
export async function subscribe(
  topic: string,
  callback: string,
  secret: string | undefined,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): Promise<boolean> {
  const valid = await verifySubscription(callback, 'subscribe', topic, leaseSeconds)
  if (!valid) return false

  const expiresAt = new Date(Date.now() + leaseSeconds * 1000)
  await db.insert(websubSubscriptions)
    .values({ topic, callback, secret: secret ?? null, expiresAt, status: 'active' })
    .onConflictDoUpdate({
      target: [websubSubscriptions.topic, websubSubscriptions.callback],
      set: { secret: secret ?? null, expiresAt, status: 'active' },
    })
  return true
}

// Remove a subscription (verifies unsubscribe challenge first)
export async function unsubscribe(topic: string, callback: string): Promise<void> {
  await verifySubscription(callback, 'unsubscribe', topic, 0)
  await db.delete(websubSubscriptions)
    .where(and(
      eq(websubSubscriptions.topic, topic),
      eq(websubSubscriptions.callback, callback),
    ))
}

// Fetch the topic feed and distribute to all active subscribers
export async function notifySubscribers(topic: string): Promise<void> {
  try {
    const res = await fetch(topic, {
      headers: { Accept: 'application/rss+xml' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return
    const feedXml = await res.text()
    await distribute(topic, feedXml)
  } catch { /* best-effort */ }
}

// Push feed content to all active subscribers of a topic
export async function distribute(topic: string, feedXml: string): Promise<void> {
  const now = new Date()
  const subs = await db.query.websubSubscriptions.findMany({
    where: and(
      eq(websubSubscriptions.topic, topic),
      eq(websubSubscriptions.status, 'active'),
      gt(websubSubscriptions.expiresAt, now),
    ),
  })

  await Promise.allSettled(subs.map(async (sub) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/rss+xml',
      'Link': `<${topic}>; rel="self", <${HUB_URL}>; rel="hub"`,
    }

    if (sub.secret) {
      const sig = createHmac('sha256', sub.secret).update(feedXml).digest('hex')
      headers['X-Hub-Signature'] = `sha256=${sig}`
    }

    await fetch(sub.callback, {
      method: 'POST',
      headers,
      body: feedXml,
      signal: AbortSignal.timeout(15_000),
    })
  }))
}
