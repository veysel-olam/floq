'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react'
import { api, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { useSession } from '@/lib/auth-client'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { TimelineSkeleton } from '@/components/ui/skeleton'

export default function LocationPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params)
  const name = decodeURIComponent(rawName)
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle

  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await api.location.posts(name, cursor)
      if (cursor) setPosts((prev) => [...prev, ...data.posts])
      else setPosts(data.posts)
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [name])

  useEffect(() => {
    setLoading(true)
    setPosts([])
    void load()
  }, [load])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void load(nextCursor)
  }, [nextCursor, loadingMore, load])

  const loadMoreRef = useInfiniteScroll(loadMore, !!nextCursor && !loadingMore)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border-secondary) px-4 py-3 flex items-center gap-3">
        <Link
          href="/explore"
          className="w-8 h-8 rounded-full flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-(--color-blush) dark:bg-(--color-coral)/15 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
              {name}
            </h1>
            {!loading && (
              <p className="text-xs text-(--color-text-tertiary)">
                {posts.length > 0 ? `${posts.length}${nextCursor ? '+' : ''} gönderi` : 'Gönderi yok'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div>
        {loading ? (
          <TimelineSkeleton />
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-(--color-blush) dark:bg-(--color-coral)/10 flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6 text-(--color-coral)" />
            </div>
            <p className="text-sm font-semibold text-(--color-text-primary) mb-1">{name} için gönderi yok</p>
            <p className="text-xs text-(--color-text-tertiary)">Bu konumdan ilk gönderiyi paylaşan sen ol.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentActorHandle={handle}
              />
            ))}
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
