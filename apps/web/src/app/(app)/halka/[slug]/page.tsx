'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type HalkaInfo, type HalkaPeer } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Loader2, Mic, MicOff, Radio, ArrowLeft, Square, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

function PeerTile({ peer, isSelf, muted }: { peer: HalkaPeer; isSelf?: boolean; muted?: boolean }) {
  const initials = (peer.displayName ?? peer.handle).slice(0, 2).toUpperCase()
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className={cn('w-16 h-16 ring-2 ring-offset-2 ring-offset-(--color-background)', isSelf ? 'ring-(--color-coral)' : 'ring-transparent')}>
          {peer.avatarUrl && <AvatarImage src={peer.avatarUrl} />}
          <AvatarFallback
            className="text-lg font-semibold text-white"
            style={{ background: 'var(--gradient-avatar)' }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        {isSelf && (
          <div className={cn(
            'absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-(--color-background) flex items-center justify-center',
            muted ? 'bg-(--color-background-secondary)' : 'bg-(--color-coral)',
          )}>
            {muted
              ? <MicOff className="w-3 h-3 text-(--color-text-tertiary)" />
              : <Mic className="w-3 h-3 text-white" />}
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-(--color-text-primary) truncate max-w-[72px]">
          {peer.displayName ?? peer.handle}
        </p>
        {isSelf && <p className="text-[10px] text-(--color-text-tertiary)">Sen</p>}
      </div>
    </div>
  )
}

export default function HalkaRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [halka, setHalka] = useState<HalkaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [peers, setPeers] = useState<HalkaPeer[]>([])
  const [muted, setMuted] = useState(false)

  const myActorId = useRef<string | null>(null)
  const localStream = useRef<MediaStream | null>(null)
  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const audioEls = useRef(new Map<string, HTMLAudioElement>())

  const userHandle = (session?.user as { handle?: string } | undefined)?.handle

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return

    let active = true
    let es: EventSource | null = null

    function getOrCreatePC(actorId: string): RTCPeerConnection {
      if (pcs.current.has(actorId)) return pcs.current.get(actorId)!

      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcs.current.set(actorId, pc)

      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!)
      })

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && active) {
          void api.halka.signal(slug, actorId, { type: 'ice-candidate', candidate: candidate.toJSON() })
        }
      }

      pc.ontrack = ({ streams }) => {
        const stream = streams[0]
        if (!stream) return
        let audio = audioEls.current.get(actorId)
        if (!audio) {
          audio = new Audio()
          audio.autoplay = true
          audioEls.current.set(actorId, audio)
        }
        audio.srcObject = stream
      }

      return pc
    }

    async function handleSignal(
      from: string,
      payload: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit },
    ) {
      if (payload.type === 'offer') {
        const pc = getOrCreatePC(from)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await api.halka.signal(slug, from, { type: 'answer', sdp: answer })
      } else if (payload.type === 'answer') {
        const pc = pcs.current.get(from)
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!))
      } else if (payload.type === 'ice-candidate') {
        const pc = pcs.current.get(from)
        if (pc && payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
      }
    }

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        localStream.current = stream

        const data = await api.halka.get(slug)
        if (!active) return
        setHalka(data)
        setLoading(false)

        es = new EventSource(`${API_URL}/api/halka/${slug}/stream`, { withCredentials: true })

        es.addEventListener('connected', (e) => {
          const { myActorId: myId, participants } = JSON.parse(e.data as string) as {
            myActorId: string
            participants: HalkaPeer[]
          }
          myActorId.current = myId
          setPeers(participants)

          // Offer to all existing participants
          participants.forEach((peer) => {
            const pc = getOrCreatePC(peer.actorId)
            void (async () => {
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              await api.halka.signal(slug, peer.actorId, { type: 'offer', sdp: offer })
            })()
          })
        })

        es.addEventListener('peer-joined', (e) => {
          const peer = JSON.parse(e.data as string) as HalkaPeer
          if (peer.actorId === myActorId.current) return
          setPeers((prev) => [...prev.filter((p) => p.actorId !== peer.actorId), peer])
        })

        es.addEventListener('peer-left', (e) => {
          const { actorId } = JSON.parse(e.data as string) as { actorId: string }
          setPeers((prev) => prev.filter((p) => p.actorId !== actorId))
          const pc = pcs.current.get(actorId)
          if (pc) { pc.close(); pcs.current.delete(actorId) }
          const audio = audioEls.current.get(actorId)
          if (audio) { audio.srcObject = null; audioEls.current.delete(actorId) }
        })

        es.addEventListener('signal', (e) => {
          const { from, to, payload } = JSON.parse(e.data as string) as {
            from: string
            to: string
            payload: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
          }
          if (to !== myActorId.current) return
          void handleSignal(from, payload)
        })

        es.addEventListener('halka-ended', () => {
          router.push('/halka')
        })

      } catch (err) {
        if (!active) return
        const name = (err as Error).name
        setError(
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin ver.'
            : 'Odaya bağlanılamadı.',
        )
        setLoading(false)
      }
    }

    void init()

    return () => {
      active = false
      es?.close()
      localStream.current?.getTracks().forEach((t) => t.stop())
      pcs.current.forEach((pc) => pc.close())
      pcs.current.clear()
      audioEls.current.forEach((a) => { a.srcObject = null })
      audioEls.current.clear()
    }
  }, [isPending, session, slug, router])

  function toggleMute() {
    if (!localStream.current) return
    const newMuted = !muted
    localStream.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    setMuted(newMuted)
  }

  async function endHalka() {
    await api.halka.end(slug)
    router.push('/halka')
  }

  if (isPending || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
        {!error && <p className="text-sm text-(--color-text-tertiary)">Mikrofona bağlanılıyor…</p>}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <MicOff className="w-10 h-10 text-(--color-text-tertiary) mx-auto mb-4" />
        <p className="text-sm text-red-500 mb-6">{error}</p>
        <Link href="/halka">
          <Button variant="outline">Geri Dön</Button>
        </Link>
      </div>
    )
  }

  if (!halka) return null

  const isHost = halka.host.handle === userHandle

  const selfPeer: HalkaPeer = {
    actorId: myActorId.current ?? 'self',
    handle: userHandle ?? '',
    displayName: (session?.user as { name?: string } | undefined)?.name ?? null,
    avatarUrl: (session?.user as { image?: string } | undefined)?.image ?? null,
  }

  const allPeers = [selfPeer, ...peers]

  return (
    <div className="max-w-xl mx-auto flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <header className="flex-shrink-0 bg-(--color-background) border-b border-(--color-border) px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/halka" className="text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                {halka.title}
              </p>
              {halka.isLive && (
                <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500">
                  <Radio className="w-2.5 h-2.5" />CANLI
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
              <span>@{halka.host.handle}</span>
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />{allPeers.length}
              </span>
            </div>
          </div>
          {isHost && halka.isLive && (
            <Button size="sm" variant="ghost" onClick={endHalka} className="text-red-500 hover:bg-red-500/10 gap-1">
              <Square className="w-3 h-3 fill-current" />Bitir
            </Button>
          )}
        </div>
      </header>

      {/* Participants */}
      <div className="flex-1 px-6 py-10">
        {halka.description && (
          <p className="text-sm text-(--color-text-secondary) text-center mb-8 leading-relaxed">
            {halka.description}
          </p>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-8 justify-items-center">
          {allPeers.map((peer, i) => (
            <PeerTile
              key={peer.actorId}
              peer={peer}
              isSelf={i === 0}
              muted={i === 0 ? muted : undefined}
            />
          ))}
        </div>
        {allPeers.length === 1 && (
          <p className="text-center text-sm text-(--color-text-tertiary) mt-12">
            Henüz kimse yok. Birileri katılınca ses bağlantısı kurulacak.
          </p>
        )}
      </div>

      {/* Controls */}
      {halka.isLive && (
        <div className="flex-shrink-0 border-t border-(--color-border) px-4 py-5 bg-(--color-background)">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              className={cn(
                'flex flex-col items-center gap-2 px-6 py-3.5 rounded-2xl transition-colors',
                muted
                  ? 'bg-(--color-background-secondary) text-(--color-text-secondary)'
                  : 'bg-(--color-coral)/10 text-(--color-coral)',
              )}
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              <span className="text-xs font-medium">{muted ? 'Sessiz' : 'Mikrofon'}</span>
            </button>
            <Link href="/halka">
              <button className="flex flex-col items-center gap-2 px-6 py-3.5 rounded-2xl bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <ArrowLeft className="w-6 h-6" />
                <span className="text-xs font-medium">Ayrıl</span>
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
