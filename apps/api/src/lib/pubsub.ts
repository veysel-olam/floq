import { redis } from './redis.js'
import type { RedisClientType } from 'redis'

type Handler = (data: unknown) => void

// channel key → set of handlers
const handlers = new Map<string, Set<Handler>>()
let subClient: RedisClientType | null = null

type PSubscribable = {
  pSubscribe(pattern: string, cb: (message: string, channel: string) => void): Promise<void>
}

export async function initPubSub() {
  subClient = redis.duplicate() as RedisClientType
  await subClient.connect()

  // Single pattern covers all namespaced channels: user:*, space:*, etc.
  await (subClient as unknown as PSubscribable).pSubscribe('floq:*', (message, channel) => {
    const set = handlers.get(channel)
    if (!set) return
    let parsed: unknown
    try { parsed = JSON.parse(message) } catch { return }
    set.forEach((h) => h(parsed))
  })
}

function subscribeToChannel(channel: string, handler: Handler): () => void {
  if (!handlers.has(channel)) handlers.set(channel, new Set())
  handlers.get(channel)!.add(handler)
  return () => {
    const set = handlers.get(channel)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) handlers.delete(channel)
  }
}

async function publishToChannel(channel: string, data: unknown) {
  await redis.publish(channel, JSON.stringify(data))
}

// ── User notifications ────────────────────────────────────────────────────────

export function subscribe(userId: string, handler: Handler) {
  return subscribeToChannel(`floq:user:${userId}`, handler)
}

export async function publish(userId: string, data: unknown) {
  await publishToChannel(`floq:user:${userId}`, data)
}

// ── Space messages ────────────────────────────────────────────────────────────

export function subscribeSpace(spaceId: string, handler: Handler) {
  return subscribeToChannel(`floq:space:${spaceId}`, handler)
}

export async function publishSpace(spaceId: string, data: unknown) {
  await publishToChannel(`floq:space:${spaceId}`, data)
}

// ── Mastodon streaming channels ───────────────────────────────────────────────

export type StreamPayload = { event: string; payload: unknown }

export function subscribePublicStream(handler: Handler) {
  return subscribeToChannel('floq:stream:public', handler)
}

export async function publishPublicStream(payload: StreamPayload) {
  await publishToChannel('floq:stream:public', payload)
}

export function subscribePublicLocalStream(handler: Handler) {
  return subscribeToChannel('floq:stream:public:local', handler)
}

export async function publishPublicLocalStream(payload: StreamPayload) {
  await publishToChannel('floq:stream:public:local', payload)
}

export function subscribeHashtagStream(tag: string, handler: Handler) {
  return subscribeToChannel(`floq:stream:hashtag:${tag.toLowerCase()}`, handler)
}

export async function publishHashtagStream(tag: string, payload: StreamPayload) {
  await publishToChannel(`floq:stream:hashtag:${tag.toLowerCase()}`, payload)
}
