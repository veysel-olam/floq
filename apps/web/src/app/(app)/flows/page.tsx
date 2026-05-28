'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type FlowInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Loader2, Layers, Plus, Search, Users, FileText,
  Lock, Globe, Link2, ChevronDown,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// Deterministic color from slug — picks one of 6 palette stops
const FLOW_COLORS = [
  { bg: 'bg-violet-500/15', text: 'text-violet-500', ring: 'ring-violet-500/20' },
  { bg: 'bg-sky-500/15', text: 'text-sky-500', ring: 'ring-sky-500/20' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  { bg: 'bg-amber-500/15', text: 'text-amber-500', ring: 'ring-amber-500/20' },
  { bg: 'bg-rose-500/15', text: 'text-rose-500', ring: 'ring-rose-500/20' },
  { bg: 'bg-(--color-coral)/15 text-(--color-coral)', text: 'text-(--color-coral)', ring: 'ring-(--color-coral)/20' },
]

function flowColor(slug: string) {
  const n = slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return FLOW_COLORS[n % FLOW_COLORS.length]
}

function FlowAvatar({ slug, name, size = 'md' }: { slug: string; name: string; size?: 'sm' | 'md' }) {
  const { bg, text, ring } = flowColor(slug)
  const letter = (name[0] ?? slug[0] ?? '?').toUpperCase()
  return (
    <div className={cn(
      'rounded-xl flex items-center justify-center flex-shrink-0 font-bold ring-1',
      bg, text, ring,
      size === 'md' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm',
    )}>
      {letter}
    </div>
  )
}

function FlowCard({ flow, onJoin, onLeave }: {
  flow: FlowInfo & { isMember?: boolean }
  onJoin: (slug: string) => void
  onLeave: (slug: string) => void
}) {
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      if (flow.isMember) onLeave(flow.slug)
      else onJoin(flow.slug)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/50 transition-colors group">
      <FlowAvatar slug={flow.slug} name={flow.name} />

      <div className="flex-1 min-w-0">
        <Link href={`/flows/${flow.slug}`} className="block">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
              {flow.name}
            </p>
            {!flow.isPublic && <Lock className="w-3 h-3 text-(--color-text-tertiary) flex-shrink-0" />}
          </div>
          {flow.description && (
            <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 truncate leading-relaxed">
              {flow.description}
            </p>
          )}
        </Link>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1 font-medium">
            <Users className="w-2.5 h-2.5" />{flow.membersCount}
          </Badge>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1 font-medium">
            <FileText className="w-2.5 h-2.5" />{flow.postsCount}
          </Badge>
          <span className="text-[10px] text-(--color-text-tertiary) font-mono">/{flow.slug}</span>
        </div>
      </div>

      <Button
        size="sm"
        variant={flow.isMember ? 'outline' : 'default'}
        onClick={toggle}
        disabled={loading}
        className={cn(
          'flex-shrink-0 h-7 text-xs px-3.5 rounded-full',
          flow.isMember
            ? 'border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
            : 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0',
        )}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : flow.isMember ? 'Ayrıl' : 'Katıl'}
      </Button>
    </div>
  )
}

type DiscoverTab = 'popular' | 'trending'

