import 'dotenv/config'
import { initMonitoring } from './lib/monitoring.js'
await initMonitoring()
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { db } from './db/client.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './lib/env.js'
import { connectRedis } from './lib/redis.js'
import { authRoutes } from './routes/auth.js'
import { postsRoutes } from './routes/posts.js'
import { timelineRoutes } from './routes/timeline.js'
import { actorsRoutes } from './routes/actors.js'
import { notificationsRoutes } from './routes/notifications.js'
import { accountRoutes } from './routes/account.js'
import { feedRulesRoutes } from './routes/feedRules.js'
import { listsRoutes } from './routes/lists.js'
import { activityPubRoutes } from './routes/activitypub.js'
import { startFederationWorker } from './jobs/federation.js'
import { captureException } from './lib/monitoring.js'
import { momentsRoutes } from './routes/moments.js'
import { flowsRoutes } from './routes/flows.js'
import { mediaRoutes } from './routes/media.js'
import { searchRoutes } from './routes/search.js'
import { pulseRoutes } from './routes/pulse.js'
import { invitesRoutes } from './routes/invites.js'
import { streamRoutes } from './routes/stream.js'
import { spacesRoutes } from './routes/spaces.js'
import { moderationRoutes } from './routes/moderation.js'
import { filtersRoutes } from './routes/filters.js'
import { adminRoutes } from './routes/admin.js'
import { proxyRoutes } from './routes/proxy.js'
import { dmRoutes } from './routes/dm.js'
import { postCollectionsRoutes } from './routes/postCollections.js'
import { atProtocolRoutes } from './routes/atprotocol.js'
import { pollsRoutes } from './routes/polls.js'
import { gifsRoutes } from './routes/gifs.js'
import { translateRoutes } from './routes/translate.js'
import { pushRoutes } from './routes/push.js'
import { closeFriendsRoutes } from './routes/closeFriends.js'
import { rssRoutes } from './routes/rss.js'
import { oembedRoutes } from './routes/oembed.js'
import { passkeyRoutes } from './routes/passkeys.js'
import { mastodonRoutes } from './routes/mastodon/index.js'
import { relayRoutes } from './routes/relay.js'
import { websubRoutes } from './routes/websub.js'
import { nostrRoutes } from './routes/nostr.js'
import { groupRoutes } from './routes/groups.js'
import { blueskyRoutes } from './routes/bluesky.js'
import { moderationV2Routes } from './routes/moderationV2.js'
import { hashtagsRoutes } from './routes/hashtags.js'
import { initPubSub } from './lib/pubsub.js'
import { initS3Bucket } from './lib/s3.js'
import { startMomentsWorker } from './jobs/moments.js'
import { startSchedulerWorker } from './jobs/scheduler.js'
import multipart from '@fastify/multipart'

const loggerOptions =
  env.NODE_ENV === 'development'
    ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: 'warn' }

const app = Fastify({ logger: loggerOptions })

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  // ActivityPub endpoints need AP content type — don't block
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow: same-origin, configured web URL, federation (no origin), and any Mastodon client
    // Mastodon-compatible clients (Ivory, Tusky, Elk, Mona) use Authorization: Bearer — not cookies.
    // We can safely allow all origins because auth is token-based for the Mastodon API.
    if (!origin) return cb(null, true)   // server-to-server (no origin header)
    if (origin === env.WEB_URL) return cb(null, true)
    // Allow clients that use Bearer token auth (Mastodon clients)
    return cb(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})
// Global rate limit — only active in production (skip option unsupported in @fastify/rate-limit v10)
if (env.NODE_ENV === 'production') {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ error: 'Too many requests, please slow down.' }),
  })
}
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

// X-Onion-Location: advertise Tor hidden service if configured
if (env.TOR_ONION_URL) {
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Onion-Location', env.TOR_ONION_URL!)
  })
}

// Routes
await app.register(authRoutes)
await app.register(postsRoutes)
await app.register(timelineRoutes)
await app.register(actorsRoutes)
await app.register(notificationsRoutes)
await app.register(accountRoutes)
await app.register(feedRulesRoutes)
await app.register(listsRoutes)
await app.register(activityPubRoutes)
await app.register(momentsRoutes)
await app.register(flowsRoutes)
await app.register(mediaRoutes)
await app.register(searchRoutes)
await app.register(pulseRoutes)
await app.register(invitesRoutes)
await app.register(streamRoutes)
await app.register(spacesRoutes)
await app.register(moderationRoutes)
await app.register(filtersRoutes)
await app.register(adminRoutes)
await app.register(proxyRoutes)
await app.register(dmRoutes)
await app.register(postCollectionsRoutes)
await app.register(atProtocolRoutes)
await app.register(pollsRoutes)
await app.register(gifsRoutes)
await app.register(translateRoutes)
await app.register(pushRoutes)
await app.register(closeFriendsRoutes)
await app.register(rssRoutes)
await app.register(oembedRoutes)
await app.register(passkeyRoutes)
await app.register(mastodonRoutes)
await app.register(relayRoutes)
await app.register(websubRoutes)
await app.register(nostrRoutes)
await app.register(groupRoutes)
await app.register(blueskyRoutes)
await app.register(moderationV2Routes)
await app.register(hashtagsRoutes)

// Global error handler
app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = (err as { statusCode?: number }).statusCode ?? 500
  if (status >= 500) captureException(err)
  app.log.error(err)
  void reply.status(status).send({ error: err.message })
})

// Health
app.get('/health', async () => ({ status: 'ok', domain: env.APP_DOMAIN }))

// ALTER TYPE ADD VALUE cannot run inside a transaction (some PG versions reject it).
// Run it here, before migrate(), so the migration transaction only handles CREATE TABLE.
try {
  await db.execute(sql`ALTER TYPE visibility ADD VALUE IF NOT EXISTS 'close_friends'`)
} catch { /* already exists */ }

// DB migrations
await migrate(db, { migrationsFolder: './drizzle' })

// Redis bağlantısı
await connectRedis()
await initPubSub()
app.log.info('Redis connected + PubSub ready')

// S3/MinIO bucket
await initS3Bucket()
app.log.info('S3 bucket ready')

startFederationWorker()
startMomentsWorker()
startSchedulerWorker()
app.log.info('Federation + moments + scheduler workers started')

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
