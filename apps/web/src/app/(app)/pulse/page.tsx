'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type PulseData } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ConnectionMap } from '@/components/pulse/connection-map'
import { Loader2, Activity, Globe, Users, CheckCircle, XCircle, Clock, ArrowUpRight, Map } from 'lucide-react'

type Tab = 'stats' | 'map'

function StatusDot({ status }: { status: string }) {
  if (status === 'done') return <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
  if (status === 'failed') return <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
  return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  return <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
}

function ConnectionBar({ domain, following, followers, total, max }: {
  domain: string; following: number; followers: number; total: number; max: number
}) {
  const pct = max > 0 ? (total / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 mx-2 px-3 py-3 rounded-xl hover:bg-(--color-background-secondary) transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-medium text-(--color-text-primary) truncate">{domain}</span>
          <div className="flex items-center gap-2.5 ml-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
              <ArrowUpRight className="w-3 h-3" />{following}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
              <Users className="w-3 h-3" />{followers}
            </span>
          </div>
        </div>
        <div className="h-1 rounded-full bg-(--color-background-tertiary) overflow-hidden">
          <div
            className="h-full rounded-full bg-(--color-coral)/60 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-5 pb-2 text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest">
      {children}
    </p>
  )
}

function PageHeader({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-(--color-coral)" />
          <div>
            <h1 className="text-base font-bold text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
              Federation Pulse
            </h1>
            <p className="text-[11px] text-(--color-text-tertiary) leading-tight">Fediverse bağlantı durumun</p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-full bg-(--color-background-secondary) p-0.5 gap-0.5">
          {([['stats', Activity, 'İstatistik'], ['map', Map, 'Harita']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium transition-all duration-150 select-none',
                tab === id
                  ? 'bg-(--color-background) text-(--color-text-primary) shadow-sm'
                  : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)',
              )}
            >
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

export default function PulsePage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [data, setData] = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('stats')

  const selfDomain = (session?.user as { handle?: string } | undefined)?.handle
    ? typeof window !== 'undefined' ? window.location.hostname : 'floq.com'
    : 'floq.com'

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    api.pulse.get()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isPending, session, router])

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <PageHeader tab={tab} setTab={setTab} />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto">
        <PageHeader tab={tab} setTab={setTab} />
        <div className="flex flex-col items-center gap-2 py-20 text-center px-6">
          <Globe className="w-8 h-8 text-(--color-text-tertiary)" />
          <p className="text-sm text-(--color-text-tertiary) mt-1">Veri yüklenemedi.</p>
        </div>
      </div>
    )
  }

  const maxConnections = data.connections[0]?.total ?? 1
  const { done, failed, pending } = data.globalStats.deliveries
  const total = done + failed + pending
  const successRate = total > 0 ? Math.round((done / total) * 100) : 100
  const successColor = successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader tab={tab} setTab={setTab} />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 mx-4 mt-4 mb-2">
        <div className="bg-(--color-background-secondary) rounded-xl px-3 py-4 text-center">
          <p className="text-2xl font-bold text-(--color-coral) tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {data.connections.length}
          </p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 leading-tight">Bağlı Sunucu</p>
        </div>
        <div className="bg-(--color-background-secondary) rounded-xl px-3 py-4 text-center">
          <p className="text-2xl font-bold text-(--color-coral) tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {data.globalStats.remoteActors}
          </p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 leading-tight">Uzak Kullanıcı</p>
        </div>
        <div className="bg-(--color-background-secondary) rounded-xl px-3 py-4 text-center">
          <p className={cn('text-2xl font-bold tabular-nums', successColor)} style={{ fontFamily: 'var(--font-outfit)' }}>
            {successRate}%
          </p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 leading-tight">Başarı Oranı</p>
        </div>
      </div>

      {tab === 'map' ? (
        data.connections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center px-6">
            <Globe className="w-8 h-8 text-(--color-text-tertiary)" />
            <p className="text-sm text-(--color-text-secondary) mt-1">Henüz uzak bağlantı yok.</p>
            <p className="text-xs text-(--color-text-tertiary)">Mastodon gibi federe sunuculardan birini takip et.</p>
          </div>
        ) : (
          <div className="px-2 py-4">
            <ConnectionMap connections={data.connections} selfDomain={selfDomain} height={420} />
          </div>
        )
      ) : (
        <>
          {/* Delivery bar */}
          <SectionLabel>Aktivite Teslimatı</SectionLabel>
          <div className="mx-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-(--color-background-tertiary) overflow-hidden flex">
              {total > 0 ? (
                <>
                  <div className="bg-green-500 h-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                  <div className="bg-amber-400 h-full transition-all" style={{ width: `${(pending / total) * 100}%` }} />
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${(failed / total) * 100}%` }} />
                </>
              ) : (
                <div className="bg-(--color-background-tertiary) h-full w-full" />
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="flex items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{done}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{pending}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{failed}
              </span>
            </div>
          </div>

          {/* Connected servers */}
          <SectionLabel>Bağlı Sunucular</SectionLabel>
          {data.connections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center px-6">
              <Globe className="w-8 h-8 text-(--color-text-tertiary)" />
              <p className="text-sm text-(--color-text-secondary) mt-1">Henüz uzak bağlantı yok.</p>
              <p className="text-xs text-(--color-text-tertiary)">Mastodon gibi federe sunuculardan birini takip et.</p>
            </div>
          ) : (
            <div className="mb-2">
              {data.connections.map((c) => (
                <ConnectionBar key={c.domain} {...c} max={maxConnections} />
              ))}
            </div>
          )}

          {/* Recent activity */}
          {data.recentActivity.length > 0 && (
            <>
              <SectionLabel>Son Aktiviteler</SectionLabel>
              <div className="mb-4">
                {data.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl hover:bg-(--color-background-secondary) transition-colors">
                    <StatusIcon status={a.status} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-(--color-text-primary)">{a.type}</span>
                      {a.targetDomain && (
                        <span className="text-[13px] text-(--color-text-tertiary) ml-1.5">→ {a.targetDomain}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-(--color-text-tertiary) tabular-nums flex-shrink-0">
                      {new Date(a.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
