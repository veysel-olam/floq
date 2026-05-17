import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts } from '../db/schema.js'
import { env } from '../lib/env.js'

export async function oembedRoutes(app: FastifyInstance) {
  // GET /oembed?url=...&maxwidth=...&maxheight=...&format=json
  // Supports: /{handle}/posts/{postId} and /{handle} profile URLs
  app.get('/oembed', async (req, reply) => {
    const { url, format } = req.query as Record<string, string>

    if (!url) return reply.code(400).send({ error: 'url required' })
    if (format && format !== 'json') return reply.code(501).send({ error: 'Only JSON format supported' })

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reply.code(400).send({ error: 'Invalid URL' })
    }

    // Only handle URLs from this instance
    const baseOrigin = new URL(env.WEB_URL).origin
    if (parsed.origin !== baseOrigin) {
      return reply.code(404).send({ error: 'Not found' })
    }

    // Match /{handle}/posts/{postId}
    const postMatch = parsed.pathname.match(/^\/([^/]+)\/posts\/([^/]+)$/)
    if (postMatch) {
      const [, handle, postId] = postMatch
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId!),
        with: { author: true },
      })
      if (!post || post.author.handle !== handle || post.isDeleted || post.visibility !== 'public') {
        return reply.code(404).send({ error: 'Not found' })
      }

      const authorName = post.author.displayName ?? `@${post.author.handle}`
      const authorUrl = `${env.WEB_URL}/${post.author.handle}`
      const postUrl = `${env.WEB_URL}/${post.author.handle}/posts/${post.id}`
      const firstLine = post.content.replace(/<[^>]+>/g, '').split('\n')[0]?.slice(0, 100) ?? ''

      reply.header('Content-Type', 'application/json+oembed')
      return reply.send({
        version: '1.0',
        type: 'rich',
        title: firstLine || `Post by ${authorName}`,
        author_name: authorName,
        author_url: authorUrl,
        provider_name: 'floq',
        provider_url: env.WEB_URL,
        cache_age: 86400,
        html: `<blockquote class="floq-post"><a href="${postUrl}">${firstLine || 'See post'}</a> — <a href="${authorUrl}">${authorName}</a></blockquote>`,
        width: 550,
        height: null,
      })
    }

    // Match /{handle} profile
    const profileMatch = parsed.pathname.match(/^\/([^/]+)$/)
    if (profileMatch) {
      const [, handle] = profileMatch
      const actor = await db.query.actors.findFirst({
        where: eq(actors.handle, handle!),
      })
      if (!actor) return reply.code(404).send({ error: 'Not found' })

      const name = actor.displayName ?? `@${actor.handle}`
      const profileUrl = `${env.WEB_URL}/${actor.handle}`

      reply.header('Content-Type', 'application/json+oembed')
      return reply.send({
        version: '1.0',
        type: 'rich',
        title: `${name} on floq`,
        author_name: name,
        author_url: profileUrl,
        provider_name: 'floq',
        provider_url: env.WEB_URL,
        cache_age: 86400,
        html: `<blockquote class="floq-profile"><a href="${profileUrl}">${name}</a>${actor.bio ? ` — ${actor.bio.replace(/<[^>]+>/g, '').slice(0, 160)}` : ''}</blockquote>`,
        width: 550,
        height: null,
      })
    }

    return reply.code(404).send({ error: 'Not found' })
  })
}
