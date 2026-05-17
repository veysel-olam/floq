'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Hash, TrendingUp, Loader2, Globe, Wifi, Server, Users } from 'lucide-react'
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

/* ── Federation health widget ─────────────────────────── */
function FederationWidget() {
  const [stats, setStats] = useState<{ instances: number; actors: number; inbound: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.federation()
      .then((d) => setStats({
        instances: d.summary.activeInstances,
        actors: d.summary.remoteActors,
        inbound: d.summary.inbound24h,
      }))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="rounded-2xl border border-(--color-border) overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-(--color-coral)/8 to-(--color-teal)/8 border-b border-(--color-border)">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ApIcon className="w-4 h-4 text-(--color-coral)" />
            <h2
              className="text-sm font-semibold text-(--color-text-primary)"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Federe Ağ
            </h2>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Canlı
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-5">
          <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-3 divide-x divide-(--color-border)">
          <StatCell icon={<Server className="w-3.5 h-3.5" />} value={stats.instances} label="sunucu" />
          <StatCell icon={<Users className="w-3.5 h-3.5" />} value={stats.actors} label="kullanıcı" compact />
          <StatCell icon={<Wifi className="w-3.5 h-3.5" />} value={stats.inbound} label="mesaj/gün" compact />
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center gap-2.5">
          <Globe className="w-3.5 h-3.5 text-(--color-teal) flex-shrink-0" />
          <p className="text-xs text-(--color-text-secondary) leading-snug">
            ActivityPub protokolüyle binlerce federe sunucuya bağlı.
          </p>
        </div>
      )}
    </section>
  )
}

function StatCell({
  icon,
  value,
  label,
  compact = false,
}: {
  icon: React.ReactNode
  value: number
  label: string
  compact?: boolean
}) {
  const display = compact && value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()
  return (
    <div className="flex flex-col items-center gap-0.5 py-3 px-2 text-center">
      <span className="text-(--color-text-tertiary)">{icon}</span>
      <span className="text-sm font-bold text-(--color-text-primary) tabular-nums">{display}</span>
      <span className="text-[9px] text-(--color-text-tertiary) uppercase tracking-wide">{label}</span>
    </div>
  )
}

/* ── Trending ─────────────────────────────────────────── */
function TrendingSection() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.search.trendingTags().then((d) => setTags(d.tags)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
    </div>
  )

  if (tags.length === 0) return null

  return (
    <section className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) overflow-hidden">
      <div className="px-4 py-3 border-b border-(--color-border)">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-(--color-coral)" />
          <h2 className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Gündem
          </h2>
        </div>
      </div>
      <div className="divide-y divide-(--color-border)">
        {tags.map(({ tag, count }, i) => (
          <Link
            key={tag}
            href={`/hashtag/${encodeURIComponent(tag)}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-background) transition-colors group"
          >
            <span className="w-5 text-[11px] font-bold text-(--color-text-tertiary) tabular-nums flex-shrink-0 text-right">
              {i + 1}
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Hash className="w-3 h-3 text-(--color-text-tertiary) flex-shrink-0" />
              <span className="text-sm font-medium text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors truncate">
                {tag}
              </span>
            </div>
            <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0 tabular-nums">
              {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ── Suggested ────────────────────────────────────────── */
function SuggestedSection() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.actors.suggested().then((d) => setActors(d.actors.slice(0, 5))).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const follow = useCallback(async (handle: string) => {
    setFollowing((prev) => new Set([...prev, handle]))
    try {
      await api.actors.follow(handle)
    } catch {
      setFollowing((prev) => { const s = new Set(prev); s.delete(handle); return s })
    }
  }, [])

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
    </div>
  )

  if (actors.length === 0) return null

  return (
    <section className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) overflow-hidden">
      <div className="px-4 py-3 border-b border-(--color-border)">
        <h2 className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Seni Tanıyabilirler
        </h2>
      </div>
      <div className="divide-y divide-(--color-border)">
        {actors.map((actor) => {
          const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
          const isFollowing = following.has(actor.handle)
          return (
            <div key={actor.id} className="flex items-center gap-3 px-4 py-3 group">
              <Link href={`/${actor.handle}`} className="flex-shrink-0">
                <div className="relative">
                  <Avatar className="w-9 h-9">
                    {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
                    <AvatarFallback
                      className="text-xs font-medium text-white"
                      style={{ background: 'var(--gradient-avatar)' }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!actor.isLocal && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-(--color-background-secondary) flex items-center justify-center"
                      title="Federe kullanıcı"
                    >
                      <Globe className="w-2.5 h-2.5 text-(--color-teal)" />
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/${actor.handle}`} className="block">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate hover:underline" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {actor.displayName ?? actor.handle}
                  </p>
                  <p className="text-xs text-(--color-text-tertiary) truncate">@{actor.handle}</p>
                </Link>
              </div>
              <Button
                size="sm"
                variant={isFollowing ? 'outline' : 'default'}
                onClick={() => void follow(actor.handle)}
                disabled={isFollowing}
                className={cn(
                  'flex-shrink-0 text-xs px-3 rounded-full',
                  isFollowing
                    ? 'border-(--color-border) text-(--color-text-tertiary)'
                    : 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0',
                )}
              >
                {isFollowing ? 'Takip' : 'Takip et'}
              </Button>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2.5">
        <Link href="/explore" className="text-xs text-(--color-coral) hover:underline">
          Daha fazla gör
        </Link>
      </div>
    </section>
  )
}

/* ── Footer badge ─────────────────────────────────────── */
function FooterBadge() {
  return (
    <div className="px-1 py-2 flex items-center gap-2">
      <ApIcon className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
      <p className="text-[11px] text-(--color-text-tertiary) leading-relaxed">
        <span className="font-semibold text-(--color-text-secondary)">floq</span>
        {' · '}ActivityPub{' · '}
        <Link href="/privacy" className="hover:underline">Gizlilik</Link>
        {' · '}
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Açık Kaynak
        </a>
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
    <aside className="hidden xl:flex flex-col w-72 flex-shrink-0 sticky top-0 self-start h-screen overflow-y-auto pt-4 pr-4 gap-3 scrollbar-none">
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

      <FederationWidget />
      <TrendingSection />
      <SuggestedSection />
      <FooterBadge />
    </aside>
  )
}