export default function FlowsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [joined, setJoined] = useState<FlowInfo[]>([])
  const [discover, setDiscover] = useState<FlowInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>('popular')
  const [newFlow, setNewFlow] = useState({ name: '', slug: '', description: '', isPublic: true })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joiningInvite, setJoiningInvite] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async (q?: string, sort?: string) => {
    try {
      const data = await api.flows.list(q, sort)
      setJoined(data.joined)
      setDiscover(data.discover)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load(undefined, discoverTab === 'trending' ? 'trending' : undefined)
  }, [isPending, session, load, router, discoverTab])

  useEffect(() => {
    const t = setTimeout(() => {
      if (session) void load(search || undefined, discoverTab === 'trending' ? 'trending' : undefined)
    }, 400)
    return () => clearTimeout(t)
  }, [search, session, load, discoverTab])

  async function create() {
    if (!newFlow.name.trim() || !newFlow.slug.trim()) return
    setSaving(true)
    try {
      const flow = await api.flows.create({
        name: newFlow.name,
        slug: newFlow.slug,
        description: newFlow.description || undefined,
        isPublic: newFlow.isPublic,
      })
      setJoined((prev) => [{ ...flow, isMember: true }, ...prev])
      setNewFlow({ name: '', slug: '', description: '', isPublic: true })
      setCreateOpen(false)
    } catch (err) {
      alert((err as { message?: string }).message ?? 'Hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function handleJoin(slug: string) {
    await api.flows.join(slug)
    const flow = discover.find((f) => f.slug === slug)
    if (flow) {
      setDiscover((prev) => prev.filter((f) => f.slug !== slug))
      setJoined((prev) => [{ ...flow, isMember: true, membersCount: flow.membersCount + 1 }, ...prev])
    }
  }

  async function handleLeave(slug: string) {
    await api.flows.leave(slug)
    const flow = joined.find((f) => f.slug === slug)
    if (flow) {
      setJoined((prev) => prev.filter((f) => f.slug !== slug))
      setDiscover((prev) => [{ ...flow, isMember: false, membersCount: Math.max(flow.membersCount - 1, 0) }, ...prev])
    }
  }

  async function handleJoinInvite() {
    const code = inviteCode.trim()
    if (!code) return
    setJoiningInvite(true)
    setInviteMessage(null)
    try {
      const flow = await api.flows.joinViaInvite(code)
      setJoined((prev) => {
        if (prev.some((f) => f.id === flow.id)) return prev
        return [{ ...flow, isMember: true }, ...prev]
      })
      setInviteCode('')
      setInviteMessage({ type: 'success', text: `"${flow.name}" akışına katıldın!` })
    } catch (err) {
      setInviteMessage({ type: 'error', text: (err as { message?: string }).message ?? 'Geçersiz davet kodu.' })
    } finally {
      setJoiningInvite(false)
    }
  }

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Akışlar</h1>
          </div>
        </header>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Akışlar
            </h1>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white gap-1.5 rounded-full px-4"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Akış
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary)" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Akış ara..."
            className="pl-9 rounded-full bg-(--color-background-secondary) border-0 focus-visible:ring-1 focus-visible:ring-(--color-coral)"
          />
        </div>
      </header>

      {/* Invite code — collapsible */}
      <Collapsible open={inviteOpen} onOpenChange={setInviteOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2.5 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/40 transition-colors group">
          <span className="flex items-center gap-2 text-[12px] font-medium text-(--color-text-tertiary) group-hover:text-(--color-text-secondary) transition-colors">
            <Link2 className="w-3.5 h-3.5" />
            Davet kodun var mı?
          </span>
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-(--color-text-tertiary) transition-transform duration-200',
            inviteOpen && 'rotate-180',
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-(--color-border-secondary)">
          <div className="px-3 pb-3 space-y-2">
            <div className="flex gap-2 px-3 py-2.5 rounded-2xl bg-(--color-background-secondary)/60">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Davet kodunu gir..."
                className="h-8 text-sm font-mono flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 placeholder:text-(--color-text-tertiary)"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleJoinInvite() }}
              />
              <Button
                size="sm"
                onClick={handleJoinInvite}
                disabled={joiningInvite || !inviteCode.trim()}
                className="h-7 bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0 rounded-full px-4 flex-shrink-0"
              >
                {joiningInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Katıl'}
              </Button>
            </div>
            {inviteMessage && (
              <p className={cn(
                'text-xs px-1',
                inviteMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500',
              )}>
                {inviteMessage.text}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Joined flows */}
      {joined.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wider">
              Katıldıklarım · {joined.length}
            </p>
          </div>
          {joined.map((flow) => (
            <FlowCard key={flow.id} flow={{ ...flow, isMember: true }} onJoin={handleJoin} onLeave={handleLeave} />
          ))}
        </>
      )}

      {/* Discover tabs */}
      <Tabs
        value={discoverTab}
        onValueChange={(v) => setDiscoverTab(v as DiscoverTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="popular" className="flex-1 text-[13px]">Popüler</TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 text-[13px]">Trend</TabsTrigger>
        </TabsList>
      </Tabs>

      {discover.length > 0 && (
        <>
          {search && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wider">
                Sonuçlar · {discover.length}
              </p>
            </div>
          )}
          {discover.map((flow) => (
            <FlowCard key={flow.id} flow={{ ...flow, isMember: false }} onJoin={handleJoin} onLeave={handleLeave} />
          ))}
        </>
      )}

      {joined.length === 0 && discover.length === 0 && (
        <EmptyState
          icon={Layers}
          title={search ? 'Sonuç bulunamadı' : 'Henüz akış yok'}
          description={search ? undefined : 'Akışlar, konu bazlı paylaşım kanallarıdır.'}
        />
      )}

      {/* Create flow dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base" style={{ fontFamily: 'var(--font-outfit)' }}>
              <Layers className="w-4 h-4 text-(--color-coral)" />
              Yeni Akış
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-wider">İsim</label>
              <Input
                value={newFlow.name}
                onChange={(e) => {
                  const name = e.target.value
                  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                  setNewFlow((f) => ({ ...f, name, slug }))
                }}
                placeholder="Akış adı"
                className="h-9 focus-visible:ring-1 focus-visible:ring-(--color-coral) focus-visible:border-(--color-coral)"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-wider">Slug</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-(--color-text-tertiary) pointer-events-none">/</span>
                <Input
                  value={newFlow.slug}
                  onChange={(e) => setNewFlow((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="teknoloji-haberleri"
                  className="h-9 pl-5 font-mono text-sm focus-visible:ring-1 focus-visible:ring-(--color-coral) focus-visible:border-(--color-coral)"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-wider">
                Açıklama <span className="normal-case font-normal">· opsiyonel</span>
              </label>
              <Textarea
                value={newFlow.description}
                onChange={(e) => setNewFlow((f) => ({ ...f, description: e.target.value }))}
                placeholder="Bu akış hakkında kısa bir açıklama..."
                className="resize-none h-16 text-sm focus-visible:ring-1 focus-visible:ring-(--color-coral) focus-visible:border-(--color-coral)"
              />
            </div>

            {/* Visibility toggle — inline pill, not full-width */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-wider">Görünürlük</span>
              <button
                onClick={() => setNewFlow((f) => ({ ...f, isPublic: !f.isPublic }))}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  newFlow.isPublic
                    ? 'bg-(--color-coral)/10 text-(--color-coral) ring-1 ring-(--color-coral)/20'
                    : 'bg-(--color-background-secondary) text-(--color-text-secondary) ring-1 ring-(--color-border)',
                )}
              >
                {newFlow.isPublic
                  ? <><Globe className="w-3 h-3" /> Herkese açık</>
                  : <><Lock className="w-3 h-3" /> Özel</>}
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button
              size="sm"
              onClick={create}
              disabled={saving || !newFlow.name.trim() || !newFlow.slug.trim()}
              className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white rounded-full px-5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
