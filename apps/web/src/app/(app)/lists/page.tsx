'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type ListInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Loader2, List, Plus, Pencil, Trash2, ChevronRight, Check, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

function ListRow({
  list,
  onDelete,
  onRename,
}: {
  list: ListInfo
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim() || title === list.title) { setEditing(false); return }
    setSaving(true)
    try {
      await onRename(list.id, title)
      setEditing(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) group">
      <List className="w-4 h-4 text-(--color-text-tertiary) flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
              className="h-7 text-sm py-0"
              autoFocus
            />
            <button onClick={() => void save()} disabled={saving} className="text-green-600 hover:text-green-700">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { setEditing(false); setTitle(list.title) }} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link href={`/lists/${list.id}`} className="block">
            <p className="text-sm font-medium text-(--color-text-primary) truncate">{list.title}</p>
            <p className="text-xs text-(--color-text-tertiary)">{list.memberCount} üye</p>
          </Link>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(list.id)}
            className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-(--color-background)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-(--color-text-tertiary) ml-1" />
        </div>
      )}
    </div>
  )
}

export default function ListsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [userLists, setUserLists] = useState<ListInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.lists.list()
      setUserLists(data.lists)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load()
  }, [isPending, session, load, router])

  async function create() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const list = await api.lists.create(newTitle)
      setUserLists((prev) => [{ ...list, memberCount: 0 }, ...prev])
      setNewTitle('')
      setCreating(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await api.lists.delete(id)
    setUserLists((prev) => prev.filter((l) => l.id !== id))
  }

  async function handleRename(id: string, title: string) {
    await api.lists.update(id, title)
    setUserLists((prev) => prev.map((l) => l.id === id ? { ...l, title } : l))
  }

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-(--color-coral)" />
              <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Listelerim</h1>
            </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Listelerim
            </h1>
          </div>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-(--color-coral) hover:bg-(--color-peach) text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Liste
          </Button>
        </div>
      </header>

      {creating && (
        <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-background-secondary) flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Liste adı…"
            autoFocus
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => void create()}
            disabled={saving || !newTitle.trim()}
            className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Oluştur'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewTitle('') }}>
            İptal
          </Button>
        </div>
      )}

      {userLists.length === 0 ? (
        <EmptyState
          icon={List}
          title="Henüz liste yok"
          description="Listeler, seçtiğin hesapların gönderilerini ayrı bir akışta toplar."
        />
      ) : (
        userLists.map((list) => (
          <ListRow
            key={list.id}
            list={list}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        ))
      )}
    </div>
  )
}
