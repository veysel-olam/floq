'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type FeedSort, type ListInfo, type FeedRule, type Actor } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { PostComposer } from '@/components/posts/post-composer'
import { MomentsBar } from '@/components/moments/moments-bar'
import { useRealtime } from '@/hooks/use-realtime'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { useKeywordFilters } from '@/hooks/use-keyword-filters'
import { applyFilters } from '@/lib/keyword-filters'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { cn } from '@/lib/utils'
import {
  ArrowUp, Loader2, Rss, SlidersHorizontal, ChevronDown,
  Check, Globe, Home, List, RefreshCw, Zap, Users, Filter,
  GitBranch, Plus, UserPlus,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedSource =
  | { type: 'for_you' }
  | { type: 'following' }
  | { type: 'federated' }
  | { type: 'list'; id: string; title: string }
  | { type: 'rule'; id: string; name: string }

const SORT_OPTIONS: { value: FeedSort; label: string; desc: string }[] = [
  { value: 'chronological', label: 'Kronolojik', desc: 'Yeniden eskiye' },
  { value: 'mixed',         label: 'Karma',      desc: 'Akıllı sıralama' },
  { value: 'engagement',    label: 'Etkileşim',  desc: 'En çok reaksiyon' },
]

// ─── Empty states ─────────────────────────────────────────────────────────────

function SuggestedUsers() {
  const [actors, setActors] = useState<Actor[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.actors.suggested().then((d) => setActors(d.actors.slice(0, 5))).catch(() => {})
  }, [])

  const follow = async (handle: string) => {
    try {
      await api.actors.follow(handle)
      setFollowed((prev) => new Set([...prev, handle]))
    } catch { /* ignore */ }
  }

  if (actors.length === 0) return null

  return (
    <div className="mt-5 rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
      <div className="px-4 py-3 border-b border-(--color-border-secondary) flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-(--color-coral)" />
        <p className="text-sm font-semibold text-(--color-text-primary)">Takip edebileceklerin</p>
      </div>
      <div className="divide-y divide-(--color-border-secondary)">
        {actors.map((actor) => (
          <div key={actor.handle} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/${actor.handle}`} className="flex-shrink-0">
              <Avatar className="w-9 h-9">
                {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs">{(actor.displayName ?? actor.handle)[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/${actor.handle}`} className="block">
                <p className="text-sm font-semibold text-(--color-text-primary) truncate hover:text-(--color-coral) transition-colors">
                  {actor.displayName ?? actor.handle}
                </p>
                <p className="text-xs text-(--color-text-tertiary) truncate">@{actor.handle}</p>
              </Link>
            </div>
            <button
              onClick={() => void follow(actor.handle)}
              disabled={followed.has(actor.handle)}
              className={cn(
                'flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors',
                followed.has(actor.handle)
                  ? 'bg-(--color-background-secondary) text-(--color-text-tertiary) cursor-default'
                  : 'bg-(--color-coral) text-white hover:bg-(--color-coral-hover)',
              )}
            >
              {followed.has(actor.handle) ? 'Takip edildi' : 'Takip et'}
            </button>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-(--color-border-secondary)">
        <Link href="/explore" className="text-sm text-(--color-coral) hover:underline font-medium">
          Daha fazlasını keşfet →
        </Link>
      </div>
    </div>
  )
}

function EmptyFeed({ source }: { source: FeedSource }) {
  if (source.type === 'for_you' || source.type === 'following') {
    const isFollowing = source.type === 'following'
    return (
      <div className="px-4 pt-6 pb-10">
        <div className="text-center mb-5">
          <p className="font-semibold text-(--color-text-primary) mb-1">
            {isFollowing ? 'Henüz kimseyi takip etmiyorsun' : 'Henüz içerik yok'}
          </p>
          <p className="text-sm text-(--color-text-tertiary)">
            {isFollowing
              ? 'Takip ettiğin hesapların gönderileri burada görünür.'
              : 'Platform büyüdükçe sana özel içerikler burada görünecek.'}
          </p>
        </div>
        <SuggestedUsers />
      </div>
    )
  }

  if (source.type === 'federated') {
    return (
      <div className="py-16 text-center px-6">
        <p className="font-semibold text-(--color-text-primary) mb-1">Federe akış boş</p>
        <p className="text-sm text-(--color-text-tertiary) leading-relaxed max-w-xs mx-auto">
          Bağlı instance&apos;lardan henüz içerik yok. Yeni hesaplar takip ettikçe federe ağ genişler.
        </p>
      </div>
    )
  }

  const isListSource = source.type === 'list'
  return (
    <div className="py-16 text-center px-6">
      <p className="font-semibold text-(--color-text-primary) mb-1">
        {isListSource ? 'Liste boş' : 'Feed boş'}
      </p>
      <p className="text-sm text-(--color-text-tertiary) leading-relaxed max-w-xs mx-auto">
        {isListSource
          ? 'Bu listedeki hesaplar henüz gönderi paylaşmamış.'
          : 'Bu feed kuralıyla eşleşen gönderi bulunamadı.'}
      </p>
    </div>
  )
}

// ─── Feed page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  // ── Timeline state ──────────────────────────────────────────
  const [posts, setPosts]             = useState<Post[]>([])
  const [nextCursor, setNextCursor]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)

  // ── Feed configuration ──────────────────────────────────────
  const [source, setSource] = useState<FeedSource>({ type: 'following' })
  const [sort, setSort]     = useState<FeedSort>('chronological')
  const [userLists, setUserLists] = useState<ListInfo[]>([])
  const [userFeeds, setUserFeeds] = useState<FeedRule[]>([])

  // ── UI state ────────────────────────────────────────────────
  const [showSortMenu, setShowSortMenu]     = useState(false)
  const [listMenuPos, setListMenuPos]       = useState<{ top: number; left: number } | null>(null)
  const [feedMenuPos, setFeedMenuPos]       = useState<{ top: number; left: number } | null>(null)
  const [isConnected, setIsConnected]       = useState(true)
  const [liveRate, setLiveRate]           = useState(0)
  const liveCountRef = useRef(0)
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── User info ───────────────────────────────────────────────
  const handle      = (session?.user as { handle?: string } | undefined)?.handle ?? ''
  const displayName = session?.user.name ?? ''
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [hideShortVideos, setHideShortVideos] = useState(false)
  const { filters } = useKeywordFilters()

  // ── Load timeline ───────────────────────────────────────────
  const loadTimeline = useCallback(async (cursor?: string) => {
    try {
      let posts: Post[]
      let nc: string | null

      if (source.type === 'list') {
        const d = await api.lists.timeline(source.id, cursor)
        posts = d.posts; nc = d.nextCursor
      } else if (source.type === 'federated') {
        const d = await api.timeline.explore(cursor)
        posts = d.posts; nc = d.nextCursor
      } else if (source.type === 'rule') {
        const d = await api.timeline.home(cursor, source.id, sort)
        posts = d.posts; nc = d.nextCursor
      } else if (source.type === 'for_you') {
        const d = await api.timeline.home(cursor, undefined, 'mixed')
        posts = d.posts; nc = d.nextCursor
      } else {
        const d = await api.timeline.home(cursor, undefined, sort)
        posts = d.posts; nc = d.nextCursor
      }

      if (cursor) {
        setPosts((prev) => [...prev, ...posts])
      } else {
        setPosts(posts)
      }
      setNextCursor(nc)
      setIsConnected(true)
    } catch (err) {
      const error = err as { status?: number }
      if (error.status === 401) { router.push('/login'); return }
      setIsConnected(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router, source, sort])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void loadTimeline(nextCursor)
  }, [nextCursor, loadingMore, loadTimeline])

  const loadMoreRef = useInfiniteScroll(loadMore, !!nextCursor && !loadingMore)

  // Auth + initial load
  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    if (handle) {
      api.actors.get(handle).then((a) => setAvatarUrl(a.avatarUrl)).catch(() => {})
    }
    api.lists.list().then((d) => setUserLists(d.lists)).catch(() => {})
    api.feedRules.list().then((d) => setUserFeeds(d.feedRules)).catch(() => {})
    api.account.getPreferences().then((p) => setHideShortVideos(p.hideShortVideos ?? false)).catch(() => {})
  }, [isPending, session, handle, router])

  // Reload on source or sort change
  useEffect(() => {
    if (!session) return
    setLoading(true)
    setPosts([])
    setNextCursor(null)
    setNewPostsCount(0)
    void loadTimeline()
  }, [source, sort, session, loadTimeline])

  // Live posts-per-minute
  useRealtime({
    new_post: useCallback(() => {
      setNewPostsCount((n) => n + 1)
      liveCountRef.current++
      if (!liveTimerRef.current) {
        liveTimerRef.current = setInterval(() => {
          setLiveRate(liveCountRef.current)
          liveCountRef.current = 0
        }, 60_000)
      }
    }, []),
  })

  useEffect(() => () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current) }, [])

  // ── Handlers ────────────────────────────────────────────────
  function refresh() {
    setNewPostsCount(0)
    setLoading(true)
    setPosts([])
    setNextCursor(null)
    void loadTimeline()
  }

  function handleNewPost(post: Post) { setPosts((p) => [post, ...p]) }
  function handleDelete(id: string) {
    api.posts.delete(id).then(() => {
      setPosts((p) => {
        const deleted = p.find((x) => x.id === id)
        const filtered = p.filter((x) => x.id !== id)
        if (deleted?.replyToId) {
          return filtered.map((x) =>
            x.id === deleted.replyToId
              ? { ...x, repliesCount: Math.max(0, x.repliesCount - 1) }
              : x,
          )
        }
        return filtered
      })
    }).catch(() => {})
  }
  function handleReply(rp: Post) {
    setPosts((p) => p.map((x) => x.id === rp.replyToId ? { ...x, repliesCount: x.repliesCount + 1 } : x))
  }
  function handleEdit(updated: Post) {
    setPosts((p) => p.map((x) => x.id === updated.id ? { ...x, content: updated.content, editedAt: updated.editedAt } : x))
  }

  // ── Derived ─────────────────────────────────────────────────
  const isForYou     = source.type === 'for_you'
  const isFollowing  = source.type === 'following'
  const isFederated  = source.type === 'federated'
  const isList       = source.type === 'list'
  const isRule       = source.type === 'rule'
  const activeFilters = filters.length
  const showListMenu = listMenuPos !== null
  const showFeedMenu = feedMenuPos !== null

  const tabLabel =
    source.type === 'for_you' ? 'Senin İçin'
    : source.type === 'following' ? 'Ana Akış'
    : source.type === 'federated' ? 'Federe Ağ'
    : source.type === 'rule' ? source.name
    : source.title

  // ── Loading skeleton ─────────────────────────────────────────
  const headerEl = (
    <header className="sticky top-0 z-20 bg-(--color-background)/95 backdrop-blur-md border-b border-(--color-border)">
      <div className="flex items-stretch h-12">

        {/* ── Source tabs ── */}
        <div className="flex items-stretch flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

          {/* For You */}
          <button
            onClick={() => { setSource({ type: 'for_you' }); setListMenuPos(null) }}
            className={cn(
              'flex items-center px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
              isForYou
                ? 'text-(--color-coral) border-(--color-coral)'
                : 'text-(--color-text-tertiary) border-transparent hover:text-(--color-text-secondary)',
            )}
          >
            Senin İçin
          </button>

          {/* Following */}
          <button
            onClick={() => { setSource({ type: 'following' }); setListMenuPos(null) }}
            className={cn(
              'flex items-center gap-2 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
              isFollowing
                ? 'text-(--color-coral) border-(--color-coral)'
                : 'text-(--color-text-tertiary) border-transparent hover:text-(--color-text-secondary)',
            )}
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
              isConnected ? 'bg-emerald-400' : 'bg-red-400',
            )} />
            Takip
          </button>

          {/* Federated */}
          <button
            onClick={() => { setSource({ type: 'federated' }); setListMenuPos(null) }}
            className={cn(
              'flex items-center px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
              isFederated
                ? 'text-(--color-coral) border-(--color-coral)'
                : 'text-(--color-text-tertiary) border-transparent hover:text-(--color-text-secondary)',
            )}
          >
            Federe
          </button>

          {/* Lists */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (listMenuPos) { setListMenuPos(null); return }
              const rect = e.currentTarget.getBoundingClientRect()
              setListMenuPos({ top: rect.bottom + 2, left: rect.left })
              setFeedMenuPos(null)
              setShowSortMenu(false)
            }}
            className={cn(
              'flex items-center gap-1.5 px-4 h-full text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
              isList
                ? 'text-(--color-coral) border-(--color-coral)'
                : 'text-(--color-text-tertiary) border-transparent hover:text-(--color-text-secondary)',
            )}
          >
            {isList ? (source as { type: 'list'; title: string }).title : 'Listeler'}
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </button>

          {/* Feeds */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (feedMenuPos) { setFeedMenuPos(null); return }
              const rect = e.currentTarget.getBoundingClientRect()
              setFeedMenuPos({ top: rect.bottom + 2, left: rect.left })
              setListMenuPos(null)
              setShowSortMenu(false)
            }}
            className={cn(
              'flex items-center gap-1.5 px-4 h-full text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
              isRule
                ? 'text-(--color-coral) border-(--color-coral)'
                : 'text-(--color-text-tertiary) border-transparent hover:text-(--color-text-secondary)',
            )}
          >
            {isRule ? (source as { type: 'rule'; name: string }).name : 'Feedler'}
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </button>

        </div>

        {/* ── Sort control ── */}
        <div className="flex items-center px-3 gap-2 flex-shrink-0">
          {liveRate > 0 && (
            <span className="text-[10px] tabular-nums text-(--color-text-tertiary)">{liveRate}/dk</span>
          )}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSortMenu((v) => !v); setListMenuPos(null); setFeedMenuPos(null) }}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                sort !== 'chronological' || showSortMenu
                  ? 'text-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
                  : 'text-(--color-text-tertiary) hover:bg-(--color-background-secondary) hover:text-(--color-text-secondary)',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {sort !== 'chronological' && (
                <span>{SORT_OPTIONS.find((s) => s.value === sort)?.label}</span>
              )}
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-lg overflow-hidden z-40">
                <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary)">
                  Sıralama
                </p>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSort(o.value); setShowSortMenu(false) }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors"
                  >
                    <div className="text-left">
                      <p className={cn('text-sm font-medium', sort === o.value ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                        {o.label}
                      </p>
                      <p className="text-[11px] text-(--color-text-tertiary)">{o.desc}</p>
                    </div>
                    {sort === o.value && <Check className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  )

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        {headerEl}
        <TimelineSkeleton count={5} />
      </div>
    )
  }

  return (
    <div
      className="max-w-xl mx-auto"
      onClick={() => { setShowSortMenu(false); setListMenuPos(null); setFeedMenuPos(null) }}
    >
      {headerEl}

      {/* ── Context bar ── */}
      {(activeFilters > 0 || isFederated || isForYou) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-(--color-border-secondary) bg-(--color-background-secondary)/40 text-xs text-(--color-text-tertiary)">
          {isForYou && (
            <span className="px-2 py-0.5 rounded-full bg-(--color-coral)/8 text-(--color-coral) border border-(--color-coral)/15">
              Akıllı sıralama
            </span>
          )}
          {isFederated && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/8 text-teal-600 dark:text-teal-400 border border-teal-500/15">
              <GitBranch className="w-3 h-3" />
              Federe
            </span>
          )}
          {activeFilters > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-(--color-background) border border-(--color-border)">
              <Filter className="w-3 h-3" />
              {activeFilters} filtre
            </span>
          )}
          {activeFilters > 0 && (
            <a href="/settings?tab=filters" className="ml-auto text-(--color-coral) hover:underline font-medium">
              Düzenle
            </a>
          )}
        </div>
      )}

      {/* ── Composer + moments (following only) ── */}
      {isFollowing && (
        <>
          {!hideShortVideos && <MomentsBar />}
          <PostComposer
            handle={handle}
            displayName={displayName}
            avatarUrl={avatarUrl}
            onPost={handleNewPost}
          />
        </>
      )}

      {/* ── New posts banner ── */}
      {newPostsCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); refresh() }}
          className="mx-4 mt-2 mb-1 w-[calc(100%-2rem)] flex items-center justify-center gap-2 py-2 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors animate-in slide-in-from-top-2"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          {newPostsCount === 1 ? '1 yeni gönderi' : `${newPostsCount} yeni gönderi`}
        </button>
      )}

      {/* ── Posts ── */}
      {posts.length === 0 ? (
        <EmptyFeed source={source} />
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentActorHandle={handle}
              onDelete={handleDelete}
              onReply={handleReply}
              onEdit={handleEdit}
              filterResult={applyFilters(post, filters, 'home')}
            />
          ))}

          {loadingMore && (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          )}

          <div ref={loadMoreRef} className="h-1" />

          {/* End of feed */}
          {!nextCursor && !loadingMore && (
            <div className="py-12 flex flex-col items-center gap-2.5 text-(--color-text-tertiary)">
              <Rss className="w-4 h-4 opacity-30" />
              <p className="text-xs">Akışın sonuna ulaştın</p>
              <button
                onClick={refresh}
                className="mt-0.5 flex items-center gap-1.5 text-xs text-(--color-coral) hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Yenile
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Fixed dropdowns (escape overflow-x-auto clipping) ── */}
      {showListMenu && listMenuPos && (
        <div
          className="fixed w-52 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-xl overflow-hidden z-50"
          style={{ top: listMenuPos.top, left: listMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary)">
            Listelerim
          </p>
          {userLists.length === 0 ? (
            <div className="px-3 py-3 text-sm text-(--color-text-tertiary)">
              Henüz liste yok.{' '}
              <a href="/lists" className="text-(--color-coral) hover:underline">Oluştur</a>
            </div>
          ) : userLists.map((l) => (
            <button
              key={l.id}
              onClick={() => { setSource({ type: 'list', id: l.id, title: l.title }); setListMenuPos(null) }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors"
            >
              <span className={cn('text-sm font-medium truncate', isList && (source as { id: string }).id === l.id ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                {l.title}
              </span>
              {isList && (source as { id: string }).id === l.id && <Check className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}

      {showFeedMenu && feedMenuPos && (
        <div
          className="fixed w-56 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-xl overflow-hidden z-50"
          style={{ top: feedMenuPos.top, left: feedMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary)">
            Özel Feedlerim
          </p>
          {userFeeds.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-sm text-(--color-text-tertiary) mb-2">Henüz özel feed yok.</p>
              <a href="/settings?tab=feed" className="flex items-center gap-1.5 text-sm text-(--color-coral) hover:underline" onClick={() => setFeedMenuPos(null)}>
                <Plus className="w-3.5 h-3.5" />Yeni feed oluştur
              </a>
            </div>
          ) : (
            <>
              {userFeeds.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setSource({ type: 'rule', id: f.id, name: f.name }); setFeedMenuPos(null) }}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors"
                >
                  <div className="text-left min-w-0">
                    <p className={cn('text-sm font-medium truncate', isRule && (source as { id: string }).id === f.id ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                      {f.name}
                    </p>
                    {f.isDefault && <p className="text-[10px] text-(--color-text-tertiary)">Varsayılan</p>}
                  </div>
                  {isRule && (source as { id: string }).id === f.id && <Check className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0 ml-2" />}
                </button>
              ))}
              <div className="border-t border-(--color-border) px-3 py-2">
                <a href="/settings?tab=feed" className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors" onClick={() => setFeedMenuPos(null)}>
                  <Plus className="w-3 h-3" />Yeni feed ekle
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
