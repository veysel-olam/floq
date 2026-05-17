import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { posts, actors, likes, boosts, bookmarks, mediaAttachments, polls, pollOptions, pollVotes, reactions } from '../db/schema.js'

export async function enrichPosts(postList: typeof posts.$inferSelect[], actorId?: string) {
  if (postList.length === 0) return []

  const postIds = postList.map((p) => p.id)

  const authorIds = [...new Set(postList.map((p) => p.authorId))]
  const authorList = await db.query.actors.findMany({
    where: inArray(actors.id, authorIds),
  })
  const authorMap = new Map(authorList.map((a) => [a.id, a]))

  // Resolve parent author for reply posts
  const replyToIds = [...new Set(postList.map((p) => p.replyToId).filter(Boolean) as string[])]
  const replyAuthorMap = new Map<string, { handle: string; displayName: string | null }>()
  if (replyToIds.length > 0) {
    const parentPosts = await db
      .select({ id: posts.id, authorId: posts.authorId })
      .from(posts)
      .where(inArray(posts.id, replyToIds))
    const parentAuthorIds = [...new Set(parentPosts.map((p) => p.authorId))]
    const parentAuthors = await db.query.actors.findMany({
      where: inArray(actors.id, parentAuthorIds),
      columns: { id: true, handle: true, displayName: true },
    })
    const parentAuthorById = new Map(parentAuthors.map((a) => [a.id, a]))
    for (const p of parentPosts) {
      const author = parentAuthorById.get(p.authorId)
      if (author) replyAuthorMap.set(p.id, { handle: author.handle, displayName: author.displayName })
    }
  }

  // Resolve quoted posts with their authors and media
  const quotedPostIds = [...new Set(postList.map((p) => p.quotedPostId).filter(Boolean) as string[])]
  const quotedPostMap = new Map<string, {
    id: string; content: string; createdAt: Date; authorId: string
    author: { id: string; handle: string; displayName: string | null; avatarUrl: string | null } | null
    media: typeof mediaAttachments.$inferSelect[]
  }>()
  if (quotedPostIds.length > 0) {
    const quotedRows = await db.query.posts.findMany({
      where: and(inArray(posts.id, quotedPostIds), eq(posts.isDeleted, false)),
      columns: { id: true, content: true, createdAt: true, authorId: true },
    })
    const quotedAuthorIds = [...new Set(quotedRows.map((p) => p.authorId))]
    const quotedAuthors = await db.query.actors.findMany({
      where: inArray(actors.id, quotedAuthorIds),
      columns: { id: true, handle: true, displayName: true, avatarUrl: true },
    })
    const quotedAuthorById = new Map(quotedAuthors.map((a) => [a.id, a]))
    const quotedMedia = await db.query.mediaAttachments.findMany({
      where: inArray(mediaAttachments.postId, quotedPostIds),
    })
    const quotedMediaMap = new Map<string, typeof mediaAttachments.$inferSelect[]>()
    for (const m of quotedMedia) {
      if (!m.postId) continue
      if (!quotedMediaMap.has(m.postId)) quotedMediaMap.set(m.postId, [])
      quotedMediaMap.get(m.postId)!.push(m)
    }
    for (const qp of quotedRows) {
      quotedPostMap.set(qp.id, {
        ...qp,
        author: quotedAuthorById.get(qp.authorId) ?? null,
        media: quotedMediaMap.get(qp.id) ?? [],
      })
    }
  }

  const mediaRows = await db.query.mediaAttachments.findMany({
    where: inArray(mediaAttachments.postId, postIds),
  })
  const mediaMap = new Map<string, typeof mediaRows>()
  for (const m of mediaRows) {
    if (!m.postId) continue
    if (!mediaMap.has(m.postId)) mediaMap.set(m.postId, [])
    mediaMap.get(m.postId)!.push(m)
  }

  // Resolve polls for posts that have them
  const pollRows = await db.query.polls.findMany({
    where: inArray(polls.postId, postIds),
  })
  type PollData = {
    id: string
    postId: string
    multipleChoice: boolean
    votersCount: number
    expiresAt: string
    expired: boolean
    voted: boolean
    votedOptionIds: string[]
    options: { id: string; text: string; votesCount: number; percent: number }[]
  }
  const pollMap = new Map<string, PollData>()
  if (pollRows.length > 0) {
    const pollIds = pollRows.map((p) => p.id)
    const [optionRows, voteRows] = await Promise.all([
      db.query.pollOptions.findMany({
        where: inArray(pollOptions.pollId, pollIds),
        orderBy: (o, { asc }) => [asc(o.position)],
      }),
      actorId
        ? db.query.pollVotes.findMany({
            where: and(inArray(pollVotes.pollId, pollIds), eq(pollVotes.actorId, actorId)),
          })
        : Promise.resolve([]),
    ])
    const optionsByPoll = new Map<string, typeof optionRows>()
    for (const o of optionRows) {
      if (!optionsByPoll.has(o.pollId)) optionsByPoll.set(o.pollId, [])
      optionsByPoll.get(o.pollId)!.push(o)
    }
    const votedByPoll = new Map<string, Set<string>>()
    for (const v of voteRows) {
      if (!votedByPoll.has(v.pollId)) votedByPoll.set(v.pollId, new Set())
      votedByPoll.get(v.pollId)!.add(v.optionId)
    }
    for (const poll of pollRows) {
      const options = optionsByPoll.get(poll.id) ?? []
      const totalVotes = options.reduce((s, o) => s + o.votesCount, 0)
      const votedOptionIds = [...(votedByPoll.get(poll.id) ?? [])]
      pollMap.set(poll.postId, {
        id: poll.id,
        postId: poll.postId,
        multipleChoice: poll.multipleChoice,
        votersCount: poll.votersCount,
        expiresAt: poll.expiresAt.toISOString(),
        expired: new Date(poll.expiresAt) < new Date(),
        voted: votedOptionIds.length > 0,
        votedOptionIds,
        options: options.map((o) => ({
          id: o.id,
          text: o.text,
          votesCount: o.votesCount,
          percent: totalVotes > 0 ? Math.round((o.votesCount / totalVotes) * 100) : 0,
        })),
      })
    }
  }

  // Aggregate reaction counts per post
  const reactionRows = await db.query.reactions.findMany({
    where: inArray(reactions.postId, postIds),
    columns: { postId: true, emoji: true, actorId: true },
  })
  // reactionSummary: postId → { emoji: count }
  const reactionSummaryMap = new Map<string, Record<string, number>>()
  // viewerReactionsMap: postId → Set<emoji>
  const viewerReactionsMap = new Map<string, Set<string>>()
  for (const r of reactionRows) {
    if (!reactionSummaryMap.has(r.postId)) reactionSummaryMap.set(r.postId, {})
    const summary = reactionSummaryMap.get(r.postId)!
    summary[r.emoji] = (summary[r.emoji] ?? 0) + 1
    if (actorId && r.actorId === actorId) {
      if (!viewerReactionsMap.has(r.postId)) viewerReactionsMap.set(r.postId, new Set())
      viewerReactionsMap.get(r.postId)!.add(r.emoji)
    }
  }

  let likedIds = new Set<string>()
  let boostedIds = new Set<string>()
  let bookmarkedIds = new Set<string>()

  if (actorId) {
    const [likeRows, boostRows, bookmarkRows] = await Promise.all([
      db.query.likes.findMany({ where: and(eq(likes.actorId, actorId), inArray(likes.postId, postIds)) }),
      db.query.boosts.findMany({ where: and(eq(boosts.actorId, actorId), inArray(boosts.postId, postIds)) }),
      db.query.bookmarks.findMany({ where: and(eq(bookmarks.actorId, actorId), inArray(bookmarks.postId, postIds)) }),
    ])
    likedIds = new Set(likeRows.map((l) => l.postId))
    boostedIds = new Set(boostRows.map((b) => b.postId))
    bookmarkedIds = new Set(bookmarkRows.map((b) => b.postId))
  }

  return postList.map((post) => ({
    ...post,
    author: authorMap.get(post.authorId) ?? null,
    media: mediaMap.get(post.id) ?? [],
    replyToAuthor: post.replyToId ? (replyAuthorMap.get(post.replyToId) ?? null) : null,
    quotedPost: post.quotedPostId ? (quotedPostMap.get(post.quotedPostId) ?? null) : null,
    poll: pollMap.get(post.id) ?? null,
    reactions: reactionSummaryMap.get(post.id) ?? {},
    viewer: {
      liked: likedIds.has(post.id),
      boosted: boostedIds.has(post.id),
      bookmarked: bookmarkedIds.has(post.id),
      reactions: [...(viewerReactionsMap.get(post.id) ?? [])],
    },
  }))
}
