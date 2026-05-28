import type { FastifyInstance } from 'fastify'
import { auth } from '../lib/auth.js'

import { env } from '../lib/env.js'

const SENSITIVE_PATHS = [
  '/api/auth/sign-in',
  '/api/auth/sign-up',
  '/api/auth/request-password-reset',
  '/api/auth/send-verification-email',
]

export async function authRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  app.all('/api/auth/*', {
    config: {
      rateLimit: env.NODE_ENV === 'production' ? {
        max: (req: { url: string }) => (SENSITIVE_PATHS.some((p) => req.url.startsWith(p)) ? 10 : 60),
        timeWindow: '15 minutes',
        keyGenerator: (req: { ip: string }) => req.ip,
        errorResponseBuilder: () => ({ error: 'Too many attempts, please try again later.' }),
      } : false,
    },
  }, async (req, reply) => {
    const url = `${req.protocol}://${req.hostname}${req.url}`

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v))
        } else {
          headers.set(key, value)
        }
      }
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const body = hasBody && req.body ? String(req.body) : null

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    })

    const response = await auth.handler(request)

    reply.status(response.status)
    response.headers.forEach((value: string, key: string) => {
      void reply.header(key, value)
    })

    const responseBody = await response.text()
    reply.send(responseBody)
  })
}
