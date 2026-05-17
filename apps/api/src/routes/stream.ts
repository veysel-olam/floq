import type { FastifyInstance } from 'fastify'
import { getSession } from '../lib/session.js'
import { subscribe } from '../lib/pubsub.js'

export async function streamRoutes(app: FastifyInstance) {
  app.get('/api/stream', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = await getSession(req)
    if (!session) return reply.code(401).send({ error: 'Unauthorized' })

    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    // Initial heartbeat so the client knows the connection is live
    send('connected', { ts: Date.now() })

    const unsub = subscribe(session.user.id, (data) => {
      const { event, payload } = data as { event: string; payload: unknown }
      send(event, payload)
    })

    // Heartbeat every 25s to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 25000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsub()
    })

    // Keep the handler alive — don't resolve the promise
    await new Promise<void>((resolve) => req.raw.on('close', resolve))
  })
}
