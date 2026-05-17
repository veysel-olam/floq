'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Loader2, Search, PenSquare, Lock, Users, Plus, X, Check } from 'lucide-react'
import { DMListSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useSession } from '@/lib/auth-client'
import { api, type DmConversation, type GroupConversation, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins}d`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}s`
  return `${Math.floor(hours / 24)}g`
}

function GroupAvatar({ members, name }: { members: { handle: string; displayName: string | null; avatarUrl: string | null }[]; name: string | null }) {
  const initials = (name ?? members.map((m) => m.displayName ?? m.handle).join(', ')).slice(0, 2).toUpperCase()
  const shown = members.slice(0, 3)
  if (shown.length === 0) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-(--color-coral)/20 text-(--color-coral) flex-shrink-0">
        <Users className="w-5 h-5" />
      </div>
    )
  }
  return (
    <div className="w-11 h-11 relative flex-shrink-0">
      {shown.length === 1 ? (
        <Avatar className="w-11 h-11">
          {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
          <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>{initials}</AvatarFallback>
        </Avatar>
      ) : shown.length === 2 ? (
        <>
          <Avatar className="w-7 h-7 absolute top-0 left-0">
            {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>{(shown[0]!.displayName ?? shown[0]!.handle).slice(0,1)}</AvatarFallback>
          </Avatar>
          <Avatar className="w-7 h-7 absolute bottom-0 right-0 ring-2 ring-(--color-background)">
            {shown[1]!.avatarUrl && <AvatarImage src={shown[1]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>{(shown[1]!.displayName ?? shown[1]!.handle).slice(0,1)}</AvatarFallback>
          </Avatar>
        </>
      ) : (
        <>
          <Avatar className="w-6 h-6 absolute top-0 left-1">
            {shown[0]!.avatarUrl && <AvatarImage src={shown[0]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'var(--gradient-avatar)' }}>{(shown[0]!.displayName ?? shown[0]!.handle).slice(0,1)}</AvatarFallback>
          </Avatar>
          <Avatar className="w-6 h-6 absolute top-0 right-1">
            {shown[1]!.avatarUrl && <AvatarImage src={shown[1]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'linear-gradient(135deg,#2A9D8F,#3BB5A5)' }}>{(shown[1]!.displayName ?? shown[1]!.handle).slice(0,1)}</AvatarFallback>
          </Avatar>
          <Avatar className="w-6 h-6 absolute bottom-0 left-1/2 -translate-x-1/2 ring-2 ring-(--color-background)">
            {shown[2]!.avatarUrl && <AvatarImage src={shown[2]!.avatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] text-white" style={{ background: 'linear-gradient(135deg,#264653,#2A9D8F)' }}>{(shown[2]!.displayName ?? shown[2]!.handle).slice(0,1)}</AvatarFallback>
          </Avatar>
        </>
      )}
    </div>
  )
}

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (g: GroupConversation) => void }) {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-(--color-background) rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
          <h2 className="font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Yeni grup</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grup adı (isteğe bağlı)"
            className="text-sm"
          />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--color-text-tertiary)" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Üye ekle..."
              className="pl-8 text-sm"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-(--color-text-tertiary)" />}
          </div>

          {results.length > 0 && (
            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              {results.map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => { setSelected((prev) => [...prev, actor]); setQuery(''); setResults([]) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-(--color-background-secondary) transition-colors text-left"
                >
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                      {(actor.displayName ?? actor.handle).slice(0,2).toUpperCase()}
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
                <span key={actor.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-(--color-coral)/10 text-(--color-coral) text-xs border border-(--color-coral)/20">
                  @{actor.handle}
                  <button onClick={() => setSelected((prev) => prev.filter((a) => a.id !== actor.id))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="w-full bg-(--color-coral) hover:bg-(--color-coral)/90 text-white rounded-xl"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" />Grup oluştur ({selected.length} üye)</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

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

  const requestConvs = conversations.filter((c) => c.isRequest)
  const inboxConvs = conversations.filter((c) => !c.isRequest)
  const allEmpty = conversations.length === 0 && groups.length === 0

  return (
    <div className="max-w-xl mx-auto">
      <DmHeader onNewGroup={() => setCreateGroupOpen(true)} />

      {createGroupOpen && (
        <CreateGroupModal
          onClose={() => setCreateGroupOpen(false)}
          onCreate={(g) => { setGroups((prev) => [g, ...prev]); setCreateGroupOpen(false); router.push(`/dm/group/${g.id}`) }}
        />
      )}

      {/* New conversation search */}
      <div className="px-4 py-3 border-b border-(--color-border-secondary)">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary)" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kişi ara ve yeni mesaj başlat..."
            className="pl-9 rounded-full bg-(--color-background-secondary) border-0 focus-visible:ring-1 focus-visible:ring-(--color-coral) text-sm"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-(--color-text-tertiary)" />}
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                  <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                </div>
                <PenSquare className="w-4 h-4 text-(--color-text-tertiary) ml-auto flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Inbox / Requests tabs */}
      {requestConvs.length > 0 && (
        <div className="flex border-b border-(--color-border)">
          {([{ id: 'inbox', label: 'Gelen Kutusu', count: inboxConvs.length + groups.length }, { id: 'requests', label: 'İstekler', count: requestConvs.length }] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setDmTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative',
                dmTab === t.id ? 'text-(--color-coral)' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full tabular-nums', dmTab === t.id ? 'bg-(--color-coral) text-white' : 'bg-(--color-background-secondary) text-(--color-text-tertiary)')}>
                  {t.count}
                </span>
              )}
              {dmTab === t.id && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-(--color-coral)" />}
            </button>
          ))}
        </div>
      )}

      {allEmpty ? (
        <EmptyState
          icon={MessageSquare}
          title="Henüz mesajın yok"
          description="Yukarıdan birini arayarak uçtan uca şifreli mesaj gönder veya grup oluştur."
        />
      ) : dmTab === 'requests' ? (
        <div className="divide-y divide-(--color-border-secondary)">
          <div className="px-4 py-3 bg-(--color-background-secondary)/40">
            <p className="text-xs text-(--color-text-tertiary)">Takip etmediğin kişilerden gelen mesajlar. Yanıtlarsan kabul etmiş sayılırsın.</p>
          </div>
          {requestConvs.map(({ partner, lastMessage }) => (
            <Link
              key={partner.id}
              href={`/dm/${partner.handle}`}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/70 transition-colors group"
            >
              <Avatar className="w-11 h-11 flex-shrink-0">
                {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                  {(partner.displayName ?? partner.handle).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {partner.displayName ?? partner.handle}
                  </span>
                  <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0 ml-2">{formatRelativeTime(lastMessage.createdAt)}</span>
                </div>
                <p className="text-xs text-(--color-text-tertiary) truncate">{lastMessage.content || '📎 Medya'}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {/* Group conversations */}
          {groups.length > 0 && (
            <>
              <div className="px-4 py-2 flex items-center gap-1.5 border-b border-(--color-border-secondary)">
                <Users className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                <span className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Gruplar</span>
              </div>
              {groups.map((group) => {
                const displayName = group.name ?? group.members.map((m) => m.displayName ?? m.handle).join(', ')
                return (
                  <Link
                    key={group.id}
                    href={`/dm/group/${group.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/70 transition-colors group"
                  >
                    <GroupAvatar members={group.members} name={group.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors max-w-[65%]" style={{ fontFamily: 'var(--font-outfit)' }}>
                          {displayName}
                        </span>
                        {group.lastMessage && (
                          <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0 ml-2 tabular-nums">
                            {formatRelativeTime(group.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-(--color-text-tertiary) truncate">
                        {group.lastMessage ? group.lastMessage.content || '📎 Medya' : `${group.members.length} üye`}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </>
          )}

          {/* 1-1 DMs */}
          {inboxConvs.length > 0 && (
            <>
              {groups.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-1.5 border-b border-(--color-border-secondary)">
                  <MessageSquare className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                  <span className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Direkt mesajlar</span>
                </div>
              )}
              {inboxConvs.map(({ partner, lastMessage }) => {
                const isEncrypted = !!lastMessage.encryptedContent
                return (
                  <Link
                    key={partner.id}
                    href={`/dm/${partner.handle}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/70 transition-colors group"
                  >
                    <Avatar className="w-11 h-11 flex-shrink-0">
                      {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.displayName ?? partner.handle} />}
                      <AvatarFallback className="text-sm font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
                        {(partner.displayName ?? partner.handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors" style={{ fontFamily: 'var(--font-outfit)' }}>
                            {partner.displayName ?? partner.handle}
                          </span>
                          {isEncrypted && (
                            <span title="Uçtan uca şifreli">
                              <Lock className="w-3 h-3 text-(--color-teal) flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0 ml-2 tabular-nums">
                          {formatRelativeTime(lastMessage.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-(--color-text-tertiary) truncate">
                        {lastMessage.authorId !== partner.id && <span className="text-(--color-text-secondary) font-medium">Sen: </span>}
                        {isEncrypted ? (
                          <span className="flex items-center gap-1 inline-flex">
                            <Lock className="w-2.5 h-2.5" />
                            Şifreli mesaj
                          </span>
                        ) : lastMessage.content}
                      </p>
                    </div>
                  </Link>
                )
              })}
              {nextCursor && (
                <div className="py-6 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => { setLoadingMore(true); void load(nextCursor) }}
                    className="text-(--color-text-tertiary)"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function DmHeader({ onNewGroup }: { onNewGroup: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Mesajlar
          </h1>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-(--color-teal) bg-(--color-teal)/8 px-1.5 py-0.5 rounded-full">
            <Lock className="w-2.5 h-2.5" /> E2E
          </span>
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
