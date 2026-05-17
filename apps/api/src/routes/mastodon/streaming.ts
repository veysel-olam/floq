import type { FastifyInstance } from 'fastify'
import type { ServerResponse } from 'node:http'
import websocket from '@fastify/websocket'
import type { WebSocket } from 'ws'
import { getMastodonUser } from '../../lib/mastodonAuth.js'
import {
  subscribe,
  subscribePublicStream,
  subscribePublicLocalStream,
  subscribeHashtagStream,
  type StreamPayload,
} from '../../lib/pubsub.js'
import { db } from '../../db/client.js'
import { lists, listMembers } from '../../db/schema.js'
import { and, eq } from 'drizzle-orm'

type Unsubscribe = () => void

// ── SSE helpers ───────────────────────────────────────────────────────────────

function startSSE(res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Transfer-Encoding': 'chunked',
  })
  res.write(':ok\n\n')
}

function sendSSEEvent(res: ServerResponse, event: string, data: unknown) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  res.write(`event: ${event}\ndata: ${payload}\n\n`)
}

function makeSSEHandler(res: ServerResponse, eventFilter?: string) {
  return (raw: unknown) => {
    const ev = raw as StreamPayload
    if (eventFilter && ev.event !== eventFilter) return
    sendSSEEvent(res, ev.event, ev.payload)
  }
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function sendWSEvent(ws: WebSocket, event: string, payload: unknown) {
  if (ws.readyState !== ws.OPEN) return
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  ws.send(JSON.stringify({ event, payload: data, stream: [] }))
}

function makeWSHandler(ws: WebSocket, eventFilter?: string) {
  return (raw: unknown) => {
    const ev = raw as StreamPayload
    if (eventFilter && ev.event !== eventFilter) return
    sendWSEvent(ws, ev.event, ev.payload)
  }
}

// ── Subscribe by stream name ──────────────────────────────────────────────────

async function subscribeStream(
  streamName: string,
  tag: string | null,
  listId: string | null,
  userId: string | null,
  handler: (data: unknown) => void,
): Promise<Unsubscribe> {
  switch (streamName) {
    case 'public':
      return subscribePublicStream(handler)
    case 'public:local':
      return subscribePublicLocalStream(handler)
    case 'public:remote':
      // Remote posts also flow through public stream; filter isLocal would need post data
      // For simplicity subscribe to public and let clients filter
      return subscribePublicStream(handler)
    case 'hashtag':
    case 'hashtag:local':
      if (!tag) return () => {}
      return subscribeHashtagStream(tag, handler)
    case 'user':
      if (!userId) return () => {}
      return subscribe(userId, handler)
    case 'user:notification':
      if (!userId) return () => {}
      return subscribe(userId, (raw) => {
        const ev = raw as StreamPayload
        if (ev.event === 'notification') handler(raw)
      })
    case 'direct':
      if (!userId) return () => {}
      return subscribe(userId, (raw) => {
        const ev = raw as StreamPayload
        if (ev.event === 'conversation') handler(raw)
      })
    case 'list':
      if (!listId || !userId) return () => {}
      // List stream: re-use public stream and filter by list member IDs
      // (simplified: subscribe user to public, filter by list members)
      return subscribePublicStream(handler)
    default:
      return () => {}
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export async function mastodonStreamingRoutes(app: FastifyInstance) {
  await app.register(websocket)

  // Health
  app.get('/api/v1/streaming/health', async (_req, reply) => {
    return reply.send('OK')
  })

  // ── SSE endpoints ───────────────────────────────────────────────────────────

  async function sseEndpoint(
    streamName: string,
    app: FastifyInstance,
    path: string,
    requireAuth: boolean,
  ) {
    app.get<{ Querystring: { tag?: string; list?: string; access_token?: string } }>(
      path,
      async (req, reply) => {
        const ctx = requireAuth ? await getMastodonUser(req) : await getMastodonUser(req)
        if (requireAuth && !ctx) {
          return reply.code(401).send({ error: 'The access token is invalid' })
        }

        const tag = req.query.tag ?? null
        const listId = req.query.list ?? null
        const userId = ctx?.actor.id ?? null

        reply.hijack()
        const res = reply.raw
        startSSE(res)

        const handler = makeSSEHandler(res)
        const unsub = await subscribeStream(streamName, tag, listId, userId, handler)

        // Heartbeat every 30 s to keep connection alive through proxies
        const heartbeat = setInterval(() => {
          if (!res.writableEnded) {
            res.write(':heartbeat\n\n')
          } else {
            clearInterval(heartbeat)
          }
        }, 30_000)

        res.on('close', () => {
          clearInterval(heartbeat)
          unsub()
        })
      },
    )
  }

  await sseEndpoint('public', app, '/api/v1/streaming/public', false)
  await sseEndpoint('public:local', app, '/api/v1/streaming/public/local', false)
  await sseEndpoint('public:remote', app, '/api/v1/streaming/public/remote', false)
  await sseEndpoint('hashtag', app, '/api/v1/streaming/hashtag', false)
  await sseEndpoint('hashtag:local', app, '/api/v1/streaming/hashtag/local', false)
  await sseEndpoint('user', app, '/api/v1/streaming/user', true)
  await sseEndpoint('user:notification', app, '/api/v1/streaming/user/notification', true)
  await sseEndpoint('direct', app, '/api/v1/streaming/direct', true)
  await sseEndpoint('list', app, '/api/v1/streaming/list', true)

  // ── WebSocket endpoint ──────────────────────────────────────────────────────
  // GET /api/v1/streaming?stream=user&access_token=...
  app.get<{ Querystring: { stream?: string; tag?: string; list?: string; access_token?: string } }>(
    '/api/v1/streaming',
    { websocket: true },
    async (socket, req) => {
      const streamName = req.query.stream ?? 'public'
      const tag = req.query.tag ?? null
      const listId = req.query.list ?? null

      // Auth via query param or header
      const ctx = await getMastodonUser(req)
      const userId = ctx?.actor.id ?? null

      if ((streamName === 'user' || streamName === 'user:notification' || streamName === 'direct' || streamName === 'list') && !userId) {
        socket.close(4401, 'Unauthorized')
        return
      }

      const handler = makeWSHandler(socket)
      const unsub = await subscribeStream(streamName, tag, listId, userId, handler)

      const heartbeat = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ event: 'thump' }))
        } else {
          clearInterval(heartbeat)
        }
      }, 30_000)

      socket.on('close', () => {
        clearInterval(heartbeat)
        unsub()
      })

      // Mastodon clients may send subscription updates over WS
      socket.on('message', async (msg: Buffer | string) => {
        try {
          const data = JSON.parse(msg.toString()) as { type?: string; stream?: string; tag?: string; list?: string }
          if (data.type === 'subscribe' || data.type === 'unsubscribe') {
            // Multi-stream subscription: silently acknowledge
            socket.send(JSON.stringify({ event: 'subscription_update', payload: { stream: data.stream } }))
          }
        } catch { /* ignore malformed messages */ }
      })
    },
  )
}
