'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send, Lock, ShieldCheck, Mic, MicOff, Play, Pause, Square } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type Actor, type MediaAttachment } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { generateAndStoreKeyPair, loadPrivateKey, encryptMessage, decryptMessage } from '@/lib/e2e-crypto'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function AudioPlayer({ url, isMine }: { url: string; isMine: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onLoad = () => setDuration(el.duration || 0)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoad)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoad)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else { void el.play(); setPlaying(true) }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-2 rounded-2xl min-w-[160px]',
      isMine ? 'bg-(--color-coral) text-white rounded-tr-sm' : 'bg-(--color-background-secondary) text-(--color-text-primary) rounded-tl-sm'
    )}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={togglePlay} className="w-7 h-7 flex items-center justify-center flex-shrink-0">
        {playing
          ? <Pause className="w-4 h-4" />
          : <Play className="w-4 h-4" />
        }
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className={cn('h-1 rounded-full overflow-hidden', isMine ? 'bg-white/30' : 'bg-(--color-border)')}>
          <div
            className={cn('h-full rounded-full transition-all', isMine ? 'bg-white' : 'bg-(--color-coral)')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={cn('text-[10px]', isMine ? 'text-white/70' : 'text-(--color-text-tertiary)')}>
          {playing ? formatDuration(currentTime) : formatDuration(duration)}
        </span>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isMine, myPrivateKey, partnerPublicKey }: {
  msg: Post
  isMine: boolean
  myPrivateKey: CryptoKey | null
  partnerPublicKey: string | null | undefined
}) {
  const [displayContent, setDisplayContent] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState(false)

  useEffect(() => {
    if (!msg.encryptedContent || !msg.encryptionIv) {
      setDisplayContent(msg.content)
      return
    }
    if (!myPrivateKey) { setDecryptError(true); return }
    const peerPubKey = partnerPublicKey
    if (!peerPubKey) { setDecryptError(true); return }

    decryptMessage(msg.encryptedContent, msg.encryptionIv, msg.ephemeralPublicKey ?? peerPubKey, myPrivateKey)
      .then(setDisplayContent)
      .catch(() => setDecryptError(true))
  }, [msg, myPrivateKey, partnerPublicKey, isMine])

  // Audio-only message
  const audioAttachment = msg.media?.find((m: MediaAttachment) => m.mimeType?.startsWith('audio/'))
  if (audioAttachment) {
    return <AudioPlayer url={audioAttachment.url} isMine={isMine} />
  }

  const content = decryptError
    ? '[Mesaj çözümlenemedi]'
    : displayContent ?? '...'

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
        isMine
          ? 'bg-(--color-coral) text-white rounded-tr-sm'
          : 'bg-(--color-background-secondary) text-(--color-text-primary) rounded-tl-sm',
      )}
    >
      {content}
      {msg.encryptedContent && !decryptError && displayContent !== null && (
        <Lock className="inline w-2.5 h-2.5 ml-1 opacity-60" />
      )}
    </div>
  )
}

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

  // Voice recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const myHandle = (session?.user as { handle?: string } | undefined)?.handle

  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await api.dm.thread(handle, cursor)
      setPartner(data.partner)
      if (cursor) {
        setMessages((prev) => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
      }
      setNextCursor(data.nextCursor)
    } catch (err) {
      const error = err as { status?: number }
      if (error.status === 401) router.push('/login')
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
          if (privKey) {
            setMyPrivateKey(privKey)
            setE2eReady(true)
          }
        } catch (e) {
          console.error('E2E init failed', e)
        }
      }
      void initE2E()
    }
  }, [isPending, session, load])

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      mediaRecorderRef.current?.stop()
    }
  }, [])

  async function sendMessage() {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    setContent('')
    try {
      let newMsg: Post
      if (e2eReady && myPrivateKey && partner?.dmPublicKey) {
        const encrypted = await encryptMessage(text, partner.dmPublicKey)
        newMsg = await api.dm.send(handle, text, encrypted)
        newMsg = { ...newMsg, content: text, encryptedContent: encrypted.encryptedContent }
      } else {
        newMsg = await api.dm.send(handle, text)
      }
      setMessages((prev) => [...prev, newMsg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setContent(text)
    } finally {
      setSending(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (audioChunksRef.current.length === 0) { setRecordingState('idle'); return }
        setRecordingState('uploading')
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType.split(';')[0] })
          const attachment = await api.media.uploadAudio(blob, mimeType.split(';')[0]!)
          const newMsg = await api.dm.sendMedia(handle, [attachment.id])
          setMessages((prev) => [...prev, newMsg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } catch {
          // silently fail — user can retry
        } finally {
          setRecordingState('idle')
          setRecordingSeconds(0)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setRecordingState('recording')
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= 119) {
            // Max 2 min
            stopRecording()
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch {
      // mic permission denied or not available
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    mediaRecorderRef.current?.stop()
  }

  function cancelRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    const recorder = mediaRecorderRef.current
    if (recorder) {
      // Remove onstop to skip upload
      recorder.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
      }
      recorder.stop()
    }
    audioChunksRef.current = []
    setRecordingState('idle')
    setRecordingSeconds(0)
  }

  function groupByDay(msgs: Post[]) {
    const groups: { date: string; messages: Post[] }[] = []
    let currentDate = ''
    for (const msg of msgs) {
      const day = new Date(msg.createdAt).toDateString()
      if (day !== currentDate) {
        currentDate = day
        groups.push({ date: msg.createdAt, messages: [msg] })
      } else {
        groups[groups.length - 1]!.messages.push(msg)
      }
    }
    return groups
  }

  const initials = (partner?.displayName ?? partner?.handle ?? '?').slice(0, 2).toUpperCase()
  const isRecording = recordingState === 'recording'
  const isUploading = recordingState === 'uploading'

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--color-background)/95 backdrop-blur border-b border-(--color-border) px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/dm" className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {partner ? (
          <Link href={`/${partner.handle}`} className="flex items-center gap-2.5 min-w-0">
            <Avatar className="w-8 h-8 flex-shrink-0">
              {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.displayName ?? partner.handle} />}
              <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                {partner.displayName ?? partner.handle}
              </p>
              <p className="text-xs text-(--color-text-tertiary)">@{partner.handle}</p>
              {e2eReady && partner?.dmPublicKey && (
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] text-green-600 dark:text-green-400">Uçtan uca şifreli</span>
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="h-8 w-32 rounded bg-(--color-background-secondary) animate-pulse" />
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
          </div>
        ) : (
          <>
            {nextCursor && (
              <div className="flex justify-center mb-4">
                <button
                  disabled={loadingMore}
                  onClick={() => { setLoadingMore(true); void load(nextCursor) }}
                  className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
                >
                  {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Daha eski mesajlar'}
                </button>
              </div>
            )}

            {groupByDay(messages).map(({ date, messages: dayMsgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-4">
                  <Separator className="flex-1 bg-(--color-border-secondary)" />
                  <span className="text-xs text-(--color-text-tertiary) flex-shrink-0">{formatDate(date)}</span>
                  <Separator className="flex-1 bg-(--color-border-secondary)" />
                </div>

                {dayMsgs.map((msg, i) => {
                  const isMine = msg.author?.handle === myHandle
                  const prevMsg = dayMsgs[i - 1]
                  const showAvatar = !isMine && (i === 0 || prevMsg?.author?.handle !== msg.author?.handle)

                  return (
                    <div key={msg.id} className={cn('flex gap-2 mb-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
                      <div className="w-8 flex-shrink-0">
                        {showAvatar && !isMine && (
                          <Avatar className="w-8 h-8">
                            {msg.author?.avatarUrl && <AvatarImage src={msg.author.avatarUrl} alt="" />}
                            <AvatarFallback className="text-xs text-white" style={{ background: 'var(--gradient-avatar)' }}>
                              {(msg.author?.displayName ?? msg.author?.handle ?? '?').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      <div className={cn('max-w-[75%] flex flex-col', isMine ? 'items-end' : 'items-start')}>
                        <MessageBubble
                          msg={msg}
                          isMine={isMine}
                          myPrivateKey={myPrivateKey}
                          partnerPublicKey={partner?.dmPublicKey}
                        />
                        <span className="text-[11px] text-(--color-text-tertiary) mt-0.5 px-1">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center gap-2 py-12 text-(--color-text-tertiary)">
                <p className="text-sm">Henüz mesaj yok.</p>
                <p className="text-xs">İlk mesajı gönder 👋</p>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-(--color-border) px-4 py-3 bg-(--color-background)">
        {isRecording ? (
          /* Recording UI */
          <div className="flex items-center gap-3">
            <button
              onClick={cancelRecording}
              className="w-10 h-10 rounded-full border border-(--color-border-secondary) flex items-center justify-center text-(--color-text-tertiary) hover:bg-(--color-background-secondary) transition-colors flex-shrink-0"
            >
              <MicOff className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div className="flex-1 flex gap-0.5 items-end h-6">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-(--color-coral)/70 rounded-sm animate-pulse"
                    style={{
                      height: `${20 + Math.sin((Date.now() / 200 + i) * 0.8) * 12}%`,
                      animationDelay: `${i * 50}ms`,
                      animationDuration: `${600 + (i % 4) * 150}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-(--color-text-secondary) tabular-nums flex-shrink-0">
                {formatDuration(recordingSeconds)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="w-10 h-10 rounded-full bg-(--color-coral) flex items-center justify-center text-white flex-shrink-0 hover:bg-(--color-coral)/90 transition-colors"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : (
          /* Normal composer */
          <div className="flex items-end gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Mesaj yaz..."
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-(--color-border-secondary) bg-(--color-background-secondary) px-4 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral) transition-colors max-h-32 overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
            />
            {content.trim() ? (
              <button
                onClick={sendMessage}
                disabled={sending}
                className="w-10 h-10 rounded-full bg-(--color-coral) flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:bg-(--color-coral)/90 transition-all"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={isUploading}
                className="w-10 h-10 rounded-full border border-(--color-border-secondary) flex items-center justify-center text-(--color-text-secondary) flex-shrink-0 disabled:opacity-40 hover:bg-(--color-background-secondary) transition-all"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
