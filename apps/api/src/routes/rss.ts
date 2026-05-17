import type { FastifyInstance } from 'fastify'
import { eq, and, desc, arrayContains } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts } from '../db/schema.js'
import { env } from '../lib/env.js'
import { HUB_URL } from '../lib/websub.js'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildFeed(opts: {
  title: string
  description: string
  link: string
  feedUrl: string
  items: Array<{ title: string; link: string; description: string; pubDate: string; guid: string }>
}): string {
  const items = opts.items.map((item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
    </item>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <link>${escapeXml(opts.link)}</link>
    <description>${escapeXml(opts.description)}</description>
    <language>tr</language>
    <atom:link href="${escapeXml(opts.feedUrl)}" rel="self" type="application/rss+xml"/>
    <atom:link href="${escapeXml(HUB_URL)}" rel="hub"/>
    ${items}
  </channel>
</rss>`
}

export async function rssRoutes(app: FastifyInstance) {
  // ── Profil RSS feed ─────────────────────────────────────────────────────────
  app.get<{ Params: { handle: string } }>('/:handle/rss', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const feed = await db.query.posts.findMany({
      where: and(
        eq(posts.authorId, actor.id),
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
        eq(posts.isLocal, true),
      ),
      orderBy: [desc(posts.createdAt)],
      limit: 20,
    })

    const profileUrl = `${env.APP_URL}/${actor.handle}`
    const feedUrl = `${env.APP_URL}/${actor.handle}/rss`
    const name = actor.displayName ?? actor.handle

    const items = feed.map((p) => {
      const postUrl = `${env.APP_URL}/${actor.handle}/posts/${p.id}`
      // First line of content as title, rest as description
      const firstLine = p.content.split('\n')[0]?.slice(0, 100) ?? ''
      return {
        title: firstLine || `@${actor.handle}`,
        link: postUrl,
        description: p.content,
        pubDate: p.createdAt.toUTCString(),
        guid: postUrl,
      }
    })

    reply.header('Content-Type', 'application/rss+xml; charset=utf-8')
    reply.header('Link', `<${feedUrl}>; rel="self", <${HUB_URL}>; rel="hub"`)
    return reply.send(buildFeed({
      title: `${name} (@${actor.handle}) — floq`,
      description: actor.bio ?? `${name} gönderileri`,
      link: profileUrl,
      feedUrl,
      items,
    }))
  })

  // ── Hashtag RSS feed ─────────────────────────────────────────────────────────
  app.get<{ Params: { tag: string } }>('/tags/:tag/rss', async (req, reply) => {
    const tag = req.params.tag.toLowerCase()

    const feed = await db.query.posts.findMany({
      where: and(
        arrayContains(posts.tags, [tag]),
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
      ),
      with: { author: true },
      orderBy: [desc(posts.createdAt)],
      limit: 20,
    })

    const tagUrl = `${env.APP_URL}/hashtag/${encodeURIComponent(tag)}`
    const feedUrl = `${env.APP_URL}/tags/${encodeURIComponent(tag)}/rss`

    const items = feed.map((p) => {
      const postUrl = `${env.APP_URL}/${p.author.handle}/posts/${p.id}`
      const firstLine = p.content.split('\n')[0]?.slice(0, 100) ?? ''
      return {
        title: firstLine || `@${p.author.handle}`,
        link: postUrl,
        description: p.content,
        pubDate: p.createdAt.toUTCString(),
        guid: postUrl,
      }
    })

    reply.header('Content-Type', 'application/rss+xml; charset=utf-8')
    reply.header('Link', `<${feedUrl}>; rel="self", <${HUB_URL}>; rel="hub"`)
    return reply.send(buildFeed({
      title: `#${tag} — floq`,
      description: `#${tag} etiketli gönderiler`,
      link: tagUrl,
      feedUrl,
      items,
    }))
  })
}
