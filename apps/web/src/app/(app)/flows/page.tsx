'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type FlowInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Loader2, Layers, Plus, Search, Users, FileText, Lock, Globe, Link2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'

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
    <div className="flex items-start gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) transition-colors">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-(--color-coral) to-(--color-peach) flex items-center justify-center flex-shrink-0">
        <Layers className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <Link href={`/flows/${flow.slug}`} className="block group">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors truncate">
              {flow.name}
            </p>
            {!flow.isPublic && <Lock className="w-3 h-3 text-(--color-text-tertiary)" />}
          </div>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5 line-clamp-2">
            {flow.description ?? `/${flow.slug}`}
          </p>
        </Link>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-(--color-text-tertiary) flex items-center gap-1">
            <Users className="w-3 h-3" />{flow.membersCount}
          </span>
          <span className="text-xs text-(--color-text-tertiary) flex items-center gap-1">
            <FileText className="w-3 h-3" />{flow.postsCount}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant={flow.isMember ? 'outline' : 'default'}
        onClick={toggle}
        disabled={loading}
        className={cn(
          'h-7 text-xs flex-shrink-0',
          !flow.isMember && 'bg-(--color-coral) hover:bg-(--color-peach) text-white border-0',
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
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>('popular')
  const [newFlow, setNewFlow] = useState({ name: '', slug: '', description: '', isPublic: true })

  // Join via invite
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
      setCreating(false)
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
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Akışlar
            </h1>
          </div>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-(--color-coral) hover:bg-(--color-peach) text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Akış
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--color-text-tertiary)" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Akış ara..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </header>

      {/* Join via invite */}
      <div className="border-b border-(--color-border) px-4 py-3 bg-(--color-background-secondary)">
        <p className="text-xs font-medium text-(--color-text-secondary) mb-2 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Davet kodun var mı?
        </p>
        <div className="flex gap-2">
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Davet kodunu gir..."
            className="h-8 text-sm font-mono flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') void handleJoinInvite() }}
          />
          <Button
            size="sm"
            onClick={handleJoinInvite}
            disabled={joiningInvite || !inviteCode.trim()}
            className="h-8 bg-(--color-coral) hover:bg-(--color-peach) text-white border-0"
          >
            {joiningInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Katıl'}
          </Button>
        </div>
        {inviteMessage && (
          <p className={cn(
            'text-xs mt-1.5',
            inviteMessage.type === 'success' ? 'text-green-600' : 'text-red-500',
          )}>
            {inviteMessage.text}
          </p>
        )}
      </div>

      {creating && (
        <div className="border-b border-(--color-border) bg-(--color-background-secondary) p-4 space-y-2">
          <p className="text-xs font-medium text-(--color-text-secondary)">Yeni Akış</p>
          <Input
            value={newFlow.name}
            onChange={(e) => {
              const name = e.target.value
              const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
              setNewFlow((f) => ({ ...f, name, slug }))
            }}
            placeholder="Akış adı"
            className="h-8 text-sm"
          />
          <Input
            value={newFlow.slug}
            onChange={(e) => setNewFlow((f) => ({ ...f, slug: e.target.value }))}
            placeholder="slug (örn: teknoloji-haberleri)"
            className="h-8 text-sm font-mono"
          />
          <Textarea
            value={newFlow.description}
            onChange={(e) => setNewFlow((f) => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama (opsiyonel)"
            className="resize-none h-16 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewFlow((f) => ({ ...f, isPublic: !f.isPublic }))}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
                newFlow.isPublic
                  ? 'bg-(--color-blush) text-(--color-coral)'
                  : 'bg-(--color-background) text-(--color-text-tertiary) border border-(--color-border)',
              )}
            >
              {newFlow.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {newFlow.isPublic ? 'Herkese açık' : 'Özel'}
            </button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>İptal</Button>
            <Button
              size="sm"
              onClick={create}
              disabled={saving || !newFlow.name.trim() || !newFlow.slug.trim()}
              className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Oluştur'}
            </Button>
          </div>
        </div>
      )}

      {joined.length > 0 && (
        <>
          <div className="px-4 py-2 border-b border-(--color-border-secondary) flex items-center gap-3">
            <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest whitespace-nowrap">Katıldıklarım</p>
            <Separator className="flex-1 bg-(--color-border-secondary)" />
          </div>
          {joined.map((flow) => (
            <FlowCard key={flow.id} flow={{ ...flow, isMember: true }} onJoin={handleJoin} onLeave={handleLeave} />
          ))}
        </>
      )}

      {/* Discover tabs */}
      <div className="flex border-b border-(--color-border) bg-(--color-background)">
        <button
          onClick={() => setDiscoverTab('popular')}
          className={cn(
            'flex-1 py-2 text-xs font-semibold transition-colors',
            discoverTab === 'popular'
              ? 'text-(--color-coral) border-b-2 border-(--color-coral)'
              : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
          )}
        >
          Popüler
        </button>
        <button
          onClick={() => setDiscoverTab('trending')}
          className={cn(
            'flex-1 py-2 text-xs font-semibold transition-colors',
            discoverTab === 'trending'
              ? 'text-(--color-coral) border-b-2 border-(--color-coral)'
              : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
          )}
        >
          Trend
        </button>
      </div>

      {discover.length > 0 && (
        <>
          <div className="px-4 py-2 border-b border-(--color-border-secondary) flex items-center gap-3">
            <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest whitespace-nowrap">
              {search ? 'Sonuçlar' : 'Keşfet'}
            </p>
            <Separator className="flex-1 bg-(--color-border-secondary)" />
          </div>
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
    </div>
  )
}
