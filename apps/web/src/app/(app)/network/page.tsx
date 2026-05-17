'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type SocialStats, type PulseData } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Loader2, UserMinus, UserCheck, UserPlus, Clock, Globe, Users,
  TrendingUp, ArrowRight, Activity, CheckCircle, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'bugün'
  if (days === 1) return 'dün'
  if (days < 7) return `${days} gün önce`
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`
  return `${Math.floor(days / 30)} ay önce`
}

function computeHealth(stats: SocialStats, pulse: PulseData | null): {
  score: number
  label: string
  labelColor: string
  reciprocity: number
  growth: number
  fedRate: number
} {
  let score = 80
  score -= Math.min(stats.counts.unfollowers * 4, 25)
  if (stats.counts.notFollowingBack > 15) score -= 12
  else if (stats.counts.notFollowingBack > 7) score -= 6
  score += Math.min(stats.recentFollowers.length * 3, 18)

  let fedRate = 100
  if (pulse) {
    const { done, failed, pending } = pulse.globalStats.deliveries
    const total = done + failed + pending
    fedRate = total > 0 ? Math.round((done / total) * 100) : 100
    if (fedRate < 80) score -= 10
    else if (fedRate >= 98) score += 5
  }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 80 ? 'Sağlıklı' : score >= 60 ? 'Dengeli' : 'Dikkat'
  const labelColor = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'

  const reciprocity = Math.max(0, Math.min(100,
    100 - (stats.counts.notFollowingBack > 0 ? Math.min(stats.counts.notFollowingBack * 8, 60) : 0)
  ))
  const growth = Math.min(100, stats.recentFollowers.length * 20)

  return { score, label, labelColor, reciprocity, growth, fedRate }
}

// ─── Network Health Ring ─────────────────────────────────────────────────────

function HealthRing({ score, label, labelColor }: { score: number; label: string; labelColor: string }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const strokeColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-(--color-background-tertiary)" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            stroke={strokeColor}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold tabular-nums leading-none', labelColor)}>{score}</span>
          <span className="text-[9px] text-(--color-text-tertiary) uppercase tracking-widest mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={cn('text-xs font-bold', labelColor)}>{label}</span>
    </div>
  )
}

// ─── Breakdown Bar ───────────────────────────────────────────────────────────

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-(--color-text-tertiary)">{label}</span>
        <span className={cn('text-[11px] font-semibold tabular-nums', color)}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-(--color-background-tertiary) overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color === 'text-green-500' ? 'bg-green-500' : color === 'text-amber-500' ? 'bg-amber-500' : color === 'text-(--color-coral)' ? 'bg-(--color-coral)' : 'bg-(--color-teal)')}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

// ─── Fediverse Banner ────────────────────────────────────────────────────────

function FediverseBanner({ pulse }: { pulse: PulseData | null }) {
  if (!pulse || pulse.connections.length === 0) return null
  const { done, failed, pending } = pulse.globalStats.deliveries
  const total = done + failed + pending
  const rate = total > 0 ? Math.round((done / total) * 100) : 100
  const healthy = rate >= 95

  return (
    <div className="mx-4 my-3 p-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary) flex items-center gap-3">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', healthy ? 'bg-green-500/10' : 'bg-amber-500/10')}>
        <Activity className={cn('w-4 h-4', healthy ? 'text-green-500' : 'text-amber-500')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-(--color-text-primary) leading-none">Fediverse Bağlantısı</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-(--color-text-tertiary) flex items-center gap-1">
            <Globe className="w-3 h-3" />{pulse.connections.length} sunucu
          </span>
          <span className="text-[11px] text-(--color-text-tertiary) flex items-center gap-1">
            <Users className="w-3 h-3" />{pulse.globalStats.remoteActors} uzak kullanıcı
          </span>
          <span className={cn('text-[11px] font-semibold flex items-center gap-1', healthy ? 'text-green-500' : 'text-amber-500')}>
            <CheckCircle className="w-3 h-3" />{rate}%
          </span>
        </div>
      </div>
      <Link href="/pulse" className="text-[11px] text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors flex items-center gap-0.5 flex-shrink-0">
        Pulse <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
      </Link>
    </div>
  )
}

// ─── Actor Row ───────────────────────────────────────────────────────────────

type MiniActor = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; isLocal?: boolean }

function ActorRow({ actor, meta, action, accent }: {
  actor: MiniActor
  meta?: string
  action?: React.ReactNode
  accent?: string
}) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-(--color-border) hover:bg-(--color-background-secondary)/40 transition-colors group">
      <Link href={`/${actor.handle}`} className="flex-shrink-0 relative">
        <Avatar className="w-10 h-10">
          {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
          <AvatarFallback className="text-sm font-semibold text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {accent && (
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-(--color-background) flex items-center justify-center', accent)} />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/${actor.handle}`}
            className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {actor.displayName ?? actor.handle}
          </Link>
          {actor.isLocal === false && (
            <span title="Federe kullanıcı">
              <Globe className="w-3 h-3 text-(--color-teal) flex-shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
          <span className="truncate">@{actor.handle}</span>
          {meta && (
            <>
              <span className="flex-shrink-0 opacity-40">·</span>
              <span className="flex-shrink-0">{meta}</span>
            </>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ─── Follow Button ───────────────────────────────────────────────────────────

function FollowButton({ handle }: { handle: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  async function follow() {
    setState('loading')
    try { await api.actors.follow(handle); setState('done') }
    catch { setState('idle') }
  }
  if (state === 'done') {
    return (
      <span className="text-xs text-(--color-teal) font-medium flex items-center gap-1">
        <UserCheck className="w-3.5 h-3.5" />Takip ediliyor
      </span>
    )
  }
  return (
    <Button
      size="sm"
      onClick={follow}
      disabled={state === 'loading'}
      className="text-xs px-4 rounded-full h-7 bg-(--color-coral) hover:bg-(--color-coral)/90 text-white border-0 font-medium"
    >
      {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Takip et'}
    </Button>
  )
}


// ─── Tab Config ──────────────────────────────────────────────────────────────

type Tab = 'unfollowers' | 'notFollowingBack' | 'notFollowedBack' | 'recentFollowers'

type TabConfig = {
  id: Tab; label: string; shortLabel: string; icon: React.ReactNode
  colorClass: string; bgClass: string; emptyTitle: string; emptyBody: string
  emptyNote?: string; accent?: string
}

const TABS: TabConfig[] = [
  {
    id: 'unfollowers', label: 'Takipten çıkanlar', shortLabel: 'Çıkanlar',
    icon: <UserMinus className="w-3.5 h-3.5" />, colorClass: 'text-red-500', bgClass: 'bg-red-500/8',
    emptyTitle: 'Kimse seni takipten çıkmamış', emptyBody: 'Son 90 gün içinde takipten çıkış yok. Bağlantıların sağlam.',
    emptyNote: 'Yeni takipten çıkışlar bundan itibaren burada görünecek.', accent: 'bg-red-500',
  },
  {
    id: 'notFollowingBack', label: 'Geri takip etmeyenler', shortLabel: 'Geri almıyor',
    icon: <UserCheck className="w-3.5 h-3.5" />, colorClass: 'text-amber-500', bgClass: 'bg-amber-500/8',
    emptyTitle: 'Herkes geri takip ediyor', emptyBody: 'Takip ettiğin herkes seni de takip ediyor.', accent: 'bg-amber-500',
  },
  {
    id: 'notFollowedBack', label: 'Sen takip etmiyorsun', shortLabel: 'Bekleyenler',
    icon: <UserPlus className="w-3.5 h-3.5" />, colorClass: 'text-(--color-teal)', bgClass: 'bg-(--color-teal)/8',
    emptyTitle: 'Hepsini takip ediyorsun', emptyBody: 'Seni takip edenlerin hepsini sen de takip ediyorsun.', accent: 'bg-(--color-teal)',
  },
  {
    id: 'recentFollowers', label: 'Son takipçiler', shortLabel: 'Yeniler',
    icon: <Clock className="w-3.5 h-3.5" />, colorClass: 'text-(--color-coral)', bgClass: 'bg-(--color-coral)/8',
    emptyTitle: 'Henüz takipçin yok', emptyBody: 'Biri seni takip ettiğinde burada görünür.', accent: 'bg-(--color-coral)',
  },
]

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyTabState({ tab }: { tab: TabConfig }) {
  return (
    <div className="flex flex-col items-center gap-4 py-14 px-8 text-center">
      <div className="relative">
        <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center', tab.bgClass)}>
          <span className={cn('[&>svg]:w-7 [&>svg]:h-7', tab.colorClass)}>{tab.icon}</span>
        </div>
        {tab.id !== 'unfollowers' ? (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-(--color-teal) rounded-full flex items-center justify-center">
            <TrendingUp className="w-2.5 h-2.5 text-white" />
          </span>
        ) : (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">✓</span>
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>{tab.emptyTitle}</p>
        <p className="text-xs text-(--color-text-secondary) max-w-[240px] leading-relaxed">{tab.emptyBody}</p>
      </div>
      {tab.emptyNote && (
        <p className="text-[11px] text-(--color-text-tertiary) bg-(--color-background-secondary) px-3 py-2 rounded-lg max-w-xs leading-relaxed">{tab.emptyNote}</p>
      )}
      {tab.id === 'notFollowedBack' && (
        <Link href="/explore" className="flex items-center gap-1.5 text-xs font-medium text-(--color-coral) hover:underline mt-1">
          Yeni kişiler keşfet <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<SocialStats | null>(null)
  const [pulse, setPulse] = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('unfollowers')

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    Promise.all([
      api.actors.socialStats(),
      api.pulse.get().catch(() => null),
    ])
      .then(([social, p]) => { setStats(social); setPulse(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isPending, session, router])

  const currentTab = TABS.find((t) => t.id === tab)!
  const counts = {
    unfollowers: stats?.counts.unfollowers ?? 0,
    notFollowingBack: stats?.counts.notFollowingBack ?? 0,
    notFollowedBack: stats?.counts.notFollowedBack ?? 0,
    recentFollowers: stats?.recentFollowers.length ?? 0,
  }
  const health = stats ? computeHealth(stats, pulse) : null

  function renderList() {
    if (!stats) return null
    switch (tab) {
      case 'unfollowers':
        if (!stats.unfollowers.length) return null
        return stats.unfollowers.map(({ actor, unfollowedAt }) => (
          <ActorRow key={actor.id} actor={actor} meta={formatRelative(unfollowedAt)} accent={currentTab.accent} />
        ))
      case 'notFollowingBack':
        if (!stats.notFollowingBack.length) return null
        return stats.notFollowingBack.map((actor) => (
          <ActorRow key={actor.id} actor={actor} accent={currentTab.accent} />
        ))
      case 'notFollowedBack':
        if (!stats.notFollowedBack.length) return null
        return stats.notFollowedBack.map((actor) => (
          <ActorRow key={actor.id} actor={actor} action={<FollowButton handle={actor.handle} />} accent={currentTab.accent} />
        ))
      case 'recentFollowers':
        if (!stats.recentFollowers.length) return null
        return stats.recentFollowers.map(({ actor, followedAt }) => (
          <ActorRow key={actor.id} actor={actor} meta={formatRelative(followedAt)} action={<FollowButton handle={actor.handle} />} accent={currentTab.accent} />
        ))
    }
  }

  const listContent = renderList()
  const isEmpty = !loading && listContent === null

  return (
    <div className="max-w-xl mx-auto">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Ağ Haritası
          </h1>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-(--color-border)">
          {TABS.map((t) => {
            const count = loading ? null : counts[t.id]
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 relative flex flex-col items-center gap-1.5 pt-2.5 pb-3 transition-colors',
                  isActive ? t.colorClass : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)',
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                  isActive ? t.bgClass : '',
                )}>
                  {t.icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{t.shortLabel}</span>
                {count != null && count > 0 && (
                  <span className={cn(
                    'absolute top-2 right-[14%] text-[9px] font-bold tabular-nums min-w-[14px] h-3.5 px-1 rounded-full flex items-center justify-center leading-none',
                    isActive ? `${t.bgClass} ${t.colorClass}` : 'bg-(--color-background-tertiary) text-(--color-text-tertiary)',
                  )}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-(--color-coral)" />
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : (
        <>
          {/* Network Health Card */}
          {health && (
            <div className="mx-4 my-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary)">
              <div className="flex items-center gap-4">
                <HealthRing score={health.score} label={health.label} labelColor={health.labelColor} />
                <div className="flex-1 space-y-2.5">
                  <p className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-widest">Ağ Sağlığı</p>
                  <BreakdownBar label="Karşılıklılık" value={health.reciprocity} color="text-(--color-coral)" />
                  <BreakdownBar label="Büyüme İvmesi" value={health.growth} color="text-(--color-teal)" />
                  <BreakdownBar label="Fediverse" value={health.fedRate} color="text-green-500" />
                </div>
              </div>
            </div>
          )}

          {/* Fediverse Banner */}
          <FediverseBanner pulse={pulse} />

          {/* List */}
          {isEmpty ? (
            <EmptyTabState tab={currentTab} />
          ) : (
            <div className="pb-4">{listContent}</div>
          )}
        </>
      )}
    </div>
  )
}
