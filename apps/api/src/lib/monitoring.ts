import * as Sentry from '@sentry/node'
import { env } from './env.js'

let initialized = false

export async function initMonitoring() {
  if (!env.SENTRY_DSN || initialized) return
  initialized = true

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  })
}

export function captureException(err: unknown) {
  if (!initialized) return
  Sentry.captureException(err)
}

export function captureMessage(msg: string) {
  if (!initialized) return
  Sentry.captureMessage(msg)
}
