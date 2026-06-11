'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search, Hash, Loader2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── ActivityPub hexagon icon ─────────────────────────── */
function ApIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden>
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L20 8v8l-8 4-8-4V8l8-3.82z" opacity={0.4} />
      <path d="M7.5 9.5h9M7.5 12h9M7.5 14.5h5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </svg>
  )
}

/* ── Small uppercase section label (borderless, airy) ── */
function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-(--color-text-tertiary)">
        {children}
      </h2>
      {right}
    </div>
  )
}

/* ── Federation health (flat, no card) ────────────────── */
function FederationSection() {
  const [stats, setStats] = useState<{ instances: number; actors: number; inbound: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.instance.federation()
      .then((d) => setStats({ instances: d.activeInstances, actors: d.remoteActors, inbound: d.inbound24h }))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString())

  return (
    <section>
      <SectionLabel
        right={
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Canlı
          </span>
        }
      >
        Federe Ağ
      </SectionLabel>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
        </div>
      ) : stats ? (
        <div className="flex items-start justify-between px-1">
          <Stat value={fmt(stats.instances)} label="sunucu" />
          <Stat value={fmt(stats.actors)} label="kullanıcı" />
          <Stat value={fmt(stats.inbound)} label="mesaj/gün" />
        </div>
      ) : (
        <p className="px-1 text-xs text-(--color-text-secondary) leading-relaxed flex items-start gap-2">
          <Globe className="w-3.5 h-3.5 text-(--color-teal) flex-shrink-0 mt-0.5" />
          ActivityPub ile binlerce federe sunucuya bağlısın.
        </p>
      )}
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span className="text-xl font-bold text-(--color-text-primary) tabular-nums leading-none" style={{ fontFamily: 'var(--font-outfit)' }}>
        {value}
      </span>
      <span className="text-[10px] text-(--color-text-tertiary) leading-none">{label}</span>
    </div>
  )
}

/* ── Trending (flat list) ─────────────────────────────── */
function TrendingSection() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.search.trendingTags().then((d) => setTags(d.tags.slice(0, 7))).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (tags.length === 0) return null

  return (
    <section>
      <SectionLabel>Gündem</SectionLabel>
      <div className="flex flex-col">
        {tags.map(({ tag, count }, i) => (
          <Link
            key={tag}
            href={`/hashtag/${encodeURIComponent(tag)}`}
            className="group flex items-center gap-2.5 px-1 -mx-1 py-1.5 rounded-lg hover:bg-(--color-background-secondary) transition-colors"
          >
            <span className="w-4 text-[11px] font-semibold text-(--color-text-tertiary) tabular-nums text-right flex-shrink-0">
              {i + 1}
            </span>
            <Hash className="w-3 h-3 text-(--color-text-tertiary) flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors">
              {tag}
            </span>
            <span className="text-[11px] text-(--color-text-tertiary) tabular-nums flex-shrink-0">
              {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ── Suggested (flat list) ────────────────────────────── */
function SuggestedSection() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.actors.suggested().then((d) => setActors(d.actors.slice(0, 3))).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const follow = useCallback(async (handle: string) => {
    setFollowing((prev) => new Set([...prev, handle]))
    try {
      await api.actors.follow(handle)
    } catch {
      setFollowing((prev) => { const s = new Set(prev); s.delete(handle); return s })
    }
  }, [])

  if (loading) return null
  if (actors.length === 0) return null

  return (
    <section>
      <SectionLabel>Seni Tanıyabilirler</SectionLabel>
      <div className="flex flex-col gap-1">
        {actors.map((actor) => {
          const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
          const isFollowing = following.has(actor.handle)
          return (
            <div key={actor.id} className="flex items-center gap-2.5 px-1 -mx-1 py-1.5 rounded-lg hover:bg-(--color-background-secondary) transition-colors">
              <Link href={`/${actor.handle}`} className="flex-shrink-0">
                <div className="relative">
                  <Avatar className="w-9 h-9">
                    {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
                    <AvatarFallback className="text-xs font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!actor.isLocal && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-(--color-background) flex items-center justify-center"
                      title="Federe kullanıcı"
                    >
                      <Globe className="w-2.5 h-2.5 text-(--color-teal)" />
                    </span>
                  )}
                </div>
              </Link>
              <Link href={`/${actor.handle}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--color-text-primary) truncate hover:underline" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {actor.displayName ?? actor.handle}
                </p>
                <p className="text-xs text-(--color-text-tertiary) truncate">@{actor.handle}</p>
              </Link>
              <button
                onClick={() => void follow(actor.handle)}
                disabled={isFollowing}
                className={cn(
                  'flex-shrink-0 text-xs font-semibold px-3 h-7 rounded-full transition-colors',
                  isFollowing
                    ? 'text-(--color-text-tertiary) border border-(--color-border)'
                    : 'text-(--color-coral) border border-(--color-coral)/40 hover:bg-(--color-coral)/8',
                )}
              >
                {isFollowing ? 'Takip' : 'Takip et'}
              </button>
            </div>
          )
        })}
      </div>
      <Link href="/explore" className="inline-block px-1 mt-2 text-xs font-medium text-(--color-coral) hover:underline">
        Daha fazla gör →
      </Link>
    </section>
  )
}

/* ── Footer ───────────────────────────────────────────── */
function FooterBadge() {
  return (
    <div className="px-1 flex items-center gap-2">
      <ApIcon className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
      <p className="text-[11px] text-(--color-text-tertiary) leading-relaxed">
        <span className="font-semibold text-(--color-text-secondary)">floq</span>
        {' · '}ActivityPub{' · '}
        <Link href="/privacy" className="hover:underline">Gizlilik</Link>
        {' · '}
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:underline">Açık Kaynak</a>
      </p>
    </div>
  )
}

/* ── Main export ──────────────────────────────────────── */
export function RightPanel() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/explore?q=${encodeURIComponent(q)}`)
  }

  return (
    <aside className="hidden xl:flex flex-col w-72 flex-shrink-0 sticky top-0 self-start h-screen overflow-y-auto pt-4 pr-4 pb-6 gap-7 scrollbar-none">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary) pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="floq'ta ara…"
          className="pl-9 rounded-full bg-(--color-background-secondary) border-0 focus-visible:ring-1 focus-visible:ring-(--color-coral)"
        />
      </form>

      <FederationSection />

      {/* hairline divider */}
      <div className="h-px bg-(--color-border) mx-1" />

      <TrendingSection />

      <div className="h-px bg-(--color-border) mx-1" />

      <SuggestedSection />

      <FooterBadge />
    </aside>
  )
}
