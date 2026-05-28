'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Hash, Loader2, Bell, BellOff } from 'lucide-react'
import { api, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { useSession } from '@/lib/auth-client'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = use(params)
  const tag = decodeURIComponent(rawTag)
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle

  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [postsCount, setPostsCount] = useState<number | null>(null)
  const [followersCount, setFollowersCount] = useState<number | null>(null)
  const [infoLoaded, setInfoLoaded] = useState(false)

  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await api.timeline.hashtag(tag, cursor)
      if (cursor) setPosts((prev) => [...prev, ...data.posts])
      else setPosts(data.posts)
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [tag])

  useEffect(() => {
    setLoading(true)
    setPosts([])
    void load()
  }, [load])

  useEffect(() => {
    if (!session) return
    api.hashtags.info(tag)
      .then((d) => {
        setFollowing(d.following)
        setPostsCount(d.postsCount)
        setFollowersCount(d.followersCount)
        setInfoLoaded(true)
      })
      .catch(() => { setInfoLoaded(true) })
  }, [tag, session])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void load(nextCursor)
  }, [nextCursor, loadingMore, load])

  const loadMoreRef = useInfiniteScroll(loadMore, !!nextCursor && !loadingMore)

  const toggleFollow = useCallback(async () => {
    if (followLoading) return
    setFollowLoading(true)
    const prev = following
    setFollowing(!prev)
    setFollowersCount((c) => c !== null ? (prev ? c - 1 : c + 1) : c)
    try {
      if (prev) await api.hashtags.unfollow(tag)
      else await api.hashtags.follow(tag)
    } catch {
      setFollowing(prev)
      setFollowersCount((c) => c !== null ? (prev ? c + 1 : c - 1) : c)
    } finally {
      setFollowLoading(false)
    }
  }, [tag, following, followLoading])

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-(--color-coral) shrink-0" />
              <h1 className="font-semibold text-base text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                {tag}
              </h1>
            </div>
            {infoLoaded && (postsCount !== null || followersCount !== null) && (
              <p className="text-xs text-(--color-text-tertiary) mt-0.5">
                {postsCount !== null && <span>{postsCount.toLocaleString('tr-TR')} gönderi</span>}
                {postsCount !== null && followersCount !== null && <span className="mx-1">·</span>}
                {followersCount !== null && <span>{followersCount.toLocaleString('tr-TR')} takipçi</span>}
              </p>
            )}
          </div>
          {session && infoLoaded && (
            <button
              onClick={() => void toggleFollow()}
              disabled={followLoading}
              aria-label={following ? 'Hashtag takibini bırak' : 'Hashtag takip et'}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95',
                following
                  ? 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:bg-red-500/10 hover:text-red-500 border border-(--color-border)'
                  : 'bg-(--color-coral) text-white hover:opacity-90',
                followLoading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {followLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : following
                  ? <><BellOff className="w-3.5 h-3.5" />Takip ediliyor</>
                  : <><Bell className="w-3.5 h-3.5" />Takip et</>
              }
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <TimelineSkeleton count={5} />
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <Hash className="w-10 h-10 mx-auto mb-3 text-(--color-text-tertiary)/40" />
          <p className="text-(--color-text-tertiary) text-sm">#{tag} etiketiyle gönderi bulunamadı.</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentActorHandle={handle} />
          ))}
          {loadingMore && (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          )}
          <div ref={loadMoreRef} className="h-1" />
        </>
      )}
    </div>
  )
}
