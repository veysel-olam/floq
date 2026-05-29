'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Send, Lock, ShieldCheck, Mic, MicOff, Play, Pause,
  Square, Trash2, Users, ImagePlus, ExternalLink, Pencil, Check, X,
  CornerUpLeft, Search, BellOff, Bell, Archive, Smile, CheckCheck, ChevronDown,
} from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type Actor, type MediaAttachment, type GifResult } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { generateAndStoreKeyPair, loadPrivateKey, encryptMessage, decryptMessage } from '@/lib/e2e-crypto'
import { useRealtime } from '@/hooks/use-realtime'
import { triggerHaptic } from '@/hooks/use-haptics'
import { GifPicker } from '@/components/posts/gif-picker'

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏']

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (itemDay.getTime() === today.getTime()) return 'Bugün'
  if (itemDay.getTime() === yesterday.getTime()) return 'Dün'
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Deterministic pseudo-random waveform bars from the audio URL
function genWaveform(seed: string, bars: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9)
    h ^= h >>> 16
  }
  return Array.from({ length: bars }, (_, i) => {
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    h ^= h >>> 16
    const rand = (Math.abs(h) >>> 0) / 0xffffffff
    // Bell-curve bias: taller bars in the middle of the clip
    const bell = Math.sin((i / bars) * Math.PI) * 0.25
    return Math.min(1, Math.max(0.12, rand * 0.65 + bell + 0.15))
  })
}

const WAVEFORM_BARS = 44

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({ url, isMine }: { url: string; isMine: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveform = useRef(genWaveform(url, WAVEFORM_BARS))

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onLoad = () => setDuration(isFinite(el.duration) ? el.duration : 0)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoad)
    el.addEventListener('durationchange', onLoad)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoad)
      el.removeEventListener('durationchange', onLoad)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) } else { void el.play(); setPlaying(true) }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    el.currentTime = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const playedBars = Math.round(progress * WAVEFORM_BARS)
  const timeLabel = duration > 0
    ? (playing || currentTime > 0 ? formatDuration(currentTime) : formatDuration(duration))
    : '—'

  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-2.5 w-[240px]', isMine ? 'text-white' : 'text-(--color-text-primary)')}>
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play / pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
          isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-(--color-coral)/15 hover:bg-(--color-coral)/25',
        )}
      >
        {playing
          ? <Pause className={cn('w-3.5 h-3.5', isMine ? 'text-white' : 'text-(--color-coral)')} />
          : <Play className={cn('w-3.5 h-3.5 ml-0.5', isMine ? 'text-white' : 'text-(--color-coral)')} />}
      </button>

      {/* Waveform + time */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Waveform bars */}
        <div
          className="flex items-center gap-[1.5px] h-7 cursor-pointer select-none"
          onClick={seek}
        >
          {waveform.current.map((h, i) => {
            const played = i < playedBars
            const frontier = playing && Math.abs(i - playedBars) <= 1
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-full',
                  !frontier && 'transition-all duration-75',
                  played || frontier
                    ? isMine ? 'bg-white' : 'bg-(--color-coral)'
                    : isMine ? 'bg-white/30' : 'bg-(--color-border)',
                )}
                style={{
                  height: `${Math.round(h * 100)}%`,
                  animation: frontier ? 'waveform-pulse 0.55s ease-in-out infinite' : undefined,
                  animationDelay: frontier ? `${(i - playedBars + 1) * 80}ms` : undefined,
                }}
              />
            )
          })}
        </div>

        {/* Timer */}
        <span className={cn('text-[10px] tabular-nums leading-none', isMine ? 'text-white/55' : 'text-(--color-text-tertiary)')}>
          {timeLabel}
        </span>
      </div>
    </div>
  )
}

// ─── ReplyPreview ─────────────────────────────────────────────────────────────

