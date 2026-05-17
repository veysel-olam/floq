import type { FastifyInstance } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { actors, posts, instanceSettings, instanceRules } from '../../db/schema.js'
import { env } from '../../lib/env.js'

const INSTANCE_BASE = {
  uri: env.APP_DOMAIN,
  title: 'floq',
  short_description: 'Açık kaynak, federe sosyal ağ',
  description: 'floq — ActivityPub destekli, açık kaynak, federe sosyal ağ.',
  email: `admin@${env.APP_DOMAIN}`,
  version: '4.3.0+floq-1.0',  // Mastodon-compatible version string
  urls: { streaming_api: `wss://${env.APP_DOMAIN}` },
  stats: { user_count: 0, status_count: 0, domain_count: 1 },
  languages: ['tr', 'en'],
  contact_account: null,
  rules: [],
  registrations: true,
  approval_required: false,
  invites_enabled: false,
  configuration: {
    statuses: { max_characters: 500, max_media_attachments: 4, characters_reserved_per_url: 23 },
    media_attachments: {
      supported_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
      image_size_limit: 10485760,
      image_matrix_limit: 16777216,
      video_size_limit: 41943040,
      video_frame_rate_limit: 60,
      video_matrix_limit: 2304000,
    },
    polls: { max_options: 4, max_characters_per_option: 50, min_expiration: 300, max_expiration: 2629746 },
    translation: { enabled: false },
  },
}

export async function mastodonInstanceRoutes(app: FastifyInstance) {
  async function getStats() {
    const [users] = await db.select({ count: sql<number>`count(*)::int` }).from(actors).where(eq(actors.isLocal, true))
    const [statuses] = await db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.isLocal, true))
    return { user_count: users?.count ?? 0, status_count: statuses?.count ?? 0, domain_count: 1 }
  }

  async function getInstanceMeta() {
    const [settings, rules] = await Promise.all([
      db.query.instanceSettings.findFirst(),
      db.query.instanceRules.findMany({ orderBy: [instanceRules.position] }),
    ])
    const mode = settings?.registrationMode ?? 'open'
    return {
      registrations: mode === 'open',
      approval_required: mode === 'approval',
      invites_enabled: mode === 'invite_only',
      rules: rules.map((r, i) => ({ id: r.id, text: r.text, hint: r.hint ?? null, position: i })),
      configuration: {
        ...INSTANCE_BASE.configuration,
        statuses: {
          ...INSTANCE_BASE.configuration.statuses,
          max_characters: settings?.maxPostLength ?? 500,
        },
      },
    }
  }

  app.get('/api/v1/instance', async (_req, reply) => {
    const [stats, meta] = await Promise.all([getStats(), getInstanceMeta()])
    return reply.send({ ...INSTANCE_BASE, stats, ...meta })
  })

  app.get('/api/v2/instance', async (_req, reply) => {
    const [stats, meta] = await Promise.all([getStats(), getInstanceMeta()])
    return reply.send({
      domain: env.APP_DOMAIN,
      title: INSTANCE_BASE.title,
      version: INSTANCE_BASE.version,
      source_url: 'https://github.com/veyselolam/floq',
      description: INSTANCE_BASE.description,
      usage: { users: { active_month: stats.user_count } },
      thumbnail: { url: `${env.WEB_URL}/logo.png` },
      languages: INSTANCE_BASE.languages,
      configuration: meta.configuration,
      registrations: { enabled: meta.registrations, approval_required: meta.approval_required, message: null },
      contact: { email: INSTANCE_BASE.email, account: null },
      rules: meta.rules,
    })
  })

  // Mastodon custom emojis (our local emojis)
  app.get('/api/v1/custom_emojis', async (_req, reply) => {
    const { customEmojis } = await import('../../db/schema.js')
    const emojis = await db.query.customEmojis.findMany({
      where: eq(customEmojis.visibleInPicker, true),
    })
    return reply.send(emojis.map((e) => ({
      shortcode: e.shortcode,
      url: e.imageUrl,
      static_url: e.imageUrl,
      visible_in_picker: e.visibleInPicker,
    })))
  })

  // Mastodon trends/tags
  app.get('/api/v1/trends/tags', async (_req, reply) => {
    return reply.send([])
  })

  app.get('/api/v1/trends/statuses', async (_req, reply) => {
    return reply.send([])
  })

  app.get('/api/v1/trends/links', async (_req, reply) => {
    return reply.send([])
  })

  // Mastodon announcements
  app.get('/api/v1/announcements', async (_req, reply) => {
    return reply.send([])
  })

  // Mastodon preferences (stub)
  app.get('/api/v1/preferences', async (_req, reply) => {
    return reply.send({
      'posting:default:visibility': 'public',
      'posting:default:sensitive': false,
      'posting:default:language': 'tr',
      'reading:expand:media': 'default',
      'reading:expand:spoilers': false,
    })
  })
}
