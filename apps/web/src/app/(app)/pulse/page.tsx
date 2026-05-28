'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type PulseData } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ConnectionMap } from '@/components/pulse/connection-map'
import { Loader2, Activity, Globe, Users, CheckCircle, XCircle, Clock, ArrowUpRight, Map } from 'lucide-react'

type Tab = 'stats' | 'map'

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500" />
  return <Clock className="w-3.5 h-3.5 text-amber-500" />
}

function ConnectionBar({ domain, following, followers, total, max }: {
  domain: string; following: number; followers: number; total: number; max: number
}) {
  const pct = max > 0 ? (total / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-(--color-border-secondary)">
      <div className="w-5 h-5 rounded bg-gradient-to-br from-(--color-coral) to-(--color-peach) flex items-center justify-center flex-shrink-0">
        <Globe className="w-3 h-3 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-(--color-text-primary) truncate">{domain}</span>
          <div className="flex items-center gap-2 ml-2 text-xs text-(--color-text-tertiary) flex-shrink-0">
            <span className="flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />{following}</span>
            <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{followers}</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-(--color-background-tertiary) overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-(--color-coral) to-(--color-peach) transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
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
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Federation Pulse</h1>
          </div>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Fediverse bağlantı durumun</p>
        </header>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-(--color-coral)" />
              <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                Federation Pulse
              </h1>
            </div>
            <div className="flex gap-1">
              {([['stats', Activity, 'İstatistik'], ['map', Map, 'Harita']] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                    tab === id
                      ? 'bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) dark:bg-(--color-coral)/12'
                      : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
                  )}
                >
                  <Icon className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Fediverse bağlantı durumun</p>
        </header>
        <div className="py-16 text-center">
          <p className="text-(--color-text-tertiary)">Veri yüklenemedi.</p>
        </div>
      </div>
    )
  }

  const maxConnections = data.connections[0]?.total ?? 1
  const { done, failed, pending } = data.globalStats.deliveries
  const total = done + failed + pending
  const successRate = total > 0 ? Math.round((done / total) * 100) : 100

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Federation Pulse
            </h1>
          </div>
          <div className="flex gap-1">
            {([['stats', Activity, 'İstatistik'], ['map', Map, 'Harita']] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  tab === id
                    ? 'bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) dark:bg-(--color-coral)/12'
                    : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
                )}
              >
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">Fediverse bağlantı durumun</p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-(--color-border) border-b border-(--color-border)">
        <div className="px-4 py-4 text-center">
          <p className="text-2xl font-bold text-(--color-coral)" style={{ fontFamily: 'var(--font-outfit)' }}>
            {data.connections.length}
          </p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Bağlı Sunucu</p>
        </div>
        <div className="px-4 py-4 text-center">
          <p className="text-2xl font-bold text-(--color-coral)" style={{ fontFamily: 'var(--font-outfit)' }}>
            {data.globalStats.remoteActors}
          </p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Uzak Kullanıcı</p>
        </div>
        <div className="px-4 py-4 text-center">
          <p className={cn('text-2xl font-bold', successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-amber-500' : 'text-red-500')} style={{ fontFamily: 'var(--font-outfit)' }}>
            {successRate}%
          </p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Başarı Oranı</p>
        </div>
      </div>

      {tab === 'map' ? (
        /* ── Connection Map ── */
        data.connections.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Globe className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
            <p className="text-sm text-(--color-text-tertiary)">Henüz uzak bağlantı yok.</p>
          </div>
        ) : (
          <div className="px-2 py-4">
            <ConnectionMap connections={data.connections} selfDomain={selfDomain} height={420} />
          </div>
        )
      ) : (
        /* ── Stats tab ── */
        <>
          {/* Delivery stats */}
          <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-background-secondary)">
            <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wider mb-2">Aktivite Teslimatı</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-(--color-background-tertiary) overflow-hidden flex">
                {total > 0 && (
                  <>
                    <div className="bg-green-500 h-full" style={{ width: `${(done / total) * 100}%` }} />
                    <div className="bg-amber-400 h-full" style={{ width: `${(pending / total) * 100}%` }} />
                    <div className="bg-red-500 h-full" style={{ width: `${(failed / total) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-(--color-text-tertiary) flex-shrink-0">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{done}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{pending}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{failed}</span>
              </div>
            </div>
          </div>

          {/* Connections list */}
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-(--color-border-secondary)">
            <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest whitespace-nowrap">Bağlı Sunucular</p>
            <div className="flex-1 h-px bg-(--color-border-secondary)" />
          </div>
          {data.connections.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Globe className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
              <p className="text-sm text-(--color-text-tertiary)">Henüz uzak bağlantı yok.</p>
              <p className="text-xs text-(--color-text-tertiary) mt-1">Mastodon gibi federe sunuculardan birini takip et.</p>
            </div>
          ) : (
            <div className="px-4">
              {data.connections.map((c) => (
                <ConnectionBar key={c.domain} {...c} max={maxConnections} />
              ))}
            </div>
          )}

          {/* Recent activity */}
          {data.recentActivity.length > 0 && (
            <>
              <div className="px-4 py-2.5 flex items-center gap-3 border-y border-(--color-border-secondary) mt-3">
                <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest whitespace-nowrap">Son Aktiviteler</p>
                <div className="flex-1 h-px bg-(--color-border-secondary)" />
              </div>
              <div className="divide-y divide-(--color-border-secondary)">
                {data.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <StatusIcon status={a.status} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-(--color-text-primary)">{a.type}</span>
                      {a.targetDomain && (
                        <span className="text-xs text-(--color-text-tertiary) ml-1.5">→ {a.targetDomain}</span>
                      )}
                    </div>
                    <span className="text-xs text-(--color-text-tertiary) flex-shrink-0">
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
