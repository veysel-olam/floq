'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type Actor, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Users, Plus, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ListPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [listTitle, setListTitle] = useState('')
  const [members, setMembers] = useState<Actor[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'members'>('timeline')

  // Add member
  const [addHandle, setAddHandle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    try {
      const [membersData, timelineData] = await Promise.all([
        api.lists.members(id),
        api.lists.timeline(id),
      ])
      setListTitle(membersData.list.title)
      setMembers(membersData.members)
      setPosts(timelineData.posts)
      setNextCursor(timelineData.nextCursor)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load()
  }, [isPending, session, load, router])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const data = await api.lists.timeline(id, nextCursor)
      setPosts((prev) => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoadingMore(false)
    }
  }

  async function addMember() {
    if (!addHandle.trim()) return
    setAdding(true)
    setAddError('')
    try {
      await api.lists.addMember(id, addHandle.trim().replace(/^@/, ''))
      // Refresh members
      const data = await api.lists.members(id)
      setMembers(data.members)
      setAddHandle('')
    } catch (err) {
      setAddError((err as { message?: string }).message ?? 'Hata oluştu')
    } finally {
      setAdding(false)
    }
  }

  async function removeMember(actorId: string) {
    await api.lists.removeMember(id, actorId)
    setMembers((prev) => prev.filter((m) => m.id !== actorId))
  }

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/lists" className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            {listTitle}
          </h1>
        </div>
        <div className="flex gap-1">
          {(['timeline', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/10'
                  : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)'
              }`}
            >
              {tab === 'timeline' ? 'Akış' : `Üyeler (${members.length})`}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'timeline' && (
        <>
          {posts.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-(--color-background-secondary) flex items-center justify-center">
                <Users className="w-6 h-6 text-(--color-text-tertiary)" />
              </div>
              <p className="text-sm font-semibold text-(--color-text-primary)">
                {members.length === 0 ? 'Liste boş' : 'Henüz gönderi yok'}
              </p>
              <p className="text-xs text-(--color-text-tertiary) max-w-xs leading-relaxed">
                {members.length === 0
                  ? 'Üyeler sekmesinden takip ettiğin kişileri ekle, gönderileri burada görünür.'
                  : 'Liste üyeleri gönderi paylaştıkça burada görünecek.'}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {nextCursor && (
                <div className="py-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="text-(--color-text-tertiary)"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla yükle'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'members' && (
        <div>
          <div className="px-4 py-3 border-b border-(--color-border-secondary)">
            <p className="text-xs text-(--color-text-tertiary) mb-2">
              Takip ettiğin kişileri ekleyebilirsin.
            </p>
            <div className="flex gap-2">
              <Input
                value={addHandle}
                onChange={(e) => setAddHandle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addMember() }}
                placeholder="@kullanıcıadı"
                className="flex-1 h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={() => void addMember()}
                disabled={adding || !addHandle.trim()}
                className="bg-(--color-coral) hover:bg-(--color-peach) text-white h-8"
              >
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
          </div>

          {members.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-(--color-background-secondary) flex items-center justify-center">
                <Users className="w-6 h-6 text-(--color-text-tertiary)" />
              </div>
              <p className="text-sm font-semibold text-(--color-text-primary)">Henüz üye yok</p>
              <p className="text-xs text-(--color-text-tertiary) max-w-xs">Yukarıdaki alandan @kullanıcıadı girerek üye ekleyebilirsin.</p>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) transition-colors"
              >
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.displayName ?? member.handle} />}
                  <AvatarFallback
                    className="text-xs font-semibold text-white"
                    style={{ background: 'var(--gradient-avatar)' }}
                  >
                    {(member.displayName ?? member.handle).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">
                    {member.displayName ?? member.handle}
                  </p>
                  <p className="text-xs text-(--color-text-tertiary)">@{member.handle}</p>
                </div>
                <button
                  onClick={() => void removeMember(member.id)}
                  className="text-(--color-text-tertiary) hover:text-red-500 p-1.5 rounded-lg hover:bg-(--color-background-secondary)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
