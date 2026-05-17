import { BskyAgent } from '@atproto/api'
import { db } from '../db/client.js'
import { blueskyConnections } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export async function getBskyAgent(userId: string): Promise<BskyAgent | null> {
  const conn = await db.query.blueskyConnections.findFirst({
    where: eq(blueskyConnections.userId, userId),
  })
  if (!conn) return null

  const agent = new BskyAgent({ service: 'https://bsky.social' })

  try {
    await agent.resumeSession({
      did: conn.did,
      handle: conn.handle,
      accessJwt: conn.accessJwt,
      refreshJwt: conn.refreshJwt,
      active: true,
    })
    if (agent.session && agent.session.accessJwt !== conn.accessJwt) {
      await db.update(blueskyConnections)
        .set({
          accessJwt: agent.session.accessJwt,
          refreshJwt: agent.session.refreshJwt,
          updatedAt: new Date(),
        })
        .where(eq(blueskyConnections.userId, userId))
    }
  } catch {
    return null
  }

  return agent
}

// Post a floq post to Bluesky as an app.bsky.feed.post record
export async function crosspostToBluesky(
  userId: string,
  text: string,
  tags: string[],
): Promise<void> {
  const conn = await db.query.blueskyConnections.findFirst({
    where: eq(blueskyConnections.userId, userId),
  })
  if (!conn?.crosspostEnabled) return

  const agent = await getBskyAgent(userId)
  if (!agent) return

  // Strip HTML tags from content for Bluesky plain text
  const plainText = text.replace(/<[^>]+>/g, '').slice(0, 300)

  // Build facets for hashtags
  const facets: Array<{
    index: { byteStart: number; byteEnd: number }
    features: Array<{ $type: string; tag: string }>
  }> = []

  let searchFrom = 0
  for (const tag of tags.filter((t) => t.startsWith('#'))) {
    const idx = plainText.indexOf(tag, searchFrom)
    if (idx === -1) continue
    const encoder = new TextEncoder()
    const byteStart = encoder.encode(plainText.slice(0, idx)).length
    const byteEnd = byteStart + encoder.encode(tag).length
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: tag.slice(1) }],
    })
    searchFrom = idx + tag.length
  }

  await agent.post({
    text: plainText,
    ...(facets.length ? { facets } : {}),
    createdAt: new Date().toISOString(),
    langs: ['tr'],
  })
}
