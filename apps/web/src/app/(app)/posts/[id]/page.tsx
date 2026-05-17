'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Eye } from 'lucide-react'
import { api, type Post, type ThreadContext } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { NotFoundContent } from '@/components/not-found-content'

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
    setReplies((prev) => [newPost, ...prev])
    if (ctx) setCtx({ ...ctx, post: { ...ctx.post, repliesCount: ctx.post.repliesCount + 1 } })
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
        <div>
          <h1 className="font-semibold text-[15px] text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Gönderi
          </h1>
          {post && (
            <p className="text-[11px] text-(--color-text-tertiary) leading-tight">
              @{post.author?.handle}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <TimelineSkeleton count={3} />
      ) : !ctx ? (
        <NotFoundContent />
      ) : (
        <div data-thread-view>
          {/* Ancestor thread */}
          {ctx.ancestors.map((ancestor, i) => (
            <div key={ancestor.id} className="relative">
              <PostCard post={ancestor} currentActorHandle={handle} hideActions />
              <div
                className="absolute bg-(--color-border)"
                style={{
                  left: 'calc(1rem + 1.25rem - 1px)',
                  top: 'calc(100% - 2px)',
                  width: '2px',
                  height: '20px',
                  opacity: 0.35,
                  zIndex: 1,
                }}
              />
            </div>
          ))}

          {/* Focused post */}
          <PostCard
            post={ctx.post}
            currentActorHandle={handle}
            onReply={handleNewReply}
            onDelete={handleDeleteFocused}
            detail
          />

          {/* View count — only unique info not shown in action bar */}
          {ctx.post.viewCount > 0 && (
            <div className="flex justify-end px-4 py-2 border-t border-(--color-border-secondary)">
              <span className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
                <Eye className="w-3.5 h-3.5" />
                {ctx.post.viewCount.toLocaleString('tr-TR')} görüntülenme
              </span>
            </div>
          )}

          {/* Replies */}
          {replies.length > 0 ? (
            <>
              <div className="border-t border-(--color-border-secondary)">
                {replies.map((replyPost) => (
                  <PostCard
                    key={replyPost.id}
                    post={replyPost}
                    currentActorHandle={handle}
                    onReply={handleNewReply}
                    onDelete={handleDeleteReply}
                  />
                ))}
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
            <div className="border-t border-(--color-border-secondary) py-14 flex flex-col items-center gap-1.5 text-center">
              <p className="text-sm font-medium text-(--color-text-secondary)">Henüz yanıt yok</p>
              <p className="text-xs text-(--color-text-tertiary)">İlk yanıtı sen yaz.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
