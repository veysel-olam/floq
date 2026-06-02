import { and, eq, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { blocks } from '../db/schema.js'

// True if either actor has blocked the other (blocks are bidirectional in effect:
// once A blocks B, neither sees the other's content nor can DM).
export async function areBlocked(actorA: string, actorB: string): Promise<boolean> {
  const row = await db.query.blocks.findFirst({
    where: or(
      and(eq(blocks.blockerId, actorA), eq(blocks.blockedId, actorB)),
      and(eq(blocks.blockerId, actorB), eq(blocks.blockedId, actorA)),
    ),
    columns: { id: true },
  })
  return !!row
}
