import type { FastifyInstance } from 'fastify'
import { eq, and, sql, desc, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, follows, apActivities, instances } from '../db/schema.js'
import { requireActor } from '../lib/session.js'

export async function pulseRoutes(app: FastifyInstance) {
  // GET /api/pulse — federation stats for the current user
  app.get('/api/pulse', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    // Remote actors this user follows (+ who follows them)
    const [outgoing, incoming] = await Promise.all([
      db.query.follows.findMany({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
        with: { following: true },
      }),
      db.query.follows.findMany({
        where: and(eq(follows.followingId, ctx.actor.id), eq(follows.status, 'accepted')),
        with: { follower: true },
      }),
    ])

    const remoteFollowing = outgoing
      .map((f) => f.following)
      .filter((a) => !a.isLocal)

    const remoteFollowers = incoming
      .map((f) => f.follower)
      .filter((a) => !a.isLocal)

    // Group by domain
    const domainMap = new Map<string, { domain: string; following: number; followers: number; actors: Set<string> }>()

    for (const a of remoteFollowing) {
      const domain = new URL(a.apId).hostname
      if (!domainMap.has(domain)) domainMap.set(domain, { domain, following: 0, followers: 0, actors: new Set() })
      const d = domainMap.get(domain)!
      d.following++
      d.actors.add(a.id)
    }
    for (const a of remoteFollowers) {
      const domain = new URL(a.apId).hostname
      if (!domainMap.has(domain)) domainMap.set(domain, { domain, following: 0, followers: 0, actors: new Set() })
      const d = domainMap.get(domain)!
      d.followers++
      d.actors.add(a.id)
    }

    const connections = [...domainMap.values()]
      .map(({ actors: actorSet, ...rest }) => ({ ...rest, total: actorSet.size }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // Recent outbound activities (deliveries)
    const recentActivity = await db.query.apActivities.findMany({
      where: and(
        eq(apActivities.direction, 'outbound'),
        eq(apActivities.actorApId, ctx.actor.apId),
      ),
      orderBy: [desc(apActivities.createdAt)],
      limit: 10,
    })

    // Global instance stats
    const instanceStats = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalRemoteActors: sql<number>`count(case when ${actors.isLocal} = false then 1 end)::int`,
      })
      .from(actors)

    const deliveryStats = await db
      .select({
        done: sql<number>`count(case when ${apActivities.status} = 'done' then 1 end)::int`,
        failed: sql<number>`count(case when ${apActivities.status} = 'failed' then 1 end)::int`,
        pending: sql<number>`count(case when ${apActivities.status} = 'pending' then 1 end)::int`,
      })
      .from(apActivities)
      .where(eq(apActivities.direction, 'outbound'))

    return reply.send({
      connections,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        createdAt: a.createdAt,
        targetDomain: a.objectApId ? (() => {
          try { return new URL(a.objectApId).hostname } catch { return null }
        })() : null,
      })),
      globalStats: {
        remoteActors: instanceStats[0]?.totalRemoteActors ?? 0,
        deliveries: deliveryStats[0] ?? { done: 0, failed: 0, pending: 0 },
      },
    })
  })
}
