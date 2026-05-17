import type { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { polls, pollOptions, pollVotes, posts, actors } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { buildQuestion, buildUpdateQuestion } from '../lib/activityPub.js'
import { deliverToFollowers } from '../lib/federation.js'

export async function pollsRoutes(app: FastifyInstance) {
  // POST /api/polls/:id/vote
  app.post<{ Params: { id: string }; Body: { optionIds: string[] } }>(
    '/api/polls/:id/vote',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const poll = await db.query.polls.findFirst({
        where: eq(polls.id, req.params.id),
        with: { options: true },
      })
      if (!poll) return reply.code(404).send({ error: 'Poll not found' })

      // Expired check
      if (new Date(poll.expiresAt) < new Date()) {
        return reply.code(422).send({ error: 'Poll has ended' })
      }

      const { optionIds } = req.body as { optionIds: string[] }
      if (!Array.isArray(optionIds) || optionIds.length === 0) {
        return reply.code(400).send({ error: 'optionIds required' })
      }
      if (!poll.multipleChoice && optionIds.length > 1) {
        return reply.code(400).send({ error: 'Single choice only' })
      }

      // Validate option IDs belong to this poll
      const validIds = new Set(poll.options.map((o) => o.id))
      if (!optionIds.every((id) => validIds.has(id))) {
        return reply.code(400).send({ error: 'Invalid option' })
      }

      // Check if already voted (for single choice, check poll-level; multiple choice, skip repeat options)
      const existingVotes = await db.query.pollVotes.findMany({
        where: and(
          eq(pollVotes.pollId, poll.id),
          eq(pollVotes.actorId, ctx.actor.id),
        ),
      })
      if (!poll.multipleChoice && existingVotes.length > 0) {
        return reply.code(409).send({ error: 'Already voted' })
      }
      const alreadyVotedOptionIds = new Set(existingVotes.map((v) => v.optionId))
      const newOptionIds = optionIds.filter((id) => !alreadyVotedOptionIds.has(id))
      if (newOptionIds.length === 0) return reply.code(409).send({ error: 'Already voted' })

      // Insert votes
      await db.insert(pollVotes).values(
        newOptionIds.map((optionId) => ({
          pollId: poll.id,
          optionId,
          actorId: ctx.actor.id,
        })),
      )

      // Increment vote counts per option
      for (const optionId of newOptionIds) {
        await db
          .update(pollOptions)
          .set({ votesCount: db.$count(pollVotes, and(eq(pollVotes.optionId, optionId))) as unknown as number })
          .where(eq(pollOptions.id, optionId))
      }

      // Recalculate voters_count from distinct actors
      const allVoters = await db
        .selectDistinct({ actorId: pollVotes.actorId })
        .from(pollVotes)
        .where(eq(pollVotes.pollId, poll.id))
      await db
        .update(polls)
        .set({ votersCount: allVoters.length })
        .where(eq(polls.id, poll.id))

      // Return updated poll
      const updated = await getPollWithCounts(poll.id, ctx.actor.id)

      // Federate Update/Question so remote followers see new vote counts
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, poll.postId), eq(posts.isLocal, true)),
        with: { author: true },
      })
      if (post && updated) {
        const author = post.author as { handle: string; id: string }
        const freshPoll = await db.query.polls.findFirst({
          where: eq(polls.id, poll.id),
          with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
        })
        if (freshPoll) {
          const question = buildQuestion(
            { ...post, apInReplyTo: post.apInReplyTo ?? null, tags: post.tags, author },
            { ...freshPoll, options: freshPoll.options.map((o) => ({ text: o.text, votesCount: o.votesCount })) },
          )
          void deliverToFollowers(author.handle, author.id, buildUpdateQuestion(question, author.handle))
        }
      }

      return reply.send(updated)
    },
  )

  // GET /api/polls/:id
  app.get<{ Params: { id: string } }>('/api/polls/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const data = await getPollWithCounts(req.params.id, ctx.actor.id)
    if (!data) return reply.code(404).send({ error: 'Not found' })
    return reply.send(data)
  })
}

export async function getPollWithCounts(pollId: string, actorId?: string) {
  const poll = await db.query.polls.findFirst({
    where: eq(polls.id, pollId),
    with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
  })
  if (!poll) return null

  // Refresh option vote counts from DB
  const freshOptions = await db.query.pollOptions.findMany({
    where: eq(pollOptions.pollId, pollId),
    orderBy: (o, { asc }) => [asc(o.position)],
  })

  let votedOptionIds: string[] = []
  if (actorId) {
    const myVotes = await db.query.pollVotes.findMany({
      where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.actorId, actorId)),
    })
    votedOptionIds = myVotes.map((v) => v.optionId)
  }

  const totalVotes = freshOptions.reduce((s, o) => s + o.votesCount, 0)
  const expired = new Date(poll.expiresAt) < new Date()
  const voted = votedOptionIds.length > 0

  return {
    id: poll.id,
    postId: poll.postId,
    multipleChoice: poll.multipleChoice,
    votersCount: poll.votersCount,
    expiresAt: poll.expiresAt.toISOString(),
    expired,
    voted,
    votedOptionIds,
    options: freshOptions.map((o) => ({
      id: o.id,
      text: o.text,
      votesCount: o.votesCount,
      percent: totalVotes > 0 ? Math.round((o.votesCount / totalVotes) * 100) : 0,
    })),
  }
}
