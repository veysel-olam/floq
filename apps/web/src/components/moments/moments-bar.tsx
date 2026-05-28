'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import { api, type MomentGroup } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Plus, X, Clock, Camera } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (!expiresAt || isNaN(ms)) return ''
  if (ms <= 0) return 'süresi doldu'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}sa ${m}dk` : `${m}dk`
}

// ─── Canvas export ────────────────────────────────────────────────────────────

async function applyFilterAndExport(imgEl: HTMLImageElement, filter: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imgEl.naturalWidth
  canvas.height = imgEl.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.filter = filter || 'none'
  ctx.drawImage(imgEl, 0, 0)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92))
}

// ─── Filter definitions ───────────────────────────────────────────────────────

type FilterDef = { label: string; css: string }

const FILTERS: FilterDef[] = [
  { label: 'Normal', css: '' },
  { label: 'Siyah-Beyaz', css: 'grayscale(100%)' },
  { label: 'Sıcak', css: 'saturate(130%) sepia(20%)' },
  { label: 'Soğuk', css: 'saturate(90%) hue-rotate(15deg)' },
  { label: 'Soluk', css: 'contrast(85%) brightness(110%)' },
]

// ─── MomentViewer ─────────────────────────────────────────────────────────────

function MomentViewer({
  group,
  onClose,
}: {
  group: MomentGroup
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const moment = group.moments[idx]
  const hasImage = moment?.media && moment.media.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden bg-(--color-background) shadow-2xl"
        style={{ aspectRatio: '9/16', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-bleed image background */}
        {hasImage && (
          <img
            src={moment!.media![0]!.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Overlay gradient for readability when image is present */}
        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        )}

        {/* Progress bars */}
        <div className="flex gap-1 p-3 absolute top-0 left-0 right-0 z-10">
          {group.moments.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-0.5 rounded-full',
                i < idx
                  ? 'bg-white'
                  : i === idx
                    ? 'bg-white/80'
                    : 'bg-white/30',
              )}
            />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 p-4 pt-7 relative z-10">
          <Avatar className="w-8 h-8 flex-shrink-0">
            {group.actor.avatarUrl && <AvatarImage src={group.actor.avatarUrl} alt={group.actor.handle} />}
            <AvatarFallback
              className="text-xs text-white"
              style={{ background: 'var(--gradient-avatar)' }}
            >
              {(group.actor.displayName ?? group.actor.handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', hasImage ? 'text-white' : 'text-(--color-text-primary)')}>
              {group.actor.displayName ?? group.actor.handle}
            </p>
            <p className={cn('text-xs flex items-center gap-1', hasImage ? 'text-white/70' : 'text-(--color-text-tertiary)')}>
              <Clock className="w-3 h-3" />
              {moment ? timeLeft(moment.expiresAt) : ''}
            </p>
          </div>
          <button onClick={onClose} className={cn(hasImage ? 'text-white/70 hover:text-white' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — text only card if no image, overlaid pill if image */}
        {hasImage ? (
          moment?.content?.trim() ? (
            <div className="absolute bottom-4 left-4 right-4 z-10 bg-black/60 rounded-xl px-3 py-2">
              <p className="text-white text-sm leading-relaxed">{moment.content}</p>
            </div>
          ) : null
        ) : (
          <div className="px-4 pb-6 min-h-[200px] flex items-center">
            <p className="text-(--color-text-primary) text-base leading-relaxed">
              {moment?.content}
            </p>
          </div>
        )}

        {/* Navigation — invisible tap zones */}
        <div className="flex absolute inset-0 top-16 z-20">
          <button
            className="flex-1"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          />
          <button
            className="flex-1"
            onClick={() => {
              if (idx < group.moments.length - 1) setIdx((i) => i + 1)
              else onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────

function ComposeModal({
  onClose,
  onPosted,
}: {
  onClose: () => void
  onPosted: () => void
}) {
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterDef>(FILTERS[0]!)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
    setActiveFilter(FILTERS[0]!)
  }, [previewUrl])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  async function handleSubmit() {
    if (!content.trim() && !selectedFile) return
    setPosting(true)
    try {
      let mediaId: string | undefined

      if (selectedFile && imgRef.current) {
        setUploading(true)
        // Apply the selected filter via canvas and export as a new blob
        const blob = await applyFilterAndExport(imgRef.current, activeFilter.css)
        const filteredFile = new File([blob], selectedFile.name, { type: 'image/jpeg' })
        const uploaded = await api.media.upload(filteredFile)
        mediaId = uploaded.id
        setUploading(false)
      }

      await api.moments.create(content.trim(), mediaId)
      onPosted()
    } catch {
      // ignore
    } finally {
      setPosting(false)
      setUploading(false)
    }
  }

  const canSubmit = !posting && !uploading && (content.trim().length > 0 || !!selectedFile)

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 mb-8 rounded-2xl bg-(--color-background) shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
          <p className="text-sm font-semibold text-(--color-text-primary)">Yeni Moment</p>
          <button onClick={onClose} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Single hidden file input, always present */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="p-4 space-y-3">
          {/* Image upload / drop zone */}
          {!selectedFile ? (
            <div
              className={cn(
                'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer',
                'min-h-[180px]',
                dragOver
                  ? 'border-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12'
                  : 'border-(--color-border) hover:border-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Camera className="w-8 h-8 text-(--color-text-tertiary) mb-2" />
              <p className="text-sm text-(--color-text-tertiary) font-medium">Fotoğraf ekle</p>
              <p className="text-xs text-(--color-text-tertiary) mt-1">tıkla veya sürükle-bırak</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Image preview with filter applied via CSS */}
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '9/16', maxWidth: 320, margin: '0 auto' }}>
                <img
                  ref={imgRef}
                  src={previewUrl!}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{ filter: activeFilter.css || undefined }}
                  crossOrigin="anonymous"
                />
                {/* Remove image button */}
                <button
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                    setSelectedFile(null)
                    setActiveFilter(FILTERS[0]!)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>

              {/* Filter row */}
              <div>
                <p className="text-xs text-(--color-text-tertiary) font-medium mb-1.5">Filtreler</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {FILTERS.map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setActiveFilter(f)}
                      className="flex-shrink-0 flex flex-col items-center gap-1"
                    >
                      <div
                        className={cn(
                          'w-12 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                          activeFilter.label === f.label
                            ? 'border-(--color-coral)'
                            : 'border-transparent hover:border-(--color-border)',
                        )}
                      >
                        <img
                          src={previewUrl!}
                          alt={f.label}
                          className="w-full h-full object-cover"
                          style={{ filter: f.css || undefined }}
                        />
                      </div>
                      <span className={cn(
                        'text-[9px] font-medium',
                        activeFilter.label === f.label
                          ? 'text-(--color-coral)'
                          : 'text-(--color-text-tertiary)',
                      )}>
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Caption textarea */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={selectedFile ? '24 saat sonra kaybolacak bir başlık ekle...' : '24 saat sonra kaybolacak...'}
            className="resize-none h-20 text-sm"
            maxLength={500}
          />

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={posting}>
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
            >
              {uploading ? 'Yükleniyor...' : posting ? 'Paylaşılıyor...' : 'Paylaş'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MomentsBar ───────────────────────────────────────────────────────────────

export function MomentsBar() {
  const { data: session } = useSession()
  const [groups, setGroups] = useState<MomentGroup[]>([])
  const [viewing, setViewing] = useState<MomentGroup | null>(null)
  const [composing, setComposing] = useState(false)

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.moments.list()
      setGroups(data.groups)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!session) return
    loadGroups()
  }, [session, loadGroups])

  if (!session) return null

  return (
    <>
      {viewing && (
        <MomentViewer group={viewing} onClose={() => setViewing(null)} />
      )}

      {composing && (
        <ComposeModal
          onClose={() => setComposing(false)}
          onPosted={async () => {
            setComposing(false)
            await loadGroups()
          }}
        />
      )}

      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto scrollbar-none border-b border-(--color-border)">
        {/* Add moment button */}
        <button
          onClick={() => setComposing(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-(--color-border) flex items-center justify-center hover:border-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12 transition-colors">
            <Plus className="w-5 h-5 text-(--color-text-tertiary)" />
          </div>
          <span className="text-[10px] text-(--color-text-tertiary)">Ekle</span>
        </button>

        {groups.map((group) => (
          <button
            key={group.actor.id}
            onClick={() => setViewing(group)}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-(--color-coral) to-(--color-peach)">
              <Avatar className="w-full h-full">
                {group.actor.avatarUrl && <AvatarImage src={group.actor.avatarUrl} alt={group.actor.handle} />}
                <AvatarFallback
                  className="text-xs text-white"
                  style={{ background: 'var(--gradient-avatar)' }}
                >
                  {(group.actor.displayName ?? group.actor.handle).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] text-(--color-text-tertiary) max-w-[48px] truncate">
              {group.actor.handle}
            </span>
          </button>
        ))}

        {groups.length === 0 && (
          <p className="text-xs text-(--color-text-tertiary) ml-1">
            Takip ettiğin kişilerin momentleri burada görünür.
          </p>
        )}
      </div>
    </>
  )
}
