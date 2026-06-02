'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import { api, type MomentGroup } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Plus, X, Clock, Camera, Heart, Send, Flag, Trash2,
  Volume2, VolumeX, SlidersHorizontal, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

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

// ─── Manual adjustments (Instagram-style sliders) ───────────────────────────────

type Adjust = { brightness: number; contrast: number; saturate: number; warmth: number }
const DEFAULT_ADJUST: Adjust = { brightness: 1, contrast: 1, saturate: 1, warmth: 0 }

const ADJUST_CONTROLS: { key: keyof Adjust; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Parlaklık', min: 0.5, max: 1.5, step: 0.01 },
  { key: 'contrast', label: 'Kontrast', min: 0.5, max: 1.5, step: 0.01 },
  { key: 'saturate', label: 'Doygunluk', min: 0, max: 2, step: 0.01 },
  { key: 'warmth', label: 'Sıcaklık', min: -100, max: 100, step: 1 },
]

// Warmth: positive → warm (sepia), negative → cool (hue shift)
function warmthCss(w: number): string {
  if (w > 0) return `sepia(${w}%)`
  if (w < 0) return `hue-rotate(${w * 0.3}deg) saturate(${1 + -w / 250})`
  return ''
}

// Combine a preset filter with the manual adjustment sliders into one CSS string
function buildFilterCss(base: string, adj: Adjust): string {
  return [
    base,
    `brightness(${adj.brightness})`,
    `contrast(${adj.contrast})`,
    `saturate(${adj.saturate})`,
    warmthCss(adj.warmth),
  ].filter(Boolean).join(' ').trim()
}

function isVideoMedia(m?: { mimeType?: string; url: string } | null): boolean {
  if (!m) return false
  if (m.mimeType?.startsWith('video/')) return true
  return /\.(mp4|webm|mov|m4v|mkv)$/i.test(m.url)
}

// ─── Report ─────────────────────────────────────────────────────────────────────

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Taciz / zorbalık' },
  { value: 'hate_speech', label: 'Nefret söylemi' },
  { value: 'nsfw', label: 'Uygunsuz / +18' },
  { value: 'violence', label: 'Şiddet' },
  { value: 'csam', label: 'Çocuk istismarı' },
  { value: 'other', label: 'Diğer' },
]

// ─── MomentViewer ─────────────────────────────────────────────────────────────

