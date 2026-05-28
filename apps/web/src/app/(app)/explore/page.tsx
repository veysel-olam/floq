'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api, type Post, type Actor } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Input } from '@/components/ui/input'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Loader2, Search, Users, FileText, Globe, SlidersHorizontal, X, Image, MessageSquare, Hash, TrendingUp, UserPlus } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Tab = 'trending' | 'users' | 'posts' | 'hashtags'

interface SearchFilters {
  from: string
  since: string
  until: string
  hasMedia: boolean
  onlyReplies: boolean | null // true = only replies, false = no replies, null = any
}

const EMPTY_FILTERS: SearchFilters = {
  from: '',
  since: '',
  until: '',
  hasMedia: false,
  onlyReplies: null,
}

function hasActiveFilters(f: SearchFilters) {
  return !!(f.from || f.since || f.until || f.hasMedia || f.onlyReplies !== null)
}

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  )
}

function ExploreContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('trending')
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [searching, setSearching] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [scope, setScope] = useState<'all' | 'local' | 'federated'>('all')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('floq_recent_searches') ?? '[]') as string[] }
    catch { return [] }
  })

  // '/' keyboard shortcut → focus search input
  useEffect(() => {
    function onFocusSearch() {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    window.addEventListener('floq:focus-search', onFocusSearch)
    return () => window.removeEventListener('floq:focus-search', onFocusSearch)
  }, [])

  // Trending (public timeline)
  const [trending, setTrending] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Search results
  const [actorResults, setActorResults] = useState<Actor[]>([])
  const [postResults, setPostResults] = useState<Post[]>([])

  // Discovery data
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<Actor[]>([])

  // Hashtag results: client-side filter of trendingTags by current query
  const hashtagResults = query.trim()
    ? trendingTags.filter(({ tag }) =>
        tag.toLowerCase().includes(query.replace(/^#/, '').trim().toLowerCase()),
      )
    : []

  // Live suggestions (shown instantly while typing, before debounce)
  const liveSuggestions = query.trim().length > 0
    ? recentSearches.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 3)
    : []
  const liveHashtagSuggestions = query.trim().length > 0
    ? trendingTags.filter(({ tag }) =>
        tag.toLowerCase().includes(query.replace(/^#/, '').trim().toLowerCase()),
      ).slice(0, 4)
    : []

  useEffect(() => {
    api.search.trendingTags().then((d) => setTrendingTags(d.tags.slice(0, 10))).catch(() => {})
    api.actors.suggested().then((d) => setSuggestedUsers(d.actors.slice(0, 6))).catch(() => {})
  }, [])

  const handle = (session?.user as { handle?: string } | undefined)?.handle

  const loadTrending = useCallback(async (cursor?: string) => {
    try {
      const data = await api.timeline.explore(cursor)
      if (cursor) setTrending((prev) => [...prev, ...data.posts])
      else setTrending(data.posts)
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { void loadTrending() }, [loadTrending])

  const loadMoreTrending = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void loadTrending(nextCursor)
  }, [nextCursor, loadingMore, loadTrending])

  const loadMoreRef = useInfiniteScroll(loadMoreTrending, !!nextCursor && !loadingMore)

  const runSearch = useCallback(async (q: string, f: SearchFilters, s: typeof scope) => {
    const hasQ = q.trim().length > 0
    const hasF = hasActiveFilters(f)
    if (!hasQ && !hasF) {
      setActorResults([])
      setPostResults([])
      return
    }
    setSearching(true)
    try {
      const data = await api.search.query(q, 'all', {
        from: f.from || undefined,
        since: f.since || undefined,
        until: f.until || undefined,
        hasMedia: f.hasMedia || undefined,
        onlyReplies: f.onlyReplies ?? undefined,
        scope: s !== 'all' ? s : undefined,
      })
      setActorResults(data.actors)
      setPostResults(data.posts)
      if (tab === 'trending') setTab(hasQ ? 'users' : 'posts')
      if (hasQ) {
        setRecentSearches((prev) => {
          const updated = [q.trim(), ...prev.filter((s) => s !== q.trim())].slice(0, 8)
          localStorage.setItem('floq_recent_searches', JSON.stringify(updated))
          return updated
        })
      }
    } catch {
    } finally {
      setSearching(false)
    }
  }, [tab])

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => void runSearch(query, filters, scope), 350)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [query, filters, scope, runSearch])

  function handleDelete(id: string) {
    api.posts.delete(id).then(() => {
      setTrending((prev) => prev.filter((p) => p.id !== id))
      setPostResults((prev) => prev.filter((p) => p.id !== id))
    }).catch(() => {})
  }

  function handleEdit(updated: Post) {
    const update = (prev: Post[]) => prev.map((p) => p.id === updated.id ? { ...p, content: updated.content, editedAt: updated.editedAt } : p)
    setTrending(update)
    setPostResults(update)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setScope('all')
    setFiltersOpen(false)
  }

  const isSearchMode = query.trim().length > 0 || hasActiveFilters(filters) || scope !== 'all'

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'trending', label: 'Gündem', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'users', label: `Kişiler${actorResults.length ? ` (${actorResults.length})` : ''}`, icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'posts', label: `Gönderiler${postResults.length ? ` (${postResults.length})` : ''}`, icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'hashtags', label: `Etiketler${hashtagResults.length ? ` (${hashtagResults.length})` : ''}`, icon: <Hash className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5 space-y-2">
        {/* Search input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary)" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Kişi veya gönderi ara..."
              className="pl-9 rounded-full bg-(--color-background-secondary) border-0 focus-visible:ring-1 focus-visible:ring-(--color-coral)"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary) animate-spin" />
            )}
            {/* Suggestion dropdown: recent searches (no query) or live suggestions (while typing) */}
            {searchFocused && !query && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-xl shadow-black/10 z-20 overflow-hidden py-1">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Son Aramalar</span>
                  <button
                    onClick={() => { setRecentSearches([]); localStorage.removeItem('floq_recent_searches') }}
                    className="text-[11px] text-(--color-text-tertiary) hover:text-(--color-coral)"
                  >
                    Temizle
                  </button>
                </div>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors text-left"
                  >
                    <Search className="w-3.5 h-3.5 text-(--color-text-tertiary) flex-shrink-0" />
                    <span className="truncate">{s}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRecentSearches((prev) => {
                          const updated = prev.filter((r) => r !== s)
                          localStorage.setItem('floq_recent_searches', JSON.stringify(updated))
                          return updated
                        })
                      }}
                      className="ml-auto flex-shrink-0 p-0.5 rounded hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}
            {/* Live suggestions while typing */}
            {searchFocused && query.trim().length > 0 && (liveSuggestions.length > 0 || liveHashtagSuggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-xl shadow-black/10 z-20 overflow-hidden py-1">
                {liveSuggestions.length > 0 && (
                  <>
                    <div className="px-3 py-1.5">
                      <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Son Aramalar</span>
                    </div>
                    {liveSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors text-left"
                      >
                        <Search className="w-3.5 h-3.5 text-(--color-text-tertiary) flex-shrink-0" />
                        <span className="truncate"><Highlight text={s} query={query} /></span>
                      </button>
                    ))}
                  </>
                )}
                {liveHashtagSuggestions.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Etiketler</span>
                    </div>
                    {liveHashtagSuggestions.map(({ tag, count }) => (
                      <Link
                        key={tag}
                        href={`/hashtag/${encodeURIComponent(tag)}`}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                        onClick={() => setTimeout(() => setSearchFocused(false), 0)}
                      >
                        <Hash className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0" />
                        <span className="truncate font-medium"><Highlight text={tag} query={query.replace(/^#/, '')} /></span>
                        <span className="ml-auto text-[11px] text-(--color-text-tertiary)">{count}</span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              'flex-shrink-0 p-2 rounded-xl transition-colors',
              filtersOpen || hasActiveFilters(filters) || scope !== 'all'
                ? 'bg-(--color-coral)/15 text-(--color-coral)'
                : 'text-(--color-text-tertiary) hover:bg-(--color-background-secondary) hover:text-(--color-text-primary)',
            )}
            title="Gelişmiş filtreler"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Advanced filter panel */}
        {filtersOpen && (
          <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary)/60 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-(--color-text-tertiary) uppercase tracking-wide mb-1 block">Kişiden</label>
                <Input
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value.replace(/^@/, '') }))}
                  placeholder="@handle"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-(--color-text-tertiary) uppercase tracking-wide block">İçerik</label>
                <div className="flex gap-1.5 mt-0.5">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, hasMedia: !f.hasMedia }))}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      filters.hasMedia
                        ? 'border-(--color-coral)/50 bg-(--color-coral)/10 text-(--color-coral)'
                        : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-border-secondary)',
                    )}
                  >
                    <Image className="w-3 h-3" /> Medya
                  </button>
                  <button
                    onClick={() => setFilters((f) => ({
                      ...f,
                      onlyReplies: f.onlyReplies === true ? null : f.onlyReplies === false ? true : true,
                    }))}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      filters.onlyReplies === true
                        ? 'border-(--color-coral)/50 bg-(--color-coral)/10 text-(--color-coral)'
                        : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-border-secondary)',
                    )}
                  >
                    <MessageSquare className="w-3 h-3" /> Yanıtlar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-(--color-text-tertiary) uppercase tracking-wide mb-1 block">Başlangıç</label>
                <Input
                  type="date"
                  value={filters.since}
                  onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-(--color-text-tertiary) uppercase tracking-wide mb-1 block">Bitiş</label>
                <Input
                  type="date"
                  value={filters.until}
                  onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-(--color-text-tertiary) uppercase tracking-wide mb-1.5 block">Kaynak</label>
              <div className="flex gap-1.5">
                {(['all', 'local', 'federated'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      scope === s
                        ? 'border-(--color-coral)/50 bg-(--color-coral)/10 text-(--color-coral)'
                        : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-border-secondary)',
                    )}
                  >
                    {s === 'all' ? 'Tümü' : s === 'local' ? 'Yerel' : 'Federe'}
                  </button>
                ))}
              </div>
            </div>

            {(hasActiveFilters(filters) || scope !== 'all') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-(--color-text-tertiary) hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> Filtreleri temizle
              </button>
            )}
          </div>
        )}

        {/* Active filter chips */}
        {!filtersOpen && hasActiveFilters(filters) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.from && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral) border border-(--color-coral)/20">
                from:{filters.from}
                <button onClick={() => setFilters((f) => ({ ...f, from: '' }))}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.since && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral) border border-(--color-coral)/20">
                since:{filters.since}
                <button onClick={() => setFilters((f) => ({ ...f, since: '' }))}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.until && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral) border border-(--color-coral)/20">
                until:{filters.until}
                <button onClick={() => setFilters((f) => ({ ...f, until: '' }))}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.hasMedia && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral) border border-(--color-coral)/20">
                has:media
                <button onClick={() => setFilters((f) => ({ ...f, hasMedia: false }))}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.onlyReplies === true && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral) border border-(--color-coral)/20">
                is:reply
                <button onClick={() => setFilters((f) => ({ ...f, onlyReplies: null }))}><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
          </div>
        )}

        {isSearchMode && (
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) dark:bg-(--color-coral)/12'
                    : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
                )}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Discovery sections — only when not searching */}
      {!isSearchMode && (
        <>
          {/* Trending hashtags */}
          {trendingTags.length > 0 && (
            <section className="px-4 pt-5 pb-4 border-b border-(--color-border-secondary)">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-(--color-coral)/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-(--color-coral)" />
                </div>
                <h2 className="text-sm font-semibold text-(--color-text-primary)">Gündem</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trendingTags.map(({ tag, count }, i) => (
                  <Link
                    key={tag}
                    href={`/hashtag/${encodeURIComponent(tag)}`}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors group',
                      i === 0
                        ? 'border-(--color-coral)/30 bg-(--color-coral)/8 text-(--color-coral) hover:bg-(--color-coral)/12'
                        : 'border-(--color-border) bg-(--color-background-secondary) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                    )}
                  >
                    <Hash className="w-3 h-3 opacity-60" />
                    {tag}
                    <span className="text-[10px] opacity-60">{count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Suggested users */}
          {suggestedUsers.length > 0 && (
            <section className="px-4 pt-5 pb-4 border-b border-(--color-border-secondary)">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-(--color-coral)/10 flex items-center justify-center">
                  <UserPlus className="w-3.5 h-3.5 text-(--color-coral)" />
                </div>
                <h2 className="text-sm font-semibold text-(--color-text-primary)">Tanıyor olabilirsin</h2>
              </div>
              <div className="rounded-2xl bg-(--color-background-secondary) overflow-hidden">
                {suggestedUsers.map((actor, i) => (
                  <SuggestedUserRow
                    key={actor.id}
                    actor={actor}
                    last={i === suggestedUsers.length - 1}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Public feed header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-(--color-border-secondary)">
            <div className="w-6 h-6 rounded-lg bg-(--color-background-secondary) flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
            </div>
            <span className="text-sm font-semibold text-(--color-text-secondary)">Herkese açık</span>
          </div>

          {loading ? (
            <TimelineSkeleton count={5} />
          ) : trending.length === 0 ? (
            <EmptyState icon={Globe} title="Henüz herkese açık gönderi yok" size="sm" />
          ) : (
            <>
              {trending.map((post) => (
                <PostCard key={post.id} post={post} currentActorHandle={handle} onDelete={handleDelete} onEdit={handleEdit} />
              ))}
              {loadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
              <div ref={loadMoreRef} className="h-1" />
            </>
          )}
        </>
      )}

      {/* User results */}
      {isSearchMode && tab === 'users' && (
        <>
          {actorResults.length === 0 ? (
            <EmptyState icon={Users} title="Sonuç bulunamadı" size="sm" />
          ) : (
            actorResults.map((actor) => (
              <ActorRow key={actor.id} actor={actor} query={query} />
            ))
          )}
        </>
      )}

      {/* Post results */}
      {isSearchMode && tab === 'posts' && (
        <>
          {postResults.length === 0 ? (
            <EmptyState icon={FileText} title="Sonuç bulunamadı" size="sm" />
          ) : (
            postResults.map((post) => (
              <PostCard key={post.id} post={post} currentActorHandle={handle} onDelete={handleDelete} onEdit={handleEdit} />
            ))
          )}
        </>
      )}

      {/* Hashtag results */}
      {isSearchMode && tab === 'hashtags' && (
        <>
          {hashtagResults.length === 0 ? (
            <EmptyState icon={Hash} title="Etiket bulunamadı" size="sm" />
          ) : (
            <div className="px-4 py-3 space-y-1">
              {hashtagResults.map(({ tag, count }, i) => (
                <Link
                  key={tag}
                  href={`/hashtag/${encodeURIComponent(tag)}`}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-(--color-border-secondary) hover:border-(--color-coral)/30 hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/6 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      i === 0
                        ? 'bg-(--color-coral)/12 text-(--color-coral)'
                        : 'bg-(--color-background-secondary) text-(--color-text-tertiary) group-hover:bg-(--color-coral)/10 group-hover:text-(--color-coral)',
                    )}>
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors">
                        #<Highlight text={tag} query={query.replace(/^#/, '')} />
                      </p>
                      <p className="text-[11px] text-(--color-text-tertiary)">{count} gönderi</p>
                    </div>
                  </div>
                  {i === 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-(--color-coral) bg-(--color-coral)/10 px-2 py-0.5 rounded-full">
                      <TrendingUp className="w-2.5 h-2.5" /> Gündem
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SuggestedUserRow({ actor, last }: { actor: Actor; last: boolean }) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  const [following, setFollowing] = useState(actor.viewer?.following ?? false)
  const [pending, setPending] = useState(actor.viewer?.followStatus === 'pending')
  const [loading, setLoading] = useState(false)

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      if (following) {
        await api.actors.unfollow(actor.handle)
        setFollowing(false)
        setPending(false)
      } else {
        await api.actors.follow(actor.handle)
        if (actor.isLocked) setPending(true)
        else setFollowing(true)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const btnLabel = following ? 'Takip ediliyor' : pending ? 'Bekliyor' : 'Takip et'
  const btnActive = following || pending

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 hover:bg-(--color-background-secondary)/80 transition-colors group', !last && 'border-b border-(--color-border)/40')}>
      <Link href={`/${actor.handle}`} className="relative flex-shrink-0">
        <Avatar className="w-9 h-9">
          {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
          <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {!actor.isLocal && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-(--color-teal) flex items-center justify-center ring-2 ring-(--color-background-secondary)">
            <Globe className="w-2 h-2 text-white" />
          </span>
        )}
      </Link>

      <Link href={`/${actor.handle}`} className="flex-1 min-w-0 group">
        <p className="text-[13px] font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
          {actor.displayName ?? actor.handle}
        </p>
        <p className="text-[11px] text-(--color-text-tertiary) truncate">@{actor.handle}</p>
      </Link>

      <Button
        size="sm"
        variant={btnActive ? 'outline' : 'default'}
        onClick={handleFollow}
        disabled={loading}
        className={cn(
          'flex-shrink-0 text-xs px-3.5 rounded-full h-7 min-w-[80px]',
          btnActive
            ? 'border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
            : 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0',
        )}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : btnLabel}
      </Button>
    </div>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="bg-(--color-coral)/20 text-(--color-coral) rounded-[3px] not-italic font-semibold">{part}</mark>
          : part,
      )}
    </>
  )
}

function ActorRow({ actor, query = '' }: { actor: Actor; query?: string }) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  const [following, setFollowing] = useState(actor.viewer?.following ?? false)
  const [pending, setPending] = useState(actor.viewer?.followStatus === 'pending')
  const [loading, setLoading] = useState(false)

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      if (following) {
        await api.actors.unfollow(actor.handle)
        setFollowing(false)
        setPending(false)
      } else {
        await api.actors.follow(actor.handle)
        if (actor.isLocked) setPending(true)
        else setFollowing(true)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const btnLabel = following ? 'Takip ediliyor' : pending ? 'Bekliyor' : 'Takip et'
  const btnActive = following || pending

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/70 transition-colors group">
      <Link href={`/${actor.handle}`} className="relative flex-shrink-0">
        <Avatar className="w-11 h-11">
          {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
          <AvatarFallback
            className="text-sm font-medium text-white"
            style={{ background: 'var(--gradient-avatar)' }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        {!actor.isLocal && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-(--color-teal) flex items-center justify-center ring-2 ring-(--color-background)" title="Federe">
            <Globe className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/${actor.handle}`} className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors" style={{ fontFamily: 'var(--font-outfit)' }}>
              <Highlight text={actor.displayName ?? actor.handle} query={query} />
            </p>
            <p className="text-xs text-(--color-text-tertiary) truncate">@<Highlight text={actor.handle} query={query} /></p>
          </Link>
          <Button
            size="sm"
            variant={btnActive ? 'outline' : 'default'}
            onClick={handleFollow}
            disabled={loading}
            className={cn(
              'flex-shrink-0 text-xs px-3.5 rounded-full h-7 min-w-[80px]',
              btnActive
                ? 'border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                : 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0',
            )}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : btnLabel}
          </Button>
        </div>
        {actor.bio && (
          <p className="text-xs text-(--color-text-secondary) mt-1 line-clamp-2 leading-relaxed">{actor.bio}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-(--color-text-tertiary)">
            <span className="font-semibold text-(--color-text-secondary)">{actor.followersCount >= 1000 ? `${(actor.followersCount / 1000).toFixed(1)}K` : actor.followersCount}</span>
            {' '}takipçi
          </span>
          <span className="text-[11px] text-(--color-text-tertiary)">
            <span className="font-semibold text-(--color-text-secondary)">{actor.postsCount}</span>
            {' '}gönderi
          </span>
        </div>
      </div>
    </div>
  )
}
