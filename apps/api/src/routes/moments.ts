import type { FastifyInstance } from 'fastify'
import { eq, and, gt, desc, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { posts, actors, follows, mediaAttachments } from '../db/schema.js'
import { requireActor, getSession } from '../lib/session.js'
import { env } from '../lib/env.js'
import { scheduleMomentExpiry } from '../jobs/moments.js'

const MOMENT_DURATION_HOURS = 24

export async function momentsRoutes(app: FastifyInstance) {
  // GET /api/moments — active moments from followed users (+ own)
  app.get('/api/moments', async (req, reply) => {
    const session = await getSession(req)
    if (!session) return reply.code(401).send({ error: 'Unauthorized' })

    const viewer = await db.query.actors.findFirst({
      where: eq(actors.userId, session.user.id),
    })
    if (!viewer) return reply.code(401).send({ error: 'Unauthorized' })

    // Get active moments from followed users + self using sql tag
    const rows = await db.execute(
      sql`SELECT
        p.id, p.content, p.expires_at, p.created_at,
        a.id   AS author_id,
        a.handle AS author_handle,
        a.display_name AS author_display_name,
        a.avatar_url AS author_avatar_url
       FROM posts p
       JOIN actors a ON a.id = p.author_id
       WHERE p.is_ephemeral = true
         AND p.is_deleted = false
         AND p.expires_at > NOW()
         AND (
           p.author_id = ${viewer.id}
           OR p.author_id IN (
             SELECT following_id FROM follows
             WHERE follower_id = ${viewer.id} AND status = 'accepted'
           )
         )
       ORDER BY a.id, p.created_at ASC`,
    )

    type MomentRow = {
      id: string
      content: string
      expires_at: Date
      created_at: Date
      author_id: string
      author_handle: string
      author_display_name: string | null
      author_avatar_url: string | null
      media?: { url: string; width: number | null; height: number | null }[]
    }

    // Group by author
    const byAuthor = new Map<
      string,
      { actor: { id: string; handle: string; displayName: string | null; avatarUrl: string | null }; moments: MomentRow[] }
    >()
    for (const row of rows.rows as MomentRow[]) {
      if (!byAuthor.has(row.author_id)) {
        byAuthor.set(row.author_id, {
          actor: {
            id: row.author_id,
            handle: row.author_handle,
            displayName: row.author_display_name,
            avatarUrl: row.author_avatar_url,
          },
          moments: [],
        })
      }
      byAuthor.get(row.author_id)!.moments.push(row)
    }

    // Fetch media for all moments
    const momentIds = [...byAuthor.values()].flatMap(g => g.moments.map(m => m.id))
    let mediaByPost: Record<string, { url: string; width: number | null; height: number | null }[]> = {}
    if (momentIds.length > 0) {
      const mediaRows = await db.query.mediaAttachments.findMany({
        where: inArray(mediaAttachments.postId, momentIds),
        columns: { postId: true, url: true, width: true, height: true },
      })
      for (const m of mediaRows) {
        if (!m.postId) continue
        if (!mediaByPost[m.postId]) mediaByPost[m.postId] = []
        mediaByPost[m.postId]!.push({ url: m.url, width: m.width, height: m.height })
      }
    }

    // Attach media to each moment
    for (const group of byAuthor.values()) {
      for (const moment of group.moments) {
        moment.media = mediaByPost[moment.id] ?? []
      }
    }

    return reply.send({ groups: [...byAuthor.values()] })
  })

  // POST /api/moments — create a moment
  app.post('/api/moments', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z
      .object({
        content: z.string().max(500),
        mediaId: z.string().uuid().optional(),
      })
      .refine(d => d.content.trim().length > 0 || d.mediaId, {
        message: 'Content or media required',
      })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const expiresAt = new Date(Date.now() + MOMENT_DURATION_HOURS * 60 * 60 * 1000)
    const apId = `${env.APP_URL}/users/${ctx.actor.handle}/moments/placeholder`

    const [post] = await db
      .insert(posts)
      .values({
        authorId: ctx.actor.id,
        content: body.data.content,
        visibility: 'public',
        sensitive: false,
        isLocal: true,
        isEphemeral: true,
        expiresAt,
        apId,
      })
      .returning()

    // Update apId with real post id
    const realApId = `${env.APP_URL}/users/${ctx.actor.handle}/moments/${post!.id}`
    await db.update(posts).set({ apId: realApId }).where(eq(posts.id, post!.id))

    // Link media attachment if provided
    if (body.data.mediaId) {
      await db.update(mediaAttachments)
        .set({ postId: post!.id })
        .where(and(eq(mediaAttachments.id, body.data.mediaId), eq(mediaAttachments.actorId, ctx.actor.id)))
    }

    await scheduleMomentExpiry(post!.id, expiresAt)

    return reply.code(201).send({ ...post, apId: realApId, expiresAt })
  })

  // DELETE /api/moments/:id — delete own moment early
  app.delete<{ Params: { id: string } }>('/api/moments/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(
        eq(posts.id, req.params.id),
        eq(posts.authorId, ctx.actor.id),
        eq(posts.isEphemeral, true),
      ),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, post.id))
    return reply.code(204).send()
  })
}
