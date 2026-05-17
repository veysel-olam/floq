import type { FastifyInstance } from 'fastify'
import { mastodonInstanceRoutes } from './instance.js'
import { mastodonOAuthRoutes } from './oauth.js'
import { mastodonAccountRoutes } from './accounts.js'
import { mastodonStatusRoutes } from './statuses.js'
import { mastodonTimelineRoutes } from './timelines.js'
import { mastodonNotificationRoutes } from './notifications.js'
import { mastodonSearchRoutes } from './search.js'
import { mastodonMediaRoutes } from './media.js'
import { mastodonStreamingRoutes } from './streaming.js'

export async function mastodonRoutes(app: FastifyInstance) {
  await app.register(mastodonInstanceRoutes)
  await app.register(mastodonOAuthRoutes)
  await app.register(mastodonAccountRoutes)
  await app.register(mastodonStatusRoutes)
  await app.register(mastodonTimelineRoutes)
  await app.register(mastodonNotificationRoutes)
  await app.register(mastodonSearchRoutes)
  await app.register(mastodonMediaRoutes)
  await app.register(mastodonStreamingRoutes)
}