function MomentViewer({
  group,
  currentHandle,
  onClose,
  onDeleted,
}: {
  group: MomentGroup
  currentHandle?: string
  onClose: () => void
  onDeleted?: (id: string) => void
}) {
  const [idx, setIdx] = useState(0)
  const moment = group.moments[idx]
  const media = moment?.media?.[0]
  const hasMedia = !!media
  const video = isVideoMedia(media)
  const isOwn = !!currentHandle && group.actor.handle === currentHandle

  // Per-moment like state, seeded from the server payload
  const [likeState, setLikeState] = useState<Record<string, { liked: boolean; count: number }>>(
    () => Object.fromEntries(group.moments.map((m) => [m.id, { liked: m.viewerLiked, count: m.likesCount }])),
  )
  const like = moment ? likeState[moment.id] : undefined

  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [muted, setMuted] = useState(true)

  // Reset transient UI when moving between moments
  useEffect(() => { setReply(''); setReportOpen(false) }, [idx])

  async function toggleLike() {
    if (!moment) return
    const cur = likeState[moment.id] ?? { liked: false, count: 0 }
    const next = { liked: !cur.liked, count: cur.count + (cur.liked ? -1 : 1) }
    setLikeState((s) => ({ ...s, [moment.id]: next }))
    try {
      if (next.liked) await api.posts.like(moment.id)
      else await api.posts.unlike(moment.id)
    } catch {
      setLikeState((s) => ({ ...s, [moment.id]: cur })) // revert
      toast.error('Beğeni gönderilemedi')
    }
  }

  async function sendReply() {
    const text = reply.trim()
    if (!text || !moment || sending) return
    setSending(true)
    try {
      // Instagram-style: a private reply lands in the author's DMs, referencing the moment.
      await api.dm.send(group.actor.handle, `↩️ Moment yanıtı: ${text}`)
      setReply('')
      toast.success('Yanıtın gönderildi')
    } catch {
      toast.error('Yanıt gönderilemedi')
    } finally {
      setSending(false)
    }
  }

  async function submitReport(reason: string) {
    if (!moment || reporting) return
    setReporting(true)
    try {
      await api.reports.submit({ postId: moment.id, reason })
      setReportOpen(false)
      toast.success('Rapor alındı, teşekkürler')
    } catch (err) {
      const msg = (err as { message?: string }).message
      toast.error(msg === 'Already reported' ? 'Bu momenti zaten raporladın' : 'Rapor gönderilemedi')
    } finally {
      setReporting(false)
    }
  }

  async function deleteOwn() {
    if (!moment || !isOwn) return
    if (!confirm('Bu momenti silmek istediğine emin misin?')) return
    try {
      await api.moments.delete(moment.id)
      toast.success('Moment silindi')
      onDeleted?.(moment.id)
      onClose()
    } catch {
      toast.error('Silinemedi')
    }
  }

  const dark = hasMedia // media present → light text on dark imagery

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden bg-(--color-background) shadow-2xl"
        style={{ aspectRatio: '9/16', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-bleed media background */}
        {hasMedia && (video ? (
          <video
            key={media!.url}
            src={media!.url}
            poster={media!.previewUrl ?? undefined}
            autoPlay
            loop
            playsInline
            muted={muted}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={media!.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ))}

        {/* Overlay gradient for readability when media is present */}
        {hasMedia && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        )}

        {/* Progress bars */}
        <div className="flex gap-1 p-3 absolute top-0 left-0 right-0 z-30">
          {group.moments.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-0.5 rounded-full',
                i < idx ? 'bg-white' : i === idx ? 'bg-white/80' : 'bg-white/30',
              )}
            />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 p-4 pt-7 relative z-30">
          <Avatar className="w-8 h-8 flex-shrink-0">
            {group.actor.avatarUrl && <AvatarImage src={group.actor.avatarUrl} alt={group.actor.handle} />}
            <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(group.actor.displayName ?? group.actor.handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', dark ? 'text-white' : 'text-(--color-text-primary)')}>
              {group.actor.displayName ?? group.actor.handle}
            </p>
            <p className={cn('text-xs flex items-center gap-1', dark ? 'text-white/70' : 'text-(--color-text-tertiary)')}>
              <Clock className="w-3 h-3" />
              {moment ? timeLeft(moment.expiresAt) : ''}
            </p>
          </div>
          {video && (
            <button
              onClick={() => setMuted((m) => !m)}
              className={cn('p-1', dark ? 'text-white/80 hover:text-white' : 'text-(--color-text-tertiary)')}
              aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          {isOwn && (
            <button onClick={deleteOwn} className={cn('p-1', dark ? 'text-white/80 hover:text-white' : 'text-(--color-text-tertiary) hover:text-red-500')} aria-label="Sil">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className={cn('p-1', dark ? 'text-white/80 hover:text-white' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caption — overlaid pill if media, plain card if text-only */}
        {hasMedia ? (
          moment?.content?.trim() ? (
            <div className="absolute bottom-[68px] left-4 right-4 z-30 bg-black/60 rounded-xl px-3 py-2">
              <p className="text-white text-sm leading-relaxed">{moment.content}</p>
            </div>
          ) : null
        ) : (
          <div className="px-4 pb-6 min-h-[200px] flex items-center">
            <p className="text-(--color-text-primary) text-base leading-relaxed">{moment?.content}</p>
          </div>
        )}

        {/* Navigation — invisible tap zones (kept clear of header & footer) */}
        <div className="flex absolute inset-x-0 top-16 bottom-16 z-20">
          <button className="flex-1" aria-label="Önceki" onClick={() => setIdx((i) => Math.max(0, i - 1))} />
          <button
            className="flex-1"
            aria-label="Sonraki"
            onClick={() => {
              if (idx < group.moments.length - 1) setIdx((i) => i + 1)
              else onClose()
            }}
          />
        </div>

        {/* Report reason sheet */}
        {reportOpen && (
          <div className="absolute inset-0 z-40 flex items-end bg-black/50" onClick={() => setReportOpen(false)}>
            <div className="w-full bg-(--color-background) rounded-t-2xl p-3 space-y-1" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-(--color-text-primary) px-2 py-1.5">Neden raporluyorsun?</p>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  disabled={reporting}
                  onClick={() => submitReport(r.value)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-(--color-text-secondary) hover:bg-(--color-background-secondary) disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer action bar */}
        <div className="absolute bottom-0 inset-x-0 z-30 flex items-center gap-2 p-3">
          {isOwn ? (
            <p className={cn('flex-1 text-center text-xs', dark ? 'text-white/70' : 'text-(--color-text-tertiary)')}>
              Bu senin momentin · {like?.count ?? 0} beğeni
            </p>
          ) : (
            <>
              <div className={cn('flex-1 flex items-center gap-2 rounded-full px-3 h-9', dark ? 'bg-white/15 backdrop-blur-sm' : 'bg-(--color-background-secondary)')}>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void sendReply() }}
                  placeholder="Yanıt gönder..."
                  className={cn('flex-1 bg-transparent border-0 outline-none text-sm', dark ? 'text-white placeholder:text-white/60' : 'text-(--color-text-primary) placeholder:text-(--color-text-tertiary)')}
                />
                {reply.trim() && (
                  <button onClick={sendReply} disabled={sending} className={cn('flex-shrink-0', dark ? 'text-white' : 'text-(--color-coral)')}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <button onClick={toggleLike} className="flex-shrink-0 flex flex-col items-center" aria-label="Beğen">
                <Heart className={cn('w-6 h-6 transition-colors', like?.liked ? 'fill-(--color-coral) text-(--color-coral)' : dark ? 'text-white' : 'text-(--color-text-secondary)')} />
              </button>
              <button onClick={() => setReportOpen(true)} className={cn('flex-shrink-0 p-1', dark ? 'text-white/80 hover:text-white' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)')} aria-label="Raporla">
                <Flag className="w-5 h-5" />
              </button>
            </>
          )}
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
  const [isVideo, setIsVideo] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterDef>(FILTERS[0]!)
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST)
  const [showAdjust, setShowAdjust] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live CSS filter: preset + manual adjustments, shared by preview and export
  const combinedFilter = buildFilterCss(activeFilter.css, adjust)

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((file: File) => {
    const video = file.type.startsWith('video/')
    if (!file.type.startsWith('image/') && !video) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
    setIsVideo(video)
    setActiveFilter(FILTERS[0]!)
    setAdjust(DEFAULT_ADJUST)
    setShowAdjust(false)
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

      if (selectedFile) {
        setUploading(true)
        if (isVideo) {
          const uploaded = await api.media.uploadVideo(selectedFile)
          mediaId = uploaded.id
        } else if (imgRef.current) {
          // Bake the preset filter + manual adjustments into the image via canvas
          const blob = await applyFilterAndExport(imgRef.current, combinedFilter)
          const filteredFile = new File([blob], selectedFile.name, { type: 'image/jpeg' })
          const uploaded = await api.media.upload(filteredFile)
          mediaId = uploaded.id
        }
        setUploading(false)
      }

      await api.moments.create(content.trim(), mediaId)
      onPosted()
    } catch {
      toast.error('Moment paylaşılamadı')
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
          accept="image/*,video/*"
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
              <p className="text-sm text-(--color-text-tertiary) font-medium">Fotoğraf veya video ekle</p>
              <p className="text-xs text-(--color-text-tertiary) mt-1">tıkla veya sürükle-bırak · dikey en iyi sonucu verir</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Preview — video plays inline, image shows live filter/adjustments */}
              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxWidth: 320, margin: '0 auto' }}>
                {isVideo ? (
                  <video
                    src={previewUrl!}
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                    loop
                  />
                ) : (
                  <img
                    ref={imgRef}
                    src={previewUrl!}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    style={{ filter: combinedFilter || undefined }}
                    crossOrigin="anonymous"
                  />
                )}
                {/* Remove media button */}
                <button
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                    setSelectedFile(null)
                    setIsVideo(false)
                    setActiveFilter(FILTERS[0]!)
                    setAdjust(DEFAULT_ADJUST)
                    setShowAdjust(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>

              {/* Filters + adjustments — images only */}
              {!isVideo && (
                <>
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

                  {/* Manual adjustments — collapsible sliders */}
                  <div>
                    <button
                      onClick={() => setShowAdjust((s) => !s)}
                      className="flex items-center gap-1.5 text-xs font-medium text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Ayarlar
                      {(adjust.brightness !== 1 || adjust.contrast !== 1 || adjust.saturate !== 1 || adjust.warmth !== 0) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-(--color-coral)" />
                      )}
                    </button>
                    {showAdjust && (
                      <div className="mt-2 space-y-2.5">
                        {ADJUST_CONTROLS.map((c) => (
                          <div key={c.key} className="flex items-center gap-2">
                            <span className="text-[11px] text-(--color-text-tertiary) w-16 flex-shrink-0">{c.label}</span>
                            <input
                              type="range"
                              min={c.min}
                              max={c.max}
                              step={c.step}
                              value={adjust[c.key]}
                              onChange={(e) => setAdjust((a) => ({ ...a, [c.key]: Number(e.target.value) }))}
                              className="flex-1 accent-(--color-coral) h-1"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => setAdjust(DEFAULT_ADJUST)}
                          className="text-[11px] text-(--color-coral) hover:underline"
                        >
                          Sıfırla
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
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
  const currentHandle = (session?.user as { handle?: string } | undefined)?.handle
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
        <MomentViewer
          group={viewing}
          currentHandle={currentHandle}
          onClose={() => setViewing(null)}
          onDeleted={(id) => {
            setGroups((prev) =>
              prev
                .map((g) =>
                  g.actor.id === viewing.actor.id
                    ? { ...g, moments: g.moments.filter((m) => m.id !== id) }
                    : g,
                )
                .filter((g) => g.moments.length > 0),
            )
          }}
        />
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