function ReplyPreview({ replyTo, isMine }: { replyTo: NonNullable<Post['replyTo']>; isMine: boolean }) {
  return (
    <div className={cn('px-3 pt-2 pb-1 border-l-[3px] mx-2 mt-2 rounded-sm', isMine ? 'border-white/50 bg-white/10' : 'border-(--color-coral)/50 bg-(--color-coral)/5')}>
      <p className={cn('text-[10px] font-semibold mb-0.5', isMine ? 'text-white/70' : 'text-(--color-coral)')}>
        {replyTo.author?.displayName ?? replyTo.author?.handle ?? 'Bilinmiyor'}
      </p>
      <p className={cn('text-[11px] line-clamp-1', isMine ? 'text-white/60' : 'text-(--color-text-secondary)')}>
        {replyTo.content || '[Medya]'}
      </p>
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine, isTail, myPrivateKey, partnerPublicKey, isEditing, onEditSave, onEditCancel }: {
  msg: Post; isMine: boolean; isTail: boolean
  myPrivateKey: CryptoKey | null; partnerPublicKey: string | null | undefined
  isEditing: boolean; onEditSave: (content: string) => void; onEditCancel: () => void
}) {
  const [displayContent, setDisplayContent] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState(false)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    if (!msg.encryptedContent || !msg.encryptionIv) { setDisplayContent(msg.content); return }
    if (!myPrivateKey || !partnerPublicKey) { setDecryptError(true); return }
    decryptMessage(msg.encryptedContent, msg.encryptionIv, msg.ephemeralPublicKey ?? partnerPublicKey, myPrivateKey)
      .then(setDisplayContent).catch(() => setDecryptError(true))
  }, [msg, myPrivateKey, partnerPublicKey])

  useEffect(() => { if (isEditing && displayContent !== null) setEditDraft(displayContent) }, [isEditing, displayContent])

  const audioAttachment = msg.media?.find((m: MediaAttachment) => m.mimeType?.startsWith('audio/'))
  const imageAttachment = msg.media?.find((m: MediaAttachment) => m.mimeType?.startsWith('image/'))

  const base = cn(
    'relative overflow-hidden',
    isMine
      ? cn('bg-(--color-coral) text-white shadow-sm shadow-(--color-coral)/20', isTail ? 'rounded-[18px] rounded-br-[5px]' : 'rounded-[18px]')
      : cn('bg-(--color-background-secondary) text-(--color-text-primary)', isTail ? 'rounded-[18px] rounded-bl-[5px]' : 'rounded-[18px]'),
  )

  if (audioAttachment && !isEditing) {
    return <div className={base}><AudioPlayer url={audioAttachment.url} isMine={isMine} /></div>
  }

  if (imageAttachment && !isEditing) {
    return (
      <div className={cn(base, 'overflow-hidden max-w-[220px]')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageAttachment.url} alt={imageAttachment.altText ?? ''} className="w-full object-cover" style={{ maxHeight: 260 }} />
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className={cn(base, 'p-2')}>
        <textarea
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          autoFocus rows={2}
          className="w-full bg-transparent resize-none text-sm focus:outline-none leading-snug"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSave(editDraft) }
            if (e.key === 'Escape') onEditCancel()
          }}
        />
        <div className="flex justify-end gap-1 mt-1">
          <button onClick={onEditCancel} className={cn('p-1 rounded-full', isMine ? 'hover:bg-white/20' : 'hover:bg-(--color-border)')}>
            <X className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEditSave(editDraft)} className={cn('p-1 rounded-full', isMine ? 'hover:bg-white/20' : 'hover:bg-(--color-border)')}>
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const content = decryptError ? '[Mesaj çözümlenemedi]' : displayContent ?? '…'
  const lp = msg.linkPreview

  return (
    <div className={cn(base, 'text-sm leading-relaxed break-words max-w-full overflow-hidden')}>
      {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} isMine={isMine} />}
      {content && (
        <p className={cn('px-3.5 py-2', msg.replyTo ? 'pt-1.5' : '')}>
          {content}
          {msg.encryptedContent && !decryptError && displayContent !== null && (
            <Lock className="inline w-2.5 h-2.5 ml-1 opacity-50 align-middle" />
          )}
          {msg.editedAt && (
            <span className={cn('text-[9px] ml-1.5 opacity-50', isMine ? 'text-white' : 'text-(--color-text-tertiary)')}>(düzenlendi)</span>
          )}
        </p>
      )}
      {lp && (
        <a href={lp.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          className={cn('flex flex-col border-t overflow-hidden hover:opacity-90 transition-opacity', isMine ? 'border-white/20' : 'border-(--color-border-secondary)')}>
          {lp.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lp.image} alt={lp.title ?? ''} className="w-full object-cover" style={{ maxHeight: 120 }} />
          )}
          <div className="px-3 py-2">
            {lp.siteName && <p className={cn('text-[10px] font-semibold uppercase tracking-wide mb-0.5', isMine ? 'text-white/60' : 'text-(--color-text-tertiary)')}>{lp.siteName}</p>}
            {lp.title && <p className={cn('text-xs font-semibold leading-snug line-clamp-2', isMine ? 'text-white' : 'text-(--color-text-primary)')}>{lp.title}</p>}
            {lp.description && <p className={cn('text-[11px] mt-0.5 line-clamp-2', isMine ? 'text-white/70' : 'text-(--color-text-secondary)')}>{lp.description}</p>}
            <p className={cn('text-[10px] mt-1 flex items-center gap-1', isMine ? 'text-white/50' : 'text-(--color-text-tertiary)')}>
              <ExternalLink className="w-2.5 h-2.5" />
              {new URL(lp.url).hostname.replace('www.', '')}
            </p>
          </div>
        </a>
      )}
    </div>
  )
}

// ─── MessageRow ───────────────────────────────────────────────────────────────

