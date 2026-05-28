'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Eye, BookOpen } from 'lucide-react'
import { api, type Post, type ThreadContext } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { NotFoundContent } from '@/components/not-found-content'
import { cn } from '@/lib/utils'

// ── Reply tree ────────────────────────────────────────────────────────────────
type ReplyNode = { post: Post; children: ReplyNode[] }

function buildReplyTree(replies: Post[], parentId: string): ReplyNode[] {
  return replies
    .filter((r) => r.replyToId === parentId)
    .map((r) => ({ post: r, children: buildReplyTree(replies, r.id) }))
}

function ReplyTree({
  nodes,
  depth,
  handle,
  readingMode,
  onReply,
  onDelete,
}: {
  nodes: ReplyNode[]
  depth: number
  handle: string | undefined
  readingMode: boolean
  onReply: (p: Post) => void
  onDelete: (id: string) => void
}) {
  if (nodes.length === 0) return null
  return (
    <>
      {nodes.map((node) => (
        <div key={node.post.id}>
          {depth > 0 ? (
            <div className="flex">
              <div className="w-10 flex-shrink-0 flex justify-center pt-3 pl-4">
                <div className="w-px bg-(--color-border) h-full min-h-[24px]" />
              </div>
              <div className="flex-1 min-w-0 border-t border-(--color-border-secondary)">
                <PostCard
                  post={node.post}
                  currentActorHandle={handle}
                  onReply={readingMode ? undefined : onReply}
                  onDelete={readingMode ? undefined : onDelete}
                  hideActions={readingMode}
                />
              </div>
            </div>
          ) : (
            <PostCard
              post={node.post}
              currentActorHandle={handle}
              onReply={readingMode ? undefined : onReply}
              onDelete={readingMode ? undefined : onDelete}
              hideActions={readingMode}
            />
          )}
          {node.children.length > 0 && (
            <ReplyTree
              nodes={node.children}
              depth={depth + 1}
              handle={handle}
              readingMode={readingMode}
              onReply={onReply}
              onDelete={onDelete}
            />
          )}
        </div>
      ))}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle

  const [ctx, setCtx] = useState<ThreadContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replies, setReplies] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [readingMode, setReadingMode] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.posts.context(id)
      setCtx(data)
      setReplies(data.replies)
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const data = await api.posts.context(id, nextCursor)
      setReplies((prev) => [...prev, ...data.replies])
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoadingMore(false)
    }
  }

  function handleNewReply(newPost: Post) {
    setReplies((prev) => {
      if (newPost.replyToId === id) return [newPost, ...prev]
      return prev.map((r) =>
        r.id === newPost.replyToId ? { ...r, repliesCount: r.repliesCount + 1 } : r,
      )
    })
    if (ctx && newPost.replyToId === id) {
      setCtx({ ...ctx, post: { ...ctx.post, repliesCount: ctx.post.repliesCount + 1 } })
    }
  }

  function handleDeleteReply(postId: string) {
    api.posts.delete(postId).then(() => {
      setReplies((prev) => prev.filter((p) => p.id !== postId))
      if (ctx) setCtx({ ...ctx, post: { ...ctx.post, repliesCount: Math.max(0, ctx.post.repliesCount - 1) } })
    }).catch(() => {})
  }

  function handleDeleteFocused(postId: string) {
    api.posts.delete(postId).then(() => router.back()).catch(() => {})
  }

  const post = ctx?.post
  const replyTree = buildReplyTree(replies, id)

  return (
    <div className="max-w-xl mx-auto">

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-(--color-background)/80 backdrop-blur-xl border-b border-(--color-border-secondary) px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[15px] text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Gönderi
          </h1>
          {post && (
            <p className="text-[11px] text-(--color-text-tertiary) leading-tight">
              @{post.author?.handle}
            </p>
          )}
        </div>
        <button
          onClick={() => setReadingMode((v) => !v)}
          title={readingMode ? 'Normal görünüm' : 'Okuma modu'}
          className={cn(
            'p-2 rounded-full transition-colors',
            readingMode
              ? 'text-(--color-coral) bg-(--color-coral)/10'
              : 'text-(--color-text-tertiary) hover:bg-(--color-background-secondary)',
          )}
        >
          <BookOpen className="w-4 h-4" />
        </button>
      </header>

      {loading ? (
        <TimelineSkeleton count={3} />
      ) : !ctx ? (
        <NotFoundContent />
      ) : (
        <div data-thread-view className={cn(readingMode && 'reading-mode')}>

          {/* Ancestor thread — each with a connector line below */}
          {ctx.ancestors.map((ancestor) => (
            <div key={ancestor.id} className="relative">
              <PostCard post={ancestor} currentActorHandle={handle} hideActions />
              {/* connector line: starts under avatar center, spans to next card */}
              <div
                className="absolute bg-(--color-border-secondary) pointer-events-none"
                style={{ left: 'calc(1rem + 18px)', top: 'calc(100% - 8px)', width: '2px', height: '24px', zIndex: 1 }}
              />
            </div>
          ))}

          {/* Focused post */}
          {ctx.ancestors.length > 0 && (
            <div
              className="absolute bg-(--color-border-secondary) pointer-events-none"
              style={{ left: 'calc(1rem + 18px)', top: 0, width: '2px', height: '20px', zIndex: 1, position: 'relative' }}
            />
          )}
          <PostCard
            post={ctx.post}
            currentActorHandle={handle}
            onReply={readingMode ? undefined : handleNewReply}
            onDelete={readingMode ? undefined : handleDeleteFocused}
            hideActions={readingMode}
            detail
          />

          {/* View count */}
          {ctx.post.viewCount > 0 && !readingMode && (
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-(--color-border-secondary) text-xs text-(--color-text-tertiary)">
              <Eye className="w-3.5 h-3.5" />
              {ctx.post.viewCount.toLocaleString('tr-TR')} görüntülenme
            </div>
          )}

          {/* Replies — tree structure */}
          {replyTree.length > 0 ? (
            <>
              <div className="border-t border-(--color-border-secondary)">
                <ReplyTree
                  nodes={replyTree}
                  depth={0}
                  handle={handle}
                  readingMode={readingMode}
                  onReply={handleNewReply}
                  onDelete={handleDeleteReply}
                />
              </div>

              {nextCursor && (
                <div className="py-6 flex justify-center border-t border-(--color-border-secondary)">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingMore}
                    onClick={loadMore}
                    className="text-(--color-text-tertiary) text-xs"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla yanıt'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="border-t border-(--color-border-secondary) py-16 flex flex-col items-center gap-1 text-center px-6">
              <p className="text-sm font-semibold text-(--color-text-primary)">Henüz yanıt yok</p>
              <p className="text-xs text-(--color-text-tertiary) mt-0.5">İlk yanıtı sen yaz.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
