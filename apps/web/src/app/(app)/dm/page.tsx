'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare, Loader2, Search, Lock, Users,
  Plus, X, Check, BellOff, Archive, ChevronDown, ChevronRight,
} from 'lucide-react'
import { DMListSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useSession } from '@/lib/auth-client'
import { api, type DmConversation, type GroupConversation, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins}d`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}s`
  return `${Math.floor(hours / 24)}g`
}

// ── Group avatar ──────────────────────────────────────────────────────────────

function GroupAvatar({
  members,
  name,
}: {
  members: { handle: string; displayName: string | null; avatarUrl: string | null }[]
  name: string | null
}) {
  const initials = (name ?? members.map((m) => m.displayName ?? m.handle).join(', ')).slice(0, 2).toUpperCase()
  const shown = members.slice(0, 3)

  if (shown.length === 0) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-(--color-coral)/15 text-(--color-coral) flex-shrink-0">
        <Users className="w-5 h-5" />
      </div>
    )
  }

  return (
    <div className="w-11 h-11 relative flex-shrink-0">
      {shown.length === 1 ? (
        <Avatar className="w-11 h-11">
          {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
          <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : shown.length === 2 ? (
        <>
          <Avatar className="w-7 h-7 absolute top-0 left-0">
            {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(shown[0]!.displayName ?? shown[0]!.handle).slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <Avatar className="w-7 h-7 absolute bottom-0 right-0 ring-2 ring-(--color-background)">
            {shown[1]!.avatarUrl && <AvatarImage src={shown[1]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(shown[1]!.displayName ?? shown[1]!.handle).slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        </>
      ) : (
        <>
          <Avatar className="w-6 h-6 absolute top-0 left-1">
            {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(shown[0]!.displayName ?? shown[0]!.handle).slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <Avatar className="w-6 h-6 absolute top-0 right-1">
            {shown[1]!.avatarUrl && <AvatarImage src={shown[1]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'linear-gradient(135deg,#2A9D8F,#3BB5A5)' }}>
              {(shown[1]!.displayName ?? shown[1]!.handle).slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <Avatar className="w-6 h-6 absolute bottom-0 left-1/2 -translate-x-1/2 ring-2 ring-(--color-background)">
            {shown[2]!.avatarUrl && <AvatarImage src={shown[2]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'linear-gradient(135deg,#264653,#2A9D8F)' }}>
              {(shown[2]!.displayName ?? shown[2]!.handle).slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        </>
      )}
    </div>
  )
}

// ── Create group dialog ───────────────────────────────────────────────────────

function CreateGroupDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (g: GroupConversation) => void
}) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Actor[]>([])
  const [selected, setSelected] = useState<Actor[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.search.query(query, 'actors')
        setResults(data.actors.filter((a) => !selected.some((s) => s.id === a.id)).slice(0, 6))
      } catch {
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, selected])

  async function handleCreate() {
    if (selected.length === 0) return
    setCreating(true)
    try {
      const group = await api.dm.createGroup(selected.map((a) => a.handle), name.trim() || undefined)
      onCreate(group)
    } catch {
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni grup</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {/* Group name */}
          <div className="rounded-lg bg-(--color-background-secondary) px-3 py-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grup adı (isteğe bağlı)"
              className="w-full bg-transparent outline-none text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary)"
            />
          </div>

          {/* Member search */}
          <div className="rounded-lg bg-(--color-background-secondary) px-3 py-2.5 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-(--color-text-tertiary) flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Üye ekle..."
              className="flex-1 bg-transparent outline-none text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary)"
            />
            {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-text-tertiary) flex-shrink-0" />}
          </div>

          {results.length > 0 && (
            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              {results.map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => { setSelected((prev) => [...prev, actor]); setQuery(''); setResults([]) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors text-left"
                >
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                      {(actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                    <p className="text-[11px] text-(--color-text-tertiary)">@{actor.handle}</p>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-(--color-text-tertiary) ml-auto flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((actor) => (
                <span
                  key={actor.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-(--color-coral)/10 text-(--color-coral) text-xs border border-(--color-coral)/20"
                >
                  @{actor.handle}
                  <button onClick={() => setSelected((prev) => prev.filter((a) => a.id !== actor.id))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white rounded-full text-sm px-5 h-8"
          >
            {creating
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Check className="w-3.5 h-3.5 mr-1" />Oluştur ({selected.length} üye)</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Conversation row ──────────────────────────────────────────────────────────

function ConvRow({ conv }: { conv: DmConversation }) {
  const { partner, lastMessage, muted, archived } = conv
  const isEncrypted = !!lastMessage.encryptedContent
  const isMine = lastMessage.authorId !== partner.id

  return (
    <Link
      href={`/dm/${partner.handle}`}
      className={cn(
        'flex items-center gap-4 mx-2 px-3 py-3.5 rounded-xl',
        'hover:bg-(--color-background-secondary) active:scale-[0.99] transition-all group',
        archived && 'opacity-50',
      )}
    >
      <Avatar className="w-12 h-12 flex-shrink-0">
        {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.displayName ?? partner.handle} />}
        <AvatarFallback className="text-sm font-semibold text-white" style={{ background: 'var(--gradient-avatar)' }}>
          {(partner.displayName ?? partner.handle).slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[15px] font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {partner.displayName ?? partner.handle}
            </span>
            {isEncrypted && (
              <span title="Uçtan uca şifreli">
                <Lock className="w-3 h-3 text-(--color-teal) flex-shrink-0" />
              </span>
            )}
            {muted && (
              <span title="Sessiz">
                <BellOff className="w-3 h-3 text-(--color-text-tertiary) flex-shrink-0" />
              </span>
            )}
          </div>
          <span className="text-xs text-(--color-text-tertiary) flex-shrink-0 ml-2 tabular-nums">
            {formatRelativeTime(lastMessage.createdAt)}
          </span>
        </div>
        <p className="text-sm text-(--color-text-tertiary) truncate leading-snug">
          {isMine && <span className="text-(--color-text-secondary)">Sen: </span>}
          {isEncrypted
            ? <span className="inline-flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Şifreli mesaj</span>
            : lastMessage.content || '📎 Medya'}
        </p>
      </div>
    </Link>
  )
}

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({
  conv,
  onAccept,
  onDecline,
  isActing,
}: {
  conv: DmConversation
  onAccept: (handle: string) => void
  onDecline: (handle: string) => void
  isActing: boolean
}) {
  const { partner, lastMessage } = conv
  return (
    <div className="flex items-center gap-4 mx-2 px-3 py-3.5 rounded-xl hover:bg-(--color-background-secondary) transition-colors">
      <Link href={`/dm/${partner.handle}`} className="flex items-center gap-4 flex-1 min-w-0 group">
        <Avatar className="w-12 h-12 flex-shrink-0">
          {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt="" />}
          <AvatarFallback className="text-sm font-semibold text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {(partner.displayName ?? partner.handle).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span
              className="text-[15px] font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {partner.displayName ?? partner.handle}
            </span>
            <span className="text-xs text-(--color-text-tertiary) flex-shrink-0 ml-2 tabular-nums">
              {formatRelativeTime(lastMessage.createdAt)}
            </span>
          </div>
          <p className="text-sm text-(--color-text-tertiary) truncate leading-snug">{lastMessage.content || '📎 Medya'}</p>
        </div>
      </Link>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          disabled={isActing}
          onClick={() => onAccept(partner.handle)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[12px] font-medium transition-colors disabled:opacity-40"
        >
          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Kabul
        </button>
        <button
          disabled={isActing}
          onClick={() => onDecline(partner.handle)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[12px] font-medium transition-colors disabled:opacity-40"
        >
          <X className="w-3 h-3" />
          Reddet
        </button>
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

function DmHeader({ onNewGroup }: { onNewGroup: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Mesajlar
          </h1>
          <span title="Uçtan uca şifreli"><Lock className="w-3 h-3 text-(--color-text-tertiary)" /></span>
        </div>
        <button
          onClick={onNewGroup}
          title="Yeni grup oluştur"
          className="p-1.5 rounded-full text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/10 transition-colors"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DmPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<DmConversation[]>([])
  const [groups, setGroups] = useState<GroupConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Actor[]>([])
  const [searching, setSearching] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [dmTab, setDmTab] = useState<'inbox' | 'requests'>('inbox')
  const [requestingHandle, setRequestingHandle] = useState<string | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const load = useCallback(async (cursor?: string) => {
    try {
      const [dmData, groupData] = await Promise.all([
        api.dm.list(cursor),
        cursor ? Promise.resolve(null) : api.dm.listGroups(),
      ])
      if (cursor) setConversations((prev) => [...prev, ...dmData.conversations])
      else setConversations(dmData.conversations)
      setNextCursor(dmData.nextCursor)
      if (groupData) setGroups(groupData.conversations)
    } catch (err) {
      const error = err as { status?: number }
      if (error.status === 401) router.push('/login')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.search.query(searchQuery, 'actors')
        setSearchResults(data.actors.slice(0, 8))
      } catch {
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <DmHeader onNewGroup={() => setCreateGroupOpen(true)} />
        <DMListSkeleton />
      </div>
    )
  }

  async function handleAcceptRequest(handle: string) {
    setRequestingHandle(handle)
    try {
      await api.dm.acceptRequest(handle)
      setConversations((prev) =>
        prev.map((c) => c.partner.handle === handle ? { ...c, isRequest: false, requestAccepted: true } : c),
      )
    } finally { setRequestingHandle(null) }
  }

  async function handleDeclineRequest(handle: string) {
    setRequestingHandle(handle)
    try {
      await api.dm.declineRequest(handle)
      setConversations((prev) => prev.filter((c) => c.partner.handle !== handle))
    } finally { setRequestingHandle(null) }
  }

  const requestConvs = conversations.filter((c) => c.isRequest)
  const archivedConvs = conversations.filter((c) => !c.isRequest && c.archived)
  const inboxConvs = conversations.filter((c) => !c.isRequest && !c.archived)
  const allEmpty = conversations.length === 0 && groups.length === 0

  return (
    <div className="max-w-xl mx-auto">
      <DmHeader onNewGroup={() => setCreateGroupOpen(true)} />

      <CreateGroupDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={(g) => {
          setGroups((prev) => [g, ...prev])
          setCreateGroupOpen(false)
          router.push(`/dm/group/${g.id}`)
        }}
      />

      {/* Search / new conversation */}
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 rounded-full bg-(--color-background-secondary) px-3.5">
          <Search className="w-4 h-4 text-(--color-text-tertiary) flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kişi ara ve yeni mesaj başlat..."
            className="flex-1 bg-transparent outline-none border-0 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) py-2.5"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary) flex-shrink-0" />}
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 rounded-xl border border-(--color-border) overflow-hidden shadow-sm">
            {searchResults.map((actor) => (
              <Link
                key={actor.id}
                href={`/dm/${actor.handle}`}
                onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-background-secondary) transition-colors"
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
                  <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                    {(actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                  <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {allEmpty ? (
        <EmptyState
          icon={MessageSquare}
          title="Henüz mesajın yok"
          description="Yukarıdan birini arayarak uçtan uca şifreli mesaj gönder veya grup oluştur."
        />
      ) : requestConvs.length > 0 ? (
        <Tabs value={dmTab} onValueChange={(v) => setDmTab(v as 'inbox' | 'requests')}>
          <TabsList className="sticky top-[53px]">
            <TabsTrigger value="inbox">
              Gelen Kutusu
            </TabsTrigger>
            <TabsTrigger value="requests">
              İstekler
              <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums bg-(--color-coral)/15 text-(--color-coral)">
                {requestConvs.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <InboxContent
              groups={groups}
              inboxConvs={inboxConvs}
              archivedConvs={archivedConvs}
              archivedOpen={archivedOpen}
              onArchivedToggle={() => setArchivedOpen((v) => !v)}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadMore={() => { setLoadingMore(true); void load(nextCursor!) }}
            />
          </TabsContent>

          <TabsContent value="requests">
            <div className="px-5 py-3">
              <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
                Takip etmediğin kişilerden gelen mesajlar. Yanıtlarsan kabul etmiş sayılırsın.
              </p>
            </div>
            {requestConvs.map((conv) => (
              <RequestRow
                key={conv.partner.id}
                conv={conv}
                isActing={requestingHandle === conv.partner.handle}
                onAccept={(h) => void handleAcceptRequest(h)}
                onDecline={(h) => void handleDeclineRequest(h)}
              />
            ))}
          </TabsContent>
        </Tabs>
      ) : (
        <InboxContent
          groups={groups}
          inboxConvs={inboxConvs}
          archivedConvs={archivedConvs}
          archivedOpen={archivedOpen}
          onArchivedToggle={() => setArchivedOpen((v) => !v)}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={() => { setLoadingMore(true); void load(nextCursor!) }}
        />
      )}
    </div>
  )
}

// ── Inbox content (shared between tabbed and non-tabbed layouts) ──────────────

function InboxContent({
  groups,
  inboxConvs,
  archivedConvs,
  archivedOpen,
  onArchivedToggle,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  groups: GroupConversation[]
  inboxConvs: DmConversation[]
  archivedConvs: DmConversation[]
  archivedOpen: boolean
  onArchivedToggle: () => void
  nextCursor: string | null
  loadingMore: boolean
  onLoadMore: () => void
}) {
  return (
    <div className="pt-1.5">
      {groups.length > 0 && (
        <>
          <SectionHeader label="Gruplar" />
          {groups.map((group) => {
            const displayName = group.name ?? group.members.map((m) => m.displayName ?? m.handle).join(', ')
            return (
              <Link
                key={group.id}
                href={`/dm/group/${group.id}`}
                className="flex items-center gap-4 mx-2 px-3 py-3.5 rounded-xl hover:bg-(--color-background-secondary) active:scale-[0.99] transition-all group"
              >
                <GroupAvatar members={group.members} name={group.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[15px] font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors max-w-[65%]"
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {displayName}
                    </span>
                    {group.lastMessage && (
                      <span className="text-xs text-(--color-text-tertiary) flex-shrink-0 ml-2 tabular-nums">
                        {formatRelativeTime(group.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-(--color-text-tertiary) truncate leading-snug">
                    {group.lastMessage ? group.lastMessage.content || '📎 Medya' : `${group.members.length} üye`}
                  </p>
                </div>
              </Link>
            )
          })}
        </>
      )}

      {inboxConvs.length > 0 && (
        <>
          {groups.length > 0 && <SectionHeader label="Direkt mesajlar" />}
          {inboxConvs.map((conv) => <ConvRow key={conv.partner.id} conv={conv} />)}
        </>
      )}

      {archivedConvs.length > 0 && (
        <Collapsible open={archivedOpen} onOpenChange={onArchivedToggle}>
          <CollapsibleTrigger className="w-full flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-xs text-(--color-text-tertiary) hover:bg-(--color-background-secondary)/70 transition-colors mt-1">
            {archivedOpen
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
            <Archive className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium">Arşiv ({archivedConvs.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {archivedConvs.map((conv) => <ConvRow key={conv.partner.id} conv={conv} />)}
          </CollapsibleContent>
        </Collapsible>
      )}

      {nextCursor && (
        <div className="py-6 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="text-(--color-text-tertiary)"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla'}
          </Button>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-5 pt-4 pb-1">
      <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wider">{label}</span>
    </div>
  )
}
