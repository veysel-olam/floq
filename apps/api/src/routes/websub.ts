import type { FastifyInstance } from 'fastify'
import { subscribe, unsubscribe, HUB_URL } from '../lib/websub.js'
import { env } from '../lib/env.js'

export async function websubRoutes(app: FastifyInstance) {
  // POST /websub/hub — W3C WebSub hub endpoint
  app.post('/websub/hub', {
    config: { rawBody: true },
  }, async (req, reply) => {
    // WebSub requests come as application/x-www-form-urlencoded
    const body = req.body as Record<string, string> | undefined
    if (!body) return reply.code(400).send('Bad Request')

    const mode = body['hub.mode']
    const topic = body['hub.topic']
    const callback = body['hub.callback']
    const secret = body['hub.secret'] || undefined
    const leaseSecs = Number(body['hub.lease_seconds']) || undefined

    if (!topic || !callback) return reply.code(400).send('hub.topic and hub.callback are required')

    // Only allow subscriptions to our own RSS feeds
    const allowedPrefixes = [
      `${env.APP_URL}/`,
    ]
    if (!allowedPrefixes.some((p) => topic.startsWith(p))) {
      return reply.code(422).send('Topic not supported')
    }

    if (mode === 'subscribe') {
      // 202 immediately — verification happens async
      reply.code(202).send('')
      void subscribe(topic, callback, secret, leaseSecs)
    } else if (mode === 'unsubscribe') {
      reply.code(202).send('')
      void unsubscribe(topic, callback)
    } else if (mode === 'publish') {
      // Publisher pinging hub about updated content — not used (we self-publish), ignore
      return reply.code(200).send('')
    } else {
      return reply.code(422).send('Unknown hub.mode')
    }
  })
}
