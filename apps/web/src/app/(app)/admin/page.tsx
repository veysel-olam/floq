'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type AdminReport, type FederationHealth, type AuditLog } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, Flag, Check, X, Trash2, Share2, Globe, ClipboardList, Users, ChevronDown, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Taciz',
  hate_speech: 'Nefret söylemi',
  misinformation: 'Yanlış bilgi',
  nsfw: 'Uygunsuz içerik',
  violence: 'Şiddet',
  other: 'Diğer',
}

// ─── Federation Tab ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-(--color-text-primary)' }: {
  label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl bg-(--color-background-secondary) p-3 text-center">
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      <p className="text-xs text-(--color-text-tertiary) mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-(--color-text-tertiary) mt-0.5">{sub}</p>}
    </div>
  )
}

function FederationTab() {
  const [data, setData] = useState<FederationHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.federation()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" /></div>
  if (!data) return <div className="py-12 text-center text-sm text-(--color-text-tertiary)">Veri yüklenemedi.</div>

  const { summary, instances, activityTimeline } = data

  const maxActivity = Math.max(...activityTimeline.map((d) => Math.max(d.outbound, d.inbound)), 1)

  return (
    <div className="p-4 space-y-6">
      {/* Summary cards */}
      <div>
        <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide mb-3">Genel Bakış</p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Bağlı Sunucu" value={summary.totalInstances} sub={`${summary.activeInstances} aktif (7g)`} color="text-(--color-coral)" />
          <StatCard label="Uzak Aktör" value={summary.remoteActors} />
          <StatCard label="Uzak Takipçi" value={summary.remoteFollowers} sub="bizi takip ediyor" color="text-green-500" />
          <StatCard label="Takip Edilen" value={summary.remoteFollowing} sub="uzak sunucu" />
        </div>
      </div>

      {/* Activity 24h */}
      <div>
        <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide mb-3">Son 24 Saat — AP Aktivitesi</p>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Gönderilen" value={summary.outbound24h} color="text-blue-500" />
          <StatCard label="Alınan" value={summary.inbound24h} color="text-purple-500" />
          <StatCard label="Başarısız" value={summary.failed24h} color={summary.failed24h > 0 ? 'text-red-500' : 'text-(--color-text-tertiary)'} />
        </div>
      </div>

      {/* Activity timeline — last 7 days */}
      {activityTimeline.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide mb-3">Son 7 Gün — Aktivite Grafiği</p>
          <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-3">
            <div className="flex gap-1 items-end h-20">
              {activityTimeline.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col gap-0.5 items-center h-full justify-end">
                  <div className="w-full flex flex-col gap-px items-center justify-end h-full">
                    <div
                      title={`Gönderilen: ${d.outbound}`}
                      className="w-full bg-blue-400/70 rounded-t-sm"
                      style={{ height: `${Math.round((d.outbound / maxActivity) * 100)}%`, minHeight: d.outbound > 0 ? 3 : 0 }}
                    />
                    <div
                      title={`Alınan: ${d.inbound}`}
                      className="w-full bg-purple-400/70"
                      style={{ height: `${Math.round((d.inbound / maxActivity) * 100)}%`, minHeight: d.inbound > 0 ? 3 : 0 }}
                    />
                  </div>
                  <span className="text-[9px] text-(--color-text-tertiary) mt-1">
                    {new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-(--color-border)">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-400/70" /><span className="text-[10px] text-(--color-text-tertiary)">Gönderilen</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-purple-400/70" /><span className="text-[10px] text-(--color-text-tertiary)">Alınan</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Instance table */}
      <div>
        <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide mb-3">
          Bağlı Sunucular ({instances.length})
        </p>
        {instances.length === 0 ? (
          <div className="rounded-xl border border-(--color-border) py-12 text-center">
            <Globe className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
            <p className="text-sm text-(--color-text-tertiary)">Henüz federasyon yok.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-(--color-border) overflow-hidden divide-y divide-(--color-border)">
            {instances.map((inst) => {
              const isRecent = inst.lastSeenAt && (Date.now() - new Date(inst.lastSeenAt).getTime()) < 7 * 24 * 60 * 60 * 1000
              return (
                <div key={inst.id} className="px-4 py-3 flex items-start gap-3 bg-(--color-background)">
                  {/* Status dot */}
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    inst.isSuspended ? 'bg-red-500' :
                    inst.isSilenced ? 'bg-amber-500' :
                    isRecent ? 'bg-green-500' : 'bg-(--color-border)',
                  )} title={inst.isSuspended ? 'Askıya alındı' : inst.isSilenced ? 'Susturuldu' : isRecent ? 'Aktif' : 'Pasif'} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-(--color-text-primary) truncate">{inst.domain}</span>
                      {inst.software && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-background-secondary) text-(--color-text-tertiary)">
                          {inst.software}{inst.softwareVersion ? ` ${inst.softwareVersion}` : ''}
                        </span>
                      )}
                      {inst.isSuspended && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500">Askıya alındı</span>
                      )}
                      {inst.isSilenced && !inst.isSuspended && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-500">Susturuldu</span>
                      )}
                    </div>
                    {inst.name && <p className="text-xs text-(--color-text-secondary) mt-0.5">{inst.name}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-(--color-text-tertiary)">
                      <span>{inst.actorsCount} aktör</span>
                      <span className="text-green-600 dark:text-green-400">↓ {inst.remoteFollowers} takipçi</span>
                      <span className="text-blue-600 dark:text-blue-400">↑ {inst.remoteFollowing} takip</span>
                      {inst.lastSeenAt && (
                        <span>Son: {new Date(inst.lastSeenAt).toLocaleDateString('tr-TR')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Audit Log Tab ─────────────────────────────────────────────────────────

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.auditLog(50)
      .then((d) => setLogs(d.logs))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ACTION_LABELS: Record<string, string> = {
    'report.accept': 'Rapor kabul edildi',
    'report.reject': 'Rapor reddedildi',
    'instance.suspend': 'Sunucu askıya alındı',
    'instance.unsuspend': 'Sunucu aktif edildi',
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" /></div>

  return (
    <div className="divide-y divide-(--color-border)">
      {logs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-(--color-text-tertiary)">Henüz aksiyon yok.</p>
        </div>
      ) : logs.map((log) => (
        <div key={log.id} className="px-4 py-3 flex items-start gap-3">
          <Avatar className="w-7 h-7 flex-shrink-0">
            {log.actor.avatarUrl && <AvatarImage src={log.actor.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(log.actor.displayName ?? log.actor.handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-(--color-text-primary)">@{log.actor.handle}</span>
              <span className="text-xs text-(--color-text-secondary)">{ACTION_LABELS[log.action] ?? log.action}</span>
              {log.targetId && (
                <span className="text-[10px] text-(--color-text-tertiary) font-mono truncate max-w-[120px]">{log.targetId}</span>
              )}
            </div>
            <p className="text-[10px] text-(--color-text-tertiary) mt-0.5">
              {new Date(log.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────

type AdminUser = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; role: 'user' | 'moderator' | 'admin'; createdAt: string }

const ROLE_LABELS: Record<string, string> = { user: 'Kullanıcı', moderator: 'Moderatör', admin: 'Admin' }
const ROLE_COLORS: Record<string, string> = {
  user: 'text-(--color-text-tertiary)',
  moderator: 'text-blue-500',
  admin: 'text-(--color-coral)',
}

function UsersTab({ currentHandle }: { currentHandle: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const load = useCallback((query: string) => {
    setLoading(true)
    api.admin.users(query || undefined)
      .then((d) => setUsers(d.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  async function setRole(handle: string, role: 'user' | 'moderator' | 'admin') {
    setUpdating(handle)
    setOpenMenu(null)
    try {
      await api.admin.setRole(handle, role)
      setUsers((prev) => prev.map((u) => u.handle === handle ? { ...u, role } : u))
    } catch { /* ignore */ } finally { setUpdating(null) }
  }

  return (
    <div>
      <div className="p-4 border-b border-(--color-border)">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Handle veya isim ara…"
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 focus:outline-none focus:border-(--color-coral) text-(--color-text-primary) placeholder:text-(--color-text-tertiary)"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-sm text-(--color-text-tertiary)">Kullanıcı bulunamadı.</div>
      ) : (
        <div className="divide-y divide-(--color-border)">
          {users.map((user) => (
            <div key={user.id} className="px-4 py-3 flex items-center gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                  {(user.displayName ?? user.handle).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--color-text-primary) truncate">
                  {user.displayName ?? user.handle}
                </p>
                <p className="text-xs text-(--color-text-tertiary)">@{user.handle}</p>
              </div>

              {/* Role badge + dropdown */}
              {user.handle === currentHandle ? (
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full bg-(--color-background-secondary)', ROLE_COLORS[user.role])}>
                  {ROLE_LABELS[user.role]}
                </span>
              ) : (
                <div className="relative">
                  <button
                    disabled={updating === user.handle}
                    onClick={() => setOpenMenu(openMenu === user.handle ? null : user.handle)}
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-(--color-background-secondary) transition-colors hover:bg-(--color-background-tertiary)',
                      ROLE_COLORS[user.role],
                    )}
                  >
                    {updating === user.handle
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <>{ROLE_LABELS[user.role]}<ChevronDown className="w-3 h-3" /></>
                    }
                  </button>
                  {openMenu === user.handle && (
                    <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg z-20 py-1 overflow-hidden">
                      {(['user', 'moderator', 'admin'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => void setRole(user.handle, r)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-(--color-background-secondary)',
                            user.role === r ? ROLE_COLORS[r] + ' font-semibold' : 'text-(--color-text-secondary)',
                          )}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Reports Tab ───────────────────────────────────────────────────────────

function ReportsTab({ stats }: { stats: { pending: number; accepted: number; rejected: number } | null }) {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [tab, setTab] = useState<'pending' | 'reviewed_accepted' | 'reviewed_rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [suspending, setSuspending] = useState<string | null>(null)

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const data = await api.admin.reports(status)
      setReports(data.reports)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(tab) }, [tab, load])

  async function review(id: string, status: 'reviewed_accepted' | 'reviewed_rejected', deletePost = false) {
    setReviewing(id)
    try {
      await api.admin.reviewReport(id, { status, deletePost })
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch { /* ignore */ } finally { setReviewing(null) }
  }

  async function suspendAndAccept(reportId: string, handle: string) {
    setSuspending(reportId)
    try {
      await api.admin.suspend(handle)
      await api.admin.reviewReport(reportId, { status: 'reviewed_accepted' })
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch { /* ignore */ } finally { setSuspending(null) }
  }

  return (
    <>
      {stats && (
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-(--color-border)">
          {[
            { label: 'Bekleyen', value: stats.pending, color: 'text-amber-500' },
            { label: 'Kabul', value: stats.accepted, color: 'text-green-500' },
            { label: 'Reddedilen', value: stats.rejected, color: 'text-(--color-text-tertiary)' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-(--color-background-secondary) p-3 text-center">
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-(--color-text-tertiary) mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex border-b border-(--color-border)">
        {([
          { id: 'pending', label: 'Bekleyen' },
          { id: 'reviewed_accepted', label: 'Kabul edildi' },
          { id: 'reviewed_rejected', label: 'Reddedildi' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors border-b-2',
              tab === t.id
                ? 'border-(--color-coral) text-(--color-coral)'
                : 'border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" /></div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center">
          <Flag className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
          <p className="text-sm text-(--color-text-tertiary)">Rapor yok.</p>
        </div>
      ) : (
        <div className="divide-y divide-(--color-border)">
          {reports.map((report) => (
            <div key={report.id} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  {report.reporter.avatarUrl && <AvatarImage src={report.reporter.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                    {(report.reporter.displayName ?? report.reporter.handle).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-(--color-text-tertiary)">
                  <span className="font-medium text-(--color-text-secondary)">@{report.reporter.handle}</span> raporladı
                </span>
                <span className="ml-auto text-[10px] text-(--color-text-tertiary)">
                  {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                  {REASON_LABELS[report.reason] ?? report.reason}
                </span>
                {report.details && (
                  <span className="text-xs text-(--color-text-secondary) truncate">{report.details}</span>
                )}
              </div>

              {report.post && (
                <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Avatar className="w-5 h-5">
                      {report.post.author?.avatarUrl && <AvatarImage src={report.post.author.avatarUrl} alt="" />}
                      <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                        {(report.post.author?.displayName ?? report.post.author?.handle ?? '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Link href={`/${report.post.author?.handle}`} className="text-xs font-medium text-(--color-text-primary) hover:underline">
                      @{report.post.author?.handle}
                    </Link>
                  </div>
                  <p className="text-sm text-(--color-text-primary) line-clamp-3">{report.post.content}</p>
                  <Link href={`/posts/${report.post.id}`} className="text-[11px] text-(--color-coral) hover:underline mt-1 block">
                    Gönderiyi görüntüle →
                  </Link>
                </div>
              )}

              {report.reportedActor && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary)">
                  <Avatar className="w-8 h-8">
                    {report.reportedActor.avatarUrl && <AvatarImage src={report.reportedActor.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                      {(report.reportedActor.displayName ?? report.reportedActor.handle).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-(--color-text-primary)">{report.reportedActor.displayName ?? report.reportedActor.handle}</p>
                    <p className="text-xs text-(--color-text-tertiary)">@{report.reportedActor.handle}</p>
                  </div>
                </div>
              )}

              {tab === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewing === report.id}
                    onClick={() => void review(report.id, 'reviewed_rejected')}
                    className="flex-1 text-xs border-(--color-border) text-(--color-text-secondary)"
                  >
                    {reviewing === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3 mr-1" />Reddet</>}
                  </Button>
                  <Button
                    size="sm"
                    disabled={reviewing === report.id}
                    onClick={() => void review(report.id, 'reviewed_accepted')}
                    className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Check className="w-3 h-3 mr-1" />Kabul et
                  </Button>
                  {report.post && (
                    <Button
                      size="sm"
                      disabled={reviewing === report.id}
                      onClick={() => void review(report.id, 'reviewed_accepted', true)}
                      className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />Sil
                    </Button>
                  )}
                  {(report.reportedActor ?? report.post?.author) && (
                    <Button
                      size="sm"
                      disabled={suspending === report.id}
                      onClick={() => {
                        const handle = report.reportedActor?.handle ?? report.post?.author?.handle
                        if (handle) void suspendAndAccept(report.id, handle)
                      }}
                      className="flex-1 text-xs bg-gray-700 hover:bg-gray-800 text-white"
                    >
                      {suspending === report.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><ShieldOff className="w-3 h-3 mr-1" />Askıya Al</>}
                    </Button>
                  )}
                </div>
              )}

              {report.reviewNote && (
                <p className="text-xs text-(--color-text-tertiary) italic">Not: {report.reviewNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [stats, setStats] = useState<{ pending: number; accepted: number; rejected: number } | null>(null)
  const [actorRole, setActorRole] = useState<'user' | 'moderator' | 'admin' | null>(null)
  const [mainTab, setMainTab] = useState<'reports' | 'users' | 'federation' | 'audit'>('reports')

  useEffect(() => {
    if (!isPending && !session) router.push('/login')
  }, [isPending, session, router])

  useEffect(() => {
    const handle = (session?.user as { handle?: string })?.handle
    if (!handle || !session) return

    Promise.all([
      api.admin.stats(),
      api.actors.get(handle),
    ]).then(([statsData, actor]) => {
      setStats(statsData)
      setActorRole((actor as { role?: 'user' | 'moderator' | 'admin' }).role ?? null)
      setAuthorized(true)
    }).catch((e: { status?: number }) => {
      if (e.status === 403) setAuthorized(false)
    })
  }, [session])

  if (isPending || authorized === null) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" /></div>
  }

  if (authorized === false) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Shield className="w-10 h-10 text-(--color-text-tertiary) mx-auto mb-3" />
        <p className="text-(--color-text-primary) font-semibold">Erişim yok</p>
        <p className="text-(--color-text-tertiary) text-sm mt-1">Bu sayfa yalnızca yöneticilere açıktır.</p>
      </div>
    )
  }

  const tabs = [
    { id: 'reports' as const, label: 'Raporlar', icon: Flag, roles: ['moderator', 'admin'] },
    { id: 'users' as const, label: 'Kullanıcılar', icon: Users, roles: ['admin'] },
    { id: 'federation' as const, label: 'Federasyon', icon: Share2, roles: ['admin'] },
    { id: 'audit' as const, label: 'Günlük', icon: ClipboardList, roles: ['admin'] },
  ].filter((t) => actorRole && t.roles.includes(actorRole))

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5 flex items-center gap-3">
        <Link href="/home" className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Shield className="w-5 h-5 text-(--color-coral)" />
        <h1 className="font-semibold text-base text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Yönetim Paneli
        </h1>
      </header>

      {/* Main tabs */}
      <div className="flex border-b border-(--color-border)">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2',
                mainTab === t.id
                  ? 'border-(--color-coral) text-(--color-coral)'
                  : 'border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'reports' && (stats?.pending ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold leading-none">
                  {stats!.pending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mainTab === 'reports' && <ReportsTab stats={stats} />}
      {mainTab === 'users' && <UsersTab currentHandle={(session?.user as { handle?: string })?.handle ?? ''} />}
      {mainTab === 'federation' && <FederationTab />}
      {mainTab === 'audit' && <AuditLogTab />}
    </div>
  )
}
