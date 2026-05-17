'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type HalkaInfo } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mic, Users, Plus, X, Trash2, Radio } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

function HalkaCard({ halka, currentHandle, onDelete }: { halka: HalkaInfo; currentHandle?: string; onDelete?: (slug: string) => void }) {
  const [ending, setEnding] = useState(false)
  const isHost = currentHandle && halka.host.handle === currentHandle
  const initials = (halka.host.displayName ?? halka.host.handle).slice(0, 2).toUpperCase()

  async function handleEnd(e: React.MouseEvent) {
    e.preventDefault()
    if (!onDelete) return
    setEnding(true)
    try {
      await api.halka.end(halka.slug)
      onDelete(halka.slug)
    } catch { } finally { setEnding(false) }
  }

  return (
    <Link
      href={`/halka/${halka.slug}`}
      className="block px-4 py-4 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar className="w-10 h-10">
            {halka.host.avatarUrl && <AvatarImage src={halka.host.avatarUrl} />}
            <AvatarFallback className="text-sm font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {halka.isLive && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-(--color-background)" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-(--color-text-primary) truncate">{halka.title}</p>
            {halka.isLive && (
              <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                CANLI
              </span>
            )}
          </div>
          <p className="text-xs text-(--color-text-tertiary)">@{halka.host.handle}</p>
          {halka.description && (
            <p className="text-xs text-(--color-text-secondary) mt-0.5 line-clamp-1">{halka.description}</p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
              <Mic className="w-3 h-3" />
              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{halka.participantsCount} dinleyici</span>
            </div>
            {isHost && (
              <button
                onClick={handleEnd}
                disabled={ending}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {ending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Bitir
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function HalkaPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [halkas, setHalkas] = useState<HalkaInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const currentHandle = (session?.user as { handle?: string } | undefined)?.handle

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    api.halka.list().then((d) => setHalkas(d.spaces)).catch(() => {}).finally(() => setLoading(false))
  }, [isPending, session, router])

  async function createHalka() {
    if (!title.trim()) return
    setCreating(true)
    try {
      const halka = await api.halka.create({ title, description: desc || undefined })
      router.push(`/halka/${halka.slug}`)
    } catch { } finally { setCreating(false) }
  }

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Halka</h1>
          </div>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Canlı ses odaları</p>
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
            <Mic className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Halka
            </h1>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="bg-(--color-coral) text-white hover:opacity-90 gap-1.5"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'İptal' : 'Yeni Halka'}
          </Button>
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">Canlı ses odaları</p>
      </header>

      {showForm && (
        <div className="px-4 py-4 border-b border-(--color-border) bg-(--color-background-secondary) space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Halka başlığı"
            className="border-(--color-border) focus-visible:ring-(--color-coral)"
            onKeyDown={(e) => e.key === 'Enter' && void createHalka()}
            autoFocus
          />
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Açıklama (opsiyonel)"
            className="border-(--color-border) focus-visible:ring-(--color-coral)"
          />
          <Button
            disabled={creating || !title.trim()}
            onClick={createHalka}
            className="w-full bg-(--color-coral) text-white"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Başlat'}
          </Button>
        </div>
      )}

      {halkas.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Şu an canlı halka yok"
          description="Yeni bir halka başlatarak sesli toplantıya davet edebilirsin."
        />
      ) : (
        halkas.map((h) => (
          <HalkaCard
            key={h.id}
            halka={h}
            currentHandle={currentHandle}
            onDelete={(slug) => setHalkas((prev) => prev.filter((x) => x.slug !== slug))}
          />
        ))
      )}
    </div>
  )
}
