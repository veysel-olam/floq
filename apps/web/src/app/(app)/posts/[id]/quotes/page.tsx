'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { api, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { useSession } from '@/lib/auth-client'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function QuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''

  const [authorHandle, setAuthorHandle] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, post] = await Promise.all([
        api.posts.quotes(id),
        api.posts.get(id).catch(() => null),
      ])
      setQuotes(data.posts)
      setNextCursor(data.nextCursor)
      setAuthorHandle(post?.author?.handle ?? null)
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
      const data = await api.posts.quotes(id, nextCursor)
      setQuotes(prev => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoadingMore(false)
    }
  }

  function handleDelete(postId: string) {
    api.posts.delete(postId).then(() => {
      setQuotes(prev => prev.filter(p => p.id !== postId))
    }).catch(() => {})
  }

  function handleEdit(updated: Post) {
    setQuotes(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  return (
    <TooltipProvider>
      <div className="max-w-xl mx-auto">

        {/* Sticky header */}
        <header className="sticky top-0 z-20 bg-(--color-background)/80 backdrop-blur-xl border-b border-(--color-border-secondary) px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1
              className="font-semibold text-[15px] text-(--color-text-primary) leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Alıntılar
            </h1>
            {authorHandle && (
              <p className="text-xs text-(--color-text-tertiary) truncate">@{authorHandle} gönderisine</p>
            )}
          </div>
        </header>

        {loading ? (
          <TimelineSkeleton count={4} />
        ) : quotes.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-1.5 text-center px-6">
            <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Henüz alıntı yok
            </p>
            <p className="text-xs text-(--color-text-tertiary)">Bu gönderiyi ilk alıntılayan sen ol.</p>
          </div>
        ) : (
          <>
            {quotes.map((q) => (
              <PostCard key={q.id} post={q} currentActorHandle={handle} onDelete={handleDelete} onEdit={handleEdit} />
            ))}
            {nextCursor && (
              <div className="py-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-(--color-coral) hover:underline underline-offset-2 disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla alıntı yükle'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