function MessageRow({ msg, isMine, isTail, showAvatar, myPrivateKey, partnerPublicKey, isLastRead, isUnreadByPartner, partnerAvatarUrl, partnerInitials, editingId, isNew, onDelete, onReply, onReact, onEditStart, onEditSave, onEditCancel }: {
  msg: Post; isMine: boolean; isTail: boolean; showAvatar: boolean
  myPrivateKey: CryptoKey | null; partnerPublicKey: string | null | undefined
  isLastRead: boolean; isUnreadByPartner: boolean
  partnerAvatarUrl: string | null | undefined; partnerInitials: string
  editingId: string | null; isNew?: boolean
  onDelete: (id: string) => void; onReply: (msg: Post) => void
  onReact: (msgId: string, emoji: string) => void
  onEditStart: (msg: Post) => void; onEditSave: (id: string, content: string) => void; onEditCancel: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isEditing = editingId === msg.id
  const hasReactions = Object.keys(msg.reactions ?? {}).length > 0
  const canEdit = isMine && !msg.encryptedContent && !msg.media?.length

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !emojiOpen) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen, emojiOpen])

  // Long-press handlers
  function startLongPress() {
    longPressRef.current = setTimeout(() => setEmojiOpen(true), 500)
  }
  function endLongPress() {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }

  function handleDoubleClick() {
    onReact(msg.id, '❤️')
    setHeartAnim(false)
    requestAnimationFrame(() => setHeartAnim(true))
    setTimeout(() => setHeartAnim(false), 650)
  }

  async function handleDelete(mode: 'self' | 'everyone') {
    setMenuOpen(false)
    setDeleting(true)
    try {
      await api.dm.deleteMessage(msg.id, mode)
      onDelete(msg.id)
    } catch { setDeleting(false) }
  }

  return (
    <div className={cn('flex items-end gap-2 group', isMine ? 'flex-row-reverse' : 'flex-row', isTail ? 'mb-2' : 'mb-0.5', isNew && 'msg-animate-in')}>
      {/* Avatar slot */}
      <div className="w-7 flex-shrink-0 self-end">
        {showAvatar && isTail && !isMine && (
          <Avatar className="w-7 h-7">
            {msg.author?.avatarUrl && <AvatarImage src={msg.author.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
              {(msg.author?.displayName ?? msg.author?.handle ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Bubble column */}
      <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>

        {/* Bubble (with long-press → emoji picker) */}
        <div className="relative">
          {/* Emoji picker popup */}
          {emojiOpen && (
            <div
              ref={emojiRef}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                'absolute bottom-full mb-2 z-30 flex items-center bg-(--color-background) border border-(--color-border) rounded-full px-1.5 py-1.5 shadow-2xl',
                isMine ? 'right-0' : 'left-0',
              )}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onReact(msg.id, emoji); setEmojiOpen(false) }}
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-xl leading-none hover:opacity-75 transition-opacity',
                    (msg.viewer?.reactions ?? []).includes(emoji) ? 'bg-(--color-coral)/10' : '',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Floating heart animation */}
          {heartAnim && (
            <span className={cn('absolute text-2xl heart-pop z-40', isMine ? 'right-2' : 'left-2', 'bottom-2')}>
              ❤️
            </span>
          )}

          {/* The actual bubble */}
          <div
            onMouseDown={startLongPress}
            onMouseUp={endLongPress}
            onMouseLeave={endLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={endLongPress}
            onTouchCancel={endLongPress}
            onContextMenu={(e) => { e.preventDefault(); setEmojiOpen(true) }}
            onDoubleClick={handleDoubleClick}
            className="select-none"
          >
            {deleting ? (
              <div className="px-3.5 py-2 rounded-[18px] bg-(--color-background-secondary) text-xs text-(--color-text-tertiary) italic">
                Siliniyor…
              </div>
            ) : (
              <MessageBubble
                msg={msg} isMine={isMine} isTail={isTail}
                myPrivateKey={myPrivateKey} partnerPublicKey={partnerPublicKey}
                isEditing={isEditing}
                onEditSave={(c) => onEditSave(msg.id, c)}
                onEditCancel={onEditCancel}
              />
            )}
          </div>
        </div>

        {/* Reaction pills */}
        {hasReactions && !deleting && (
          <div className={cn('flex flex-wrap gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
            {Object.entries(msg.reactions ?? {}).map(([emoji, count]) => {
              const iReacted = msg.viewer?.reactions?.includes(emoji) ?? false
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className={cn(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors',
                    iReacted ? 'bg-(--color-coral)/15 border-(--color-coral)/30 text-(--color-coral)' : 'bg-(--color-background) border-(--color-border) text-(--color-text-secondary)',
                  )}
                >
                  {emoji} <span>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Time + read status + hover actions */}
        <div className={cn('flex items-center gap-1 mt-0.5 px-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
          {isTail && (
            <span className="text-[11px] text-(--color-text-tertiary) tabular-nums">
              {formatTime(msg.createdAt)}
            </span>
          )}

          {/* ✓ / ✓✓ read status for my messages */}
          {isMine && isTail && (
            isLastRead ? (
              <div className="flex items-center gap-0.5">
                <CheckCheck className="w-3.5 h-3.5 text-(--color-teal)" />
                <Avatar className="w-4 h-4">
                  {partnerAvatarUrl && <AvatarImage src={partnerAvatarUrl} alt="" />}
                  <AvatarFallback className="text-[8px] text-white" style={{ background: 'var(--gradient-avatar)' }}>{partnerInitials}</AvatarFallback>
                </Avatar>
              </div>
            ) : isUnreadByPartner ? (
              <Check className="w-3 h-3 text-(--color-text-tertiary)" />
            ) : null
          )}

          {/* Hover-only actions: reply + delete */}
          <div className={cn('opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
            <button
              onClick={() => onReply(msg)}
              className="p-0.5 rounded text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
              title="Yanıtla"
            >
              <CornerUpLeft className="w-3 h-3" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-0.5 rounded text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              {menuOpen && (
                <div className={cn(
                  'absolute bottom-full mb-1.5 z-20 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-xl overflow-hidden min-w-[175px]',
                  isMine ? 'right-0' : 'left-0',
                )}>
                  {canEdit && (
                    <button
                      onClick={() => { setMenuOpen(false); onEditStart(msg) }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                      Düzenle
                    </button>
                  )}
                  <button
                    onClick={() => void handleDelete('self')}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors',
                      canEdit ? 'border-t border-(--color-border-secondary)' : '',
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                    Kendin için sil
                  </button>
                  {isMine && (
                    <button
                      onClick={() => void handleDelete('everyone')}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors border-t border-(--color-border-secondary)"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Herkes için sil
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots({ avatarUrl, initials }: { avatarUrl: string | null | undefined; initials: string }) {
  return (
    <div className="flex items-end gap-2 mb-2">
      <div className="w-7 flex-shrink-0 self-end">
        <Avatar className="w-7 h-7">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>{initials}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex items-center gap-1 px-4 py-3 bg-(--color-background-secondary) rounded-[18px] rounded-bl-[5px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-(--color-text-tertiary) animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }} />
        ))}
      </div>
    </div>
  )
}

// ─── RecordingBar ─────────────────────────────────────────────────────────────

function RecordingBar({ seconds, onCancel, onStop }: { seconds: number; onCancel: () => void; onStop: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {/* İptal */}
      <button
        onClick={onCancel}
        className="w-11 h-11 rounded-full flex items-center justify-center text-(--color-text-tertiary) hover:bg-(--color-background-secondary) flex-shrink-0 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Waveform + timer */}
      <div className="flex-1 flex items-center gap-2.5 bg-(--color-background-secondary) rounded-full px-4 h-11">
        <span className="w-2 h-2 rounded-full bg-(--color-coral) animate-pulse flex-shrink-0" />
        <div className="flex-1 flex gap-[2px] items-center h-5">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full bg-(--color-coral)/50 animate-pulse"
              style={{
                height: `${28 + Math.abs(Math.sin(i * 0.7)) * 72}%`,
                animationDelay: `${i * 35}ms`,
                animationDuration: `${650 + (i % 5) * 110}ms`,
              }}
            />
          ))}
        </div>
        <span className="text-xs text-(--color-text-secondary) tabular-nums flex-shrink-0 font-medium">
          {formatDuration(seconds)}
        </span>
      </div>

      {/* Gönder */}
      <button
        onClick={onStop}
        className="w-11 h-11 rounded-full bg-(--color-coral) flex items-center justify-center text-white flex-shrink-0 hover:opacity-90 shadow-sm shadow-(--color-coral)/25 transition-opacity"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  )
}

// ─── EmojiPicker ─────────────────────────────────────────────────────────────

const EMOJI_ROWS = [
  ['😀', '😂', '🥰', '😍', '🤩', '😎', '🥺', '😭'],
  ['😅', '🤔', '🙄', '😤', '🤗', '😴', '🤣', '😇'],
  ['❤️', '🔥', '💯', '✨', '🎉', '👏', '🙌', '💪'],
  ['👍', '👎', '👋', '🤝', '🤞', '✌️', '🫶', '💀'],
  ['🐶', '🐱', '🦊', '🌸', '⭐', '🍕', '🎵', '💻'],
]

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-30 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-2xl p-2"
    >
      {EMOJI_ROWS.map((row, i) => (
        <div key={i} className="flex">
          {row.map((emoji) => (
            <button
              key={emoji}
              onMouseDown={(e) => { e.preventDefault(); onSelect(emoji) }}
              className="text-xl p-1 rounded-xl hover:bg-(--color-background-secondary) transition-colors leading-none w-9 h-9 flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'uploading'

export default function DmThreadPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [partner, setPartner] = useState<Actor | null>(null)
  const [messages, setMessages] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null)
  const [e2eReady, setE2eReady] = useState(false)

  const [partnerTyping, setPartnerTyping] = useState(false)
  const [partnerReadId, setPartnerReadId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Post | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [settings, setSettings] = useState({ archived: false, muted: false, requestAccepted: null as boolean | null })

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [animatingMsgId, setAnimatingMsgId] = useState<string | null>(null)

  const [gifOpen, setGifOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [attachUploading, setAttachUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null)

  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef<number>(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const myHandle = (session?.user as { handle?: string } | undefined)?.handle

  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await api.dm.thread(handle, cursor)
      setPartner(data.partner)
      if (cursor) {
        setMessages((prev) => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
        setPartnerReadId(data.partnerReadId)
        setSettings(data.settings)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
      }
      setNextCursor(data.nextCursor)
    } catch (err) {
      if ((err as { status?: number }).status === 401) router.push('/login')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [handle, router])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) {
      void load()
      async function initE2E() {
        try {
          let privKey = await loadPrivateKey()
          if (!privKey) {
            const pubKeyB64 = await generateAndStoreKeyPair()
            await api.dm.registerDmKey(pubKeyB64)
            privKey = await loadPrivateKey()
          }
          if (privKey) { setMyPrivateKey(privKey); setE2eReady(true) }
        } catch (e) { console.error('E2E init failed', e) }
      }
      void initE2E()
    }
  }, [isPending, session, load])

  useEffect(() => {
    if (!loading && messages.length > 0) void api.dm.markRead(handle)
  }, [loading, handle, messages.length])

  useEffect(() => () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    mediaRecorderRef.current?.stop()
  }, [])

  // Real-time
  const onDmEvent = useCallback((data: unknown) => {
    const { from, post } = data as { from: string; post: Post }
    if (from !== handle) return
    setMessages((prev) => prev.some((m) => m.id === post.id) ? prev : [...prev, post])
    void api.dm.markRead(handle)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [handle])

  const onDmTyping = useCallback((data: unknown) => {
    if ((data as { from: string }).from !== handle) return
    setPartnerTyping(true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000)
  }, [handle])

  const onDmRead = useCallback((data: unknown) => {
    const { from, lastReadId } = data as { from: string; lastReadId: string }
    if (from === handle) setPartnerReadId(lastReadId)
  }, [handle])

  useRealtime({ dm: onDmEvent, dm_typing: onDmTyping, dm_read: onDmRead })

  // Search
  useEffect(() => {
    if (!searchOpen || searchQuery.length < 2) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try { setSearchResults((await api.dm.searchMessages(handle, searchQuery)).messages) }
      catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [searchQuery, searchOpen, handle])

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    const now = Date.now()
    if (e.target.value.length > 0 && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      void api.dm.sendTyping(handle)
    }
  }

  async function sendMessage() {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    const replyId = replyingTo?.id
    setContent('')
    setReplyingTo(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      let newMsg: Post
      if (e2eReady && myPrivateKey && partner?.dmPublicKey) {
        const encrypted = await encryptMessage(text, partner.dmPublicKey)
        newMsg = await api.dm.send(handle, text, encrypted, undefined, replyId)
        newMsg = { ...newMsg, content: text, encryptedContent: encrypted.encryptedContent }
      } else {
        newMsg = await api.dm.send(handle, text, undefined, undefined, replyId)
      }
      void triggerHaptic('light')
      setMessages((prev) => [...prev, newMsg])
      setAnimatingMsgId(newMsg.id)
      setTimeout(() => setAnimatingMsgId(null), 400)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { setContent(text) }
    finally { setSending(false) }
  }

  async function handleReact(msgId: string, emoji: string) {
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return
    const alreadyReacted = msg.viewer?.reactions?.includes(emoji) ?? false
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m
      const reactions = { ...m.reactions }
      const vr = [...(m.viewer?.reactions ?? [])]
      if (alreadyReacted) {
        reactions[emoji] = Math.max(0, (reactions[emoji] ?? 1) - 1)
        if (reactions[emoji] === 0) delete reactions[emoji]
        return { ...m, reactions, viewer: { ...(m.viewer ?? { liked: false, boosted: false, bookmarked: false, reactions: [] }), reactions: vr.filter((e) => e !== emoji) } }
      } else {
        reactions[emoji] = (reactions[emoji] ?? 0) + 1
        return { ...m, reactions, viewer: { ...(m.viewer ?? { liked: false, boosted: false, bookmarked: false, reactions: [] }), reactions: [...vr, emoji] } }
      }
    }))
    try {
      if (alreadyReacted) await api.posts.unreact(msgId, emoji)
      else await api.posts.react(msgId, emoji)
    } catch { void load() }
  }

  async function handleEditSave(id: string, newContent: string) {
    if (!newContent.trim()) return
    setEditingId(null)
    try {
      const updated = await api.dm.editMessage(id, newContent.trim())
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: updated.content, editedAt: updated.editedAt } : m))
    } catch { void load() }
  }

  async function sendGif(gif: GifResult) {
    setGifOpen(false)
    setAttachUploading(true)
    try {
      const att = await api.gifs.attach(gif)
      const newMsg = await api.dm.sendMedia(handle, [att.id])
      setMessages((prev) => [...prev, newMsg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { } finally { setAttachUploading(false) }
  }

  function previewFile(file: File) {
    const url = URL.createObjectURL(file)
    setPendingFile(file)
    setPendingFileUrl(url)
  }

  async function confirmSendFile() {
    if (!pendingFile) return
    const file = pendingFile
    setPendingFile(null)
    if (pendingFileUrl) { URL.revokeObjectURL(pendingFileUrl); setPendingFileUrl(null) }
    setAttachUploading(true)
    try {
      const att = await api.media.upload(file)
      const newMsg = await api.dm.sendMedia(handle, [att.id])
      setMessages((prev) => [...prev, newMsg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { } finally { setAttachUploading(false) }
  }

  function cancelPendingFile() {
    if (pendingFileUrl) URL.revokeObjectURL(pendingFileUrl)
    setPendingFile(null)
    setPendingFileUrl(null)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (!audioChunksRef.current.length) { setRecordingState('idle'); return }
        setRecordingState('uploading')
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType.split(';')[0] })
          const att = await api.media.uploadAudio(blob, mimeType.split(';')[0]!)
          const newMsg = await api.dm.sendMedia(handle, [att.id])
          setMessages((prev) => [...prev, newMsg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } catch { } finally { setRecordingState('idle'); setRecordingSeconds(0) }
      }
      mediaRecorderRef.current = recorder
      recorder.start(250)
      setRecordingState('recording')
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => { if (s >= 119) { stopRecording(); return s } return s + 1 })
      }, 1000)
    } catch { }
  }

  function stopRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    mediaRecorderRef.current?.stop()
  }

  function cancelRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    const rec = mediaRecorderRef.current
    if (rec) { rec.onstop = () => rec.stream?.getTracks().forEach((t) => t.stop()); rec.stop() }
    audioChunksRef.current = []
    setRecordingState('idle')
    setRecordingSeconds(0)
  }

  function groupByDay(msgs: Post[]) {
    const groups: { date: string; messages: Post[] }[] = []
    let currentDay = ''
    for (const msg of msgs) {
      const day = new Date(msg.createdAt).toDateString()
      if (day !== currentDay) { currentDay = day; groups.push({ date: msg.createdAt, messages: [msg] }) }
      else groups[groups.length - 1]!.messages.push(msg)
    }
    return groups
  }

  const lastReadMsgId = (() => {
    if (!partnerReadId) return null
    const myMsgs = messages.filter((m) => m.author?.handle === myHandle)
    const idx = myMsgs.findIndex((m) => m.id === partnerReadId)
    return idx === -1 ? myMsgs[myMsgs.length - 1]?.id ?? null : myMsgs[idx]?.id ?? null
  })()

  // IDs of my messages sent after the last-read point (unread by partner)
  const unreadByPartnerIds = (() => {
    if (!lastReadMsgId) {
      return new Set(messages.filter((m) => m.author?.handle === myHandle).map((m) => m.id))
    }
    const myMsgs = messages.filter((m) => m.author?.handle === myHandle)
    const readIdx = myMsgs.findIndex((m) => m.id === lastReadMsgId)
    return new Set(myMsgs.slice(readIdx + 1).map((m) => m.id))
  })()

  const initials = (partner?.displayName ?? partner?.handle ?? '?').slice(0, 2).toUpperCase()
  const isRecording = recordingState === 'recording'
  const isUploading = recordingState === 'uploading'
  const hasText = content.trim().length > 0
  const displayMessages = searchResults ?? messages

  return (
    <div className="max-w-xl mx-auto flex flex-col relative" style={{ height: '100dvh' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-(--color-background)/95 backdrop-blur-xl border-b border-(--color-border) px-3 h-14 flex items-center gap-2 z-10">
        <Link href="/dm" className="p-2 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-secondary) flex-shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>

        {partner ? (
          <Link href={`/${partner.handle}`} className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar className="w-9 h-9 flex-shrink-0">
              {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.displayName ?? partner.handle} />}
              <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[15px] font-semibold text-(--color-text-primary) truncate leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {partner.displayName ?? partner.handle}
                </p>
                {e2eReady && partner.dmPublicKey && <ShieldCheck className="w-3.5 h-3.5 text-(--color-teal) flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-(--color-text-tertiary) leading-tight">@{partner.handle}</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-full bg-(--color-background-secondary) animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-(--color-background-secondary) animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-(--color-background-secondary) animate-pulse" />
            </div>
          </div>
        )}

        {/* Header actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); setSearchResults(null) }}
            className={cn('p-2 rounded-full transition-colors', searchOpen ? 'bg-(--color-coral)/10 text-(--color-coral)' : 'hover:bg-(--color-background-secondary) text-(--color-text-tertiary)')}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              const next = !settings.muted
              setSettings((s) => ({ ...s, muted: next }))
              await api.dm.updateSettings(handle, { muted: next })
            }}
            className={cn('p-2 rounded-full transition-colors', settings.muted ? 'text-(--color-coral)' : 'hover:bg-(--color-background-secondary) text-(--color-text-tertiary)')}
            title={settings.muted ? 'Sesi aç' : 'Sessize al'}
          >
            {settings.muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          <button
            onClick={async () => {
              const next = !settings.archived
              setSettings((s) => ({ ...s, archived: next }))
              await api.dm.updateSettings(handle, { archived: next })
            }}
            className={cn('p-2 rounded-full transition-colors', settings.archived ? 'text-(--color-coral)' : 'hover:bg-(--color-background-secondary) text-(--color-text-tertiary)')}
            title={settings.archived ? 'Arşivden çıkar' : 'Arşivle'}
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Search bar ─────────────────────────────────────── */}
      {searchOpen && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-(--color-border)">
          <div className="flex items-center gap-2 bg-(--color-background-secondary) rounded-full px-3 py-2">
            <Search className="w-3.5 h-3.5 text-(--color-text-tertiary) flex-shrink-0" />
            <input
              autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mesajlarda ara…"
              className="flex-1 bg-transparent text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
            />
            {searching
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-text-tertiary)" />
              : searchQuery
              ? <button onClick={() => { setSearchQuery(''); setSearchResults(null) }} className="text-(--color-text-tertiary)"><X className="w-3.5 h-3.5" /></button>
              : null}
          </div>
          {searchResults !== null && (
            <p className="text-[11px] text-(--color-text-tertiary) mt-1.5 px-1">{searchResults.length} sonuç</p>
          )}
        </div>
      )}

      {/* ── Scroll to bottom ───────────────────────────────── */}
      {showScrollDown && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-20 right-4 z-20 w-8 h-8 rounded-full bg-(--color-background) border border-(--color-border) shadow-md flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* ── Messages ───────────────────────────────────────── */}
      <div
        ref={messagesRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
        }}
        className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
          </div>
        ) : (
          <>
            {!searchResults && nextCursor && (
              <div className="flex justify-center mb-6">
                <button
                  disabled={loadingMore}
                  onClick={() => { setLoadingMore(true); void load(nextCursor) }}
                  className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) px-3 py-1.5 rounded-full hover:bg-(--color-background-secondary) transition-all"
                >
                  {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Daha eski mesajlar'}
                </button>
              </div>
            )}

            {groupByDay(displayMessages).map(({ date, messages: dayMsgs }) => (
              <div key={date}>
                <div className="flex justify-center my-5">
                  <span className="text-[11px] text-(--color-text-tertiary) bg-(--color-background-secondary) px-3 py-1 rounded-full">
                    {formatDate(date)}
                  </span>
                </div>
                {dayMsgs.map((msg, i) => {
                  const isMine = msg.author?.handle === myHandle
                  const nextMsg = dayMsgs[i + 1]
                  const isTail = !nextMsg || nextMsg.author?.handle !== msg.author?.handle
                  return (
                    <MessageRow
                      key={msg.id}
                      msg={msg} isMine={isMine} isTail={isTail} showAvatar={!isMine}
                      myPrivateKey={myPrivateKey} partnerPublicKey={partner?.dmPublicKey}
                      isLastRead={msg.id === lastReadMsgId}
                      isUnreadByPartner={unreadByPartnerIds.has(msg.id)}
                      partnerAvatarUrl={partner?.avatarUrl}
                      partnerInitials={initials}
                      editingId={editingId}
                      isNew={animatingMsgId === msg.id}
                      onDelete={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
                      onReply={(m) => { setReplyingTo(m); textareaRef.current?.focus() }}
                      onReact={(msgId, emoji) => void handleReact(msgId, emoji)}
                      onEditStart={(m) => setEditingId(m.id)}
                      onEditSave={(id, c) => void handleEditSave(id, c)}
                      onEditCancel={() => setEditingId(null)}
                    />
                  )
                })}
              </div>
            ))}

            {displayMessages.length === 0 && !searchResults && (
              <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
                {partner && (
                  <Avatar className="w-14 h-14">
                    {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.displayName ?? partner.handle} />}
                    <AvatarFallback className="text-lg text-white" style={{ background: 'var(--gradient-avatar)' }}>{initials}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>{partner?.displayName ?? partner?.handle}</p>
                  <p className="text-xs text-(--color-text-tertiary) mt-1">İlk mesajı gönder</p>
                </div>
              </div>
            )}

            {searchResults?.length === 0 && (
              <div className="text-center py-8 text-sm text-(--color-text-tertiary)">Sonuç bulunamadı</div>
            )}

            {partnerTyping && (
              <TypingDots avatarUrl={partner?.avatarUrl} initials={initials} />
            )}

            <div ref={bottomRef} className="h-2" />
          </>
        )}
      </div>

      {/* ── Media preview modal ────────────────────────────── */}
      <Dialog open={!!(pendingFile && pendingFileUrl)} onOpenChange={(open) => { if (!open) cancelPendingFile() }}>
        <DialogContent showClose={false} className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3">
            <DialogTitle>Medya gönder</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-(--color-background-secondary) px-3 py-3">
            {pendingFile?.type.startsWith('video/') ? (
              <video src={pendingFileUrl!} controls className="max-h-64 max-w-full rounded-xl object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pendingFileUrl!} alt="" className="max-h-64 max-w-full rounded-xl object-contain" />
            )}
          </div>
          <DialogFooter>
            <p className="text-xs text-(--color-text-tertiary) truncate mr-auto">{pendingFile?.name}</p>
            <button
              onClick={cancelPendingFile}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
            >
              İptal
            </button>
            <button
              onClick={() => void confirmSendFile()}
              disabled={attachUploading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-(--color-coral) text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {attachUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Gönder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Composer ───────────────────────────────────────── */}
      {!searchResults && (
        <div className="flex-shrink-0 bg-(--color-background) border-t border-(--color-border)">

          {/* Reply bar */}
          {replyingTo && (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <CornerUpLeft className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-(--color-coral) truncate">
                  {replyingTo.author?.displayName ?? replyingTo.author?.handle}
                </p>
                <p className="text-[11px] text-(--color-text-tertiary) truncate">{replyingTo.content || '[Medya]'}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-tertiary) flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="px-3 py-3">
            {isRecording ? (
              <RecordingBar seconds={recordingSeconds} onCancel={cancelRecording} onStop={stopRecording} />
            ) : (
              <div className="flex items-end gap-2">

                {/* Action buttons — outside the pill */}
                <div className="flex items-center gap-0.5 mb-1.5 flex-shrink-0">

                  {/* Emoji */}
                  <div className="relative">
                    <button
                      onClick={() => { setEmojiPickerOpen((v) => !v); setGifOpen(false) }}
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                        emojiPickerOpen ? 'text-(--color-coral)' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
                      )}
                      title="Emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    {emojiPickerOpen && (
                      <EmojiPicker
                        onSelect={(emoji) => {
                          const ta = textareaRef.current
                          if (ta) {
                            const start = ta.selectionStart ?? content.length
                            const end = ta.selectionEnd ?? content.length
                            const next = content.slice(0, start) + emoji + content.slice(end)
                            setContent(next)
                            setTimeout(() => { ta.focus(); ta.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
                          } else {
                            setContent((c) => c + emoji)
                          }
                          setEmojiPickerOpen(false)
                        }}
                        onClose={() => setEmojiPickerOpen(false)}
                      />
                    )}
                  </div>

                  {/* Image */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={attachUploading}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors disabled:opacity-40"
                    title="Fotoğraf veya video"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>

                  {/* GIF */}
                  <div className="relative">
                    <button
                      onClick={() => { setGifOpen((v) => !v); setEmojiPickerOpen(false) }}
                      disabled={attachUploading}
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold tracking-widest transition-colors disabled:opacity-40',
                        gifOpen ? 'text-(--color-coral)' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
                      )}
                    >
                      GIF
                    </button>
                    {gifOpen && (
                      <GifPicker
                        direction="up"
                        onSelect={(gif) => void sendGif(gif)}
                        onClose={() => setGifOpen(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Pill — sadece textarea */}
                <div className="flex-1 flex items-end bg-(--color-background-secondary) rounded-[22px] border border-(--color-border) focus-within:border-(--color-coral)/60 transition-colors min-h-[44px] px-4">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    placeholder="Mesaj yaz…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent py-[11px] text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none leading-snug max-h-[120px] overflow-y-auto"
                    style={{ minHeight: '22px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
                    }}
                  />
                </div>

                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) previewFile(f); e.target.value = '' }} />

                <button
                  onClick={hasText ? sendMessage : startRecording}
                  disabled={sending || isUploading || attachUploading}
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 shadow-sm',
                    hasText
                      ? 'bg-(--color-coral) text-white shadow-(--color-coral)/25 hover:opacity-90 active:scale-95'
                      : 'bg-(--color-background-secondary) text-(--color-text-secondary) border border-(--color-border-secondary)',
                  )}
                >
                  {sending || isUploading || attachUploading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : hasText ? <Send className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
