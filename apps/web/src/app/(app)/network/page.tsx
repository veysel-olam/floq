'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type SocialStats, type PulseData, type NetworkNode, type NetworkEdge } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Loader2, UserMinus, UserCheck, UserPlus, Clock, Globe, Share2, ArrowRight, Plus, Minus, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-haptics'

// ─── Types ───────────────────────────────────────────────────────────────────

type MiniActor = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; isLocal: boolean }
type Tab = 'unfollowers' | 'notFollowingBack' | 'notFollowedBack' | 'recentFollowers'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'bugün'
  if (days === 1) return 'dün'
  if (days < 7) return `${days} gün önce`
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`
  return `${Math.floor(days / 30)} ay önce`
}

// ─── Network Canvas ──────────────────────────────────────────────────────────

interface PositionedNode extends NetworkNode { x: number; y: number; r: number }

function computeLayout(nodes: NetworkNode[], W: number, H: number): PositionedNode[] {
  if (nodes.length === 0) return []
  const self = nodes.find((n) => n.isSelf)
  const others = nodes.filter((n) => !n.isSelf)
    .sort((a, b) => b.followersCount - a.followersCount)
    .slice(0, 28)
  const cx = W / 2
  const cy = H / 2
  const result: PositionedNode[] = []
  if (self) result.push({ ...self, x: cx, y: cy, r: 24 })
  // Scale so the outermost ring (radius 188) fits within the canvas with 20px margin
  const scale = Math.min(cx, cy) / (188 + 20)
  const RINGS = [
    { count: 7,  radius: 88 * scale,  nodeR: 16 },
    { count: 12, radius: 142 * scale, nodeR: 13 },
    { count: 9,  radius: 188 * scale, nodeR: 11 },
  ]
  let idx = 0
  for (const ring of RINGS) {
    const take = Math.min(ring.count, others.length - idx)
    if (take <= 0) break
    for (let i = 0; i < take; i++) {
      const node = others[idx++]!
      const angle = (i / take) * 2 * Math.PI - Math.PI / 2 + (ring.radius > 120 ? 0.18 : 0)
      result.push({ ...node, x: cx + ring.radius * Math.cos(angle), y: cy + ring.radius * Math.sin(angle), r: ring.nodeR })
    }
  }
  return result
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 0.3

function NetworkCanvas({ nodes: rawNodes, edges, hoveredId, onHover }: {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  hoveredId: string | null
  onHover: (id: string | null) => void
}) {
  const W = 560
  const H = 420

  // viewBox state: [x, y, w, h]
  const [vb, setVb] = useState({ x: 0, y: 0, w: W, h: H })
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null)
  // pinch tracking
  const lastPinchDist = useRef<number | null>(null)

  const positioned = useMemo(() => computeLayout(rawNodes, W, H), [rawNodes])
  const posMap = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned])

  const mutualSet = useMemo(() => {
    const fwd = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!fwd.has(e.source)) fwd.set(e.source, new Set())
      fwd.get(e.source)!.add(e.target)
    }
    const self = rawNodes.find((n) => n.isSelf)
    const set = new Set<string>()
    if (self) {
      for (const n of rawNodes) {
        if (!n.isSelf && fwd.get(n.id)?.has(self.id) && fwd.get(self.id)?.has(n.id)) set.add(n.id)
      }
    }
    return set
  }, [edges, rawNodes])

  const visibleEdges = useMemo(() => edges.filter((e) => posMap.has(e.source) && posMap.has(e.target)), [edges, posMap])
  const self = positioned.find((n) => n.isSelf)
  const zoom = W / vb.w  // current zoom level

  // ── Pan boundary: viewBox can't stray more than half its size outside the canvas ──
  function clampVb(next: { x: number; y: number; w: number; h: number }) {
    const margin = 0.5  // allow panning up to 50% of viewBox size outside canvas
    const minX = -next.w * margin
    const maxX = W - next.w * (1 - margin)
    const minY = -next.h * margin
    const maxY = H - next.h * (1 - margin)
    return {
      ...next,
      x: Math.max(minX, Math.min(maxX, next.x)),
      y: Math.max(minY, Math.min(maxY, next.y)),
    }
  }

  // ── Zoom helper (zoom toward a point in SVG coords) ─────────────
  function zoomAt(svgX: number, svgY: number, factor: number) {
    setVb((prev) => {
      const newW = Math.min(W / ZOOM_MIN, Math.max(W / ZOOM_MAX, prev.w / factor))
      const newH = Math.min(H / ZOOM_MIN, Math.max(H / ZOOM_MAX, prev.h / factor))
      const newX = svgX - (svgX - prev.x) * (newW / prev.w)
      const newY = svgY - (svgY - prev.y) * (newH / prev.h)
      return clampVb({ x: newX, y: newY, w: newW, h: newH })
    })
  }

  function resetView() { setVb({ x: 0, y: 0, w: W, h: H }) }

  // ── Mouse wheel zoom ─────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      // convert screen point to SVG coords
      const curVb = vbRef.current
      const svgX = curVb.x + ((e.clientX - rect.left) / rect.width) * curVb.w
      const svgY = curVb.y + ((e.clientY - rect.top) / rect.height) * curVb.h
      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP)
      zoomAtRef.current(svgX, svgY, factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep refs in sync so wheel handler always has fresh values
  const vbRef = useRef(vb)
  useEffect(() => { vbRef.current = vb }, [vb])
  const zoomAtRef = useRef(zoomAt)
  useEffect(() => { zoomAtRef.current = zoomAt }, [vb])

  // ── Mouse drag pan ───────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, vbX: vb.x, vbY: vb.y }
  }
  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = ((e.clientX - drag.startX) / rect.width) * vb.w
    const dy = ((e.clientY - drag.startY) / rect.height) * vb.h
    setVb((prev) => clampVb({ ...prev, x: drag.vbX - dx, y: drag.vbY - dy }))
  }
  function onMouseUp() { dragRef.current = null }

  // ── Touch pinch-to-zoom + pan ────────────────────────────────────
  function onTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      lastPinchDist.current = Math.hypot(dx, dy)
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0]!.clientX, startY: e.touches[0]!.clientY, vbX: vb.x, vbY: vb.y }
    }
  }
  function onTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    e.preventDefault()
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      const dist = Math.hypot(dx, dy)
      const factor = dist / lastPinchDist.current
      lastPinchDist.current = dist
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const midClientX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2
      const midClientY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2
      const svgX = vb.x + ((midClientX - rect.left) / rect.width) * vb.w
      const svgY = vb.y + ((midClientY - rect.top) / rect.height) * vb.h
      zoomAt(svgX, svgY, factor)
    } else if (e.touches.length === 1 && dragRef.current) {
      const drag = dragRef.current
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = ((e.touches[0]!.clientX - drag.startX) / rect.width) * vb.w
      const dy = ((e.touches[0]!.clientY - drag.startY) / rect.height) * vb.h
      setVb((prev) => clampVb({ ...prev, x: drag.vbX - dx, y: drag.vbY - dy }))
    }
  }
  function onTouchEnd() { dragRef.current = null; lastPinchDist.current = null }

  // Button zoom (toward center)
  function zoomIn()  { zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 + ZOOM_STEP) }
  function zoomOut() { zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / (1 + ZOOM_STEP)) }

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full"
        style={{ height: 380, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-hidden
      >
        <defs>
          <radialGradient id="ng-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-coral)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-coral)" stopOpacity="0" />
          </radialGradient>
          <pattern id="ng-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="currentColor" className="text-(--color-border)" fillOpacity="0.5" />
          </pattern>
          <filter id="ng-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {positioned.map((n) => (
            <clipPath key={`ng-clip-${n.id}`} id={`ng-clip-${n.id}`}>
              <circle cx={n.x} cy={n.y} r={n.r - 1} />
            </clipPath>
          ))}
        </defs>

        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#ng-dots)" />
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#ng-bg)" />

        {/* Orbit rings */}
        {self && [88, 142, 188].map((r, i) => {
          const s = Math.min(self.x, self.y) / (188 + 20)
          return (
            <circle key={i} cx={self.x} cy={self.y} r={r * s}
              fill="none" stroke="var(--color-border)" strokeWidth={0.5 / zoom}
              strokeDasharray={`${3 / zoom} ${7 / zoom}`} opacity={0.35} />
          )
        })}

        {/* Edges */}
        {visibleEdges.map((e, i) => {
          const s = posMap.get(e.source)!
          const t = posMap.get(e.target)!
          const hi = hoveredId === e.source || hoveredId === e.target
          const mutual = mutualSet.has(e.source) || mutualSet.has(e.target)
          return (
            <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={mutual ? 'var(--color-teal)' : 'var(--color-coral)'}
              strokeWidth={(hi ? 1.3 : 0.6) / zoom}
              opacity={hi ? 0.6 : mutual ? 0.2 : 0.1}
              style={{ transition: 'opacity 0.18s' }}
            />
          )
        })}

        {/* Nodes */}
        {positioned.map((node) => {
          const hovered = hoveredId === node.id
          const mutual = mutualSet.has(node.id)
          const ring = node.isSelf ? 'var(--color-coral)' : mutual ? 'var(--color-teal)' : 'var(--color-border)'
          return (
            <g key={node.id}
              style={{ cursor: 'pointer', transform: hovered && !node.isSelf ? `scale(1.18)` : 'scale(1)', transformOrigin: `${node.x}px ${node.y}px`, transition: 'transform 0.15s ease' }}
              onMouseEnter={(e) => { e.stopPropagation(); onHover(node.id) }}
              onMouseLeave={(e) => { e.stopPropagation(); onHover(null) }}
              onClick={(e) => { if (!dragRef.current) { e.stopPropagation(); window.location.href = `/${node.handle}` } }}
            >
              {node.isSelf && (
                <circle cx={node.x} cy={node.y} r={node.r + 7} fill="var(--color-coral)" opacity={0.1} filter="url(#ng-glow)" />
              )}
              <circle cx={node.x} cy={node.y} r={node.r}
                fill="var(--color-background-secondary)"
                stroke={ring}
                strokeWidth={(node.isSelf ? 2.5 : hovered ? 2 : 1.5) / zoom}
              />
              {node.avatarUrl ? (
                <image href={node.avatarUrl}
                  x={node.x - node.r + 1} y={node.y - node.r + 1}
                  width={(node.r - 1) * 2} height={(node.r - 1) * 2}
                  clipPath={`url(#ng-clip-${node.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={node.r * 0.72} fontWeight="600"
                  fill={node.isSelf ? 'var(--color-coral)' : 'var(--color-text-tertiary)'}
                >
                  {(node.displayName ?? node.handle).slice(0, node.isSelf ? 2 : 1).toUpperCase()}
                </text>
              )}
              {mutual && !node.isSelf && (
                <circle cx={node.x + node.r * 0.68} cy={node.y - node.r * 0.68} r={node.r * 0.32} fill="var(--color-teal)" />
              )}
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hoveredId && (() => {
          const n = posMap.get(hoveredId)
          if (!n || n.isSelf) return null
          const label = n.displayName ?? n.handle
          const lx = n.x
          const ly = n.y + n.r + 14 / zoom
          const tw = (label.length * 6.8 + 16) / zoom
          const th = 16 / zoom
          const fs = 10 / zoom
          return (
            <g pointerEvents="none">
              <rect x={lx - tw / 2} y={ly - th * 0.65} width={tw} height={th} rx={5 / zoom} fill="var(--color-background)" opacity={0.94} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                fontSize={fs} fontWeight="500" fill="var(--color-text-primary)"
              >{label}</text>
            </g>
          )
        })()}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-10 right-3 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="w-7 h-7 rounded-lg bg-(--color-background)/90 border border-(--color-border) shadow-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-coral) hover:border-(--color-coral)/40 transition-colors disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="w-7 h-7 rounded-lg bg-(--color-background)/90 border border-(--color-border) shadow-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-coral) hover:border-(--color-coral)/40 transition-colors disabled:opacity-30"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        {(zoom !== 1 || vb.x !== 0 || vb.y !== 0) && (
          <button
            onClick={resetView}
            className="w-7 h-7 rounded-lg bg-(--color-background)/90 border border-(--color-border) shadow-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-coral) hover:border-(--color-coral)/40 transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Zoom level badge */}
      {zoom !== 1 && (
        <div className="absolute bottom-10 left-3 text-[10px] text-(--color-text-tertiary) bg-(--color-background)/80 px-1.5 py-0.5 rounded-md border border-(--color-border) tabular-nums">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  )
}

// ─── Stat Tab ────────────────────────────────────────────────────────────────

function StatTab({ icon, label, value, color, bg, active, onClick }: {
  icon: React.ReactNode; label: string; value: number
  color: string; bg: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-all relative',
        active ? color : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
      )}
    >
      <span className={cn('flex items-center gap-1.5', active ? color : '')}>
        {icon}
        <span className="font-bold tabular-nums">{value}</span>
      </span>
      <span className={cn('hidden sm:inline text-[11px] font-medium', active ? color : 'text-(--color-text-tertiary)')}>
        {label}
      </span>
      {active && (
        <span className={cn('absolute bottom-0 left-3 right-3 h-0.5 rounded-full', color.replace('text-', 'bg-'))} />
      )}
    </button>
  )
}

// ─── Actor Card ──────────────────────────────────────────────────────────────

function ActorCard({ actor, meta, action, accent }: {
  actor: MiniActor; meta?: string; action?: React.ReactNode; accent?: string
}) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/50 transition-colors group">
      <Link href={`/${actor.handle}`} className="relative flex-shrink-0">
        <Avatar className="w-10 h-10">
          {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
          <AvatarFallback className="text-sm font-semibold text-white" style={{ background: 'var(--gradient-avatar)' }}>{initials}</AvatarFallback>
        </Avatar>
        {accent && <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-(--color-background)', accent)} />}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href={`/${actor.handle}`}
            className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-coral) transition-colors"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {actor.displayName ?? actor.handle}
          </Link>
          {!actor.isLocal && <Globe className="w-3 h-3 text-(--color-teal) flex-shrink-0" />}
        </div>
        <p className="text-xs text-(--color-text-tertiary) leading-tight truncate">
          @{actor.handle}{meta ? <> · {meta}</> : null}
        </p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ─── Follow Button ───────────────────────────────────────────────────────────

function FollowButton({ handle, initialFollowing = false }: { handle: string; initialFollowing?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>(initialFollowing ? 'done' : 'idle')
  async function follow() {
    setState('loading')
    try { await api.actors.follow(handle); triggerHaptic('medium'); setState('done') }
    catch { setState('idle') }
  }
  if (state === 'done') return (
    <span className="text-xs text-(--color-teal) font-semibold flex items-center gap-1">
      <UserCheck className="w-3.5 h-3.5" />Takip ediliyor
    </span>
  )
  return (
    <Button size="sm" onClick={follow} disabled={state === 'loading'}
      className="text-xs px-4 rounded-full h-8 bg-(--color-coral) hover:opacity-90 text-white border-0 font-semibold">
      {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3 mr-1.5" />Takip et</>}
    </Button>
  )
}

// ─── Health score ────────────────────────────────────────────────────────────

function computeHealth(stats: SocialStats, pulse: PulseData | null) {
  let score = 80
  score -= Math.min(stats.counts.unfollowers * 4, 25)
  if (stats.counts.notFollowingBack > 15) score -= 12
  else if (stats.counts.notFollowingBack > 7) score -= 6
  score += Math.min(stats.recentFollowers.length * 3, 18)
  if (pulse) {
    const { done, failed, pending } = pulse.globalStats.deliveries
    const total = done + failed + pending
    if (total > 0 && (done / total) < 0.8) score -= 10
  }
  score = Math.max(10, Math.min(100, score))
  return {
    score,
    label: score >= 80 ? 'Sağlıklı' : score >= 60 ? 'Dengeli' : 'Dikkat',
    textColor: score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500',
    bg: score >= 80 ? 'bg-green-500/10' : score >= 60 ? 'bg-amber-500/10' : 'bg-red-500/10',
  }
}

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'unfollowers' as Tab,       shortLabel: 'Çıkanlar',      label: 'Takipten çıkanlar',     icon: <UserMinus className="w-3.5 h-3.5" />, color: 'text-red-500',         bg: 'bg-red-500/10',         accent: 'bg-red-500' },
  { id: 'notFollowingBack' as Tab,  shortLabel: 'Geri almıyor',  label: 'Geri takip etmeyenler', icon: <UserCheck className="w-3.5 h-3.5" />, color: 'text-amber-500',       bg: 'bg-amber-500/10',       accent: 'bg-amber-500' },
  { id: 'notFollowedBack' as Tab,   shortLabel: 'Bekleyenler',   label: 'Sen takip etmiyorsun',  icon: <UserPlus className="w-3.5 h-3.5" />,  color: 'text-(--color-teal)',  bg: 'bg-(--color-teal)/10', accent: 'bg-(--color-teal)' },
  { id: 'recentFollowers' as Tab,   shortLabel: 'Yeniler',       label: 'Son takipçiler',         icon: <Clock className="w-3.5 h-3.5" />,     color: 'text-(--color-coral)', bg: 'bg-(--color-coral)/10',accent: 'bg-(--color-coral)' },
]

// ─── Empty state ─────────────────────────────────────────────────────────────

const EMPTY: Record<Tab, { title: string; body: string }> = {
  unfollowers:      { title: 'Kimse takipten çıkmamış',   body: 'Son 90 gün içinde herkes yerli yerinde.' },
  notFollowingBack: { title: 'Herkes geri takip ediyor',  body: 'Takip ettiğin herkes seni de takip ediyor.' },
  notFollowedBack:  { title: 'Hepsini takip ediyorsun',   body: 'Seni takip edenlerin hepsini zaten takip ediyorsun.' },
  recentFollowers:  { title: 'Henüz yeni takipçin yok',   body: 'Biri seni takip ettiğinde burada görünür.' },
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [stats, setStats] = useState<SocialStats | null>(null)
  const [pulse, setPulse] = useState<PulseData | null>(null)
  const [graphNodes, setGraphNodes] = useState<NetworkNode[]>([])
  const [graphEdges, setGraphEdges] = useState<NetworkEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('recentFollowers')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const onHover = useCallback((id: string | null) => setHoveredId(id), [])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    Promise.all([
      api.actors.socialStats(),
      api.actors.network(),
      api.pulse.get().catch(() => null),
    ])
      .then(([social, graph, p]) => {
        setStats(social)
        setGraphNodes(graph.nodes)
        setGraphEdges(graph.edges)
        setPulse(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isPending, session, router])

  const health = stats ? computeHealth(stats, pulse) : null
  const counts = {
    unfollowers:      stats?.counts.unfollowers ?? 0,
    notFollowingBack: stats?.counts.notFollowingBack ?? 0,
    notFollowedBack:  stats?.counts.notFollowedBack ?? 0,
    recentFollowers:  stats?.recentFollowers.length ?? 0,
  }
  const currentTab = TABS.find((t) => t.id === tab)!

  function renderList() {
    if (!stats) return null
    switch (tab) {
      case 'unfollowers':      return stats.unfollowers.map(({ actor, unfollowedAt }) => <ActorCard key={actor.id} actor={actor} meta={formatRelative(unfollowedAt)} accent={currentTab.accent} />)
      case 'notFollowingBack': return stats.notFollowingBack.map((actor) => <ActorCard key={actor.id} actor={actor} accent={currentTab.accent} />)
      case 'notFollowedBack':  return stats.notFollowedBack.map((actor) => <ActorCard key={actor.id} actor={actor} action={<FollowButton handle={actor.handle} />} accent={currentTab.accent} />)
      case 'recentFollowers':  return stats.recentFollowers.map(({ actor, followedAt, isFollowing }) => <ActorCard key={actor.id} actor={actor} meta={formatRelative(followedAt)} action={<FollowButton handle={actor.handle} initialFollowing={isFollowing} />} accent={currentTab.accent} />)
    }
  }

  const listContent = renderList()
  const isEmpty = !loading && stats && listContent?.length === 0

  return (
    <div className="max-w-xl mx-auto">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-xl border-b border-(--color-border-secondary) px-4 h-14 flex items-center gap-2.5">
        <Share2 className="w-4.5 h-4.5 text-(--color-coral) flex-shrink-0" />
        <h1 className="text-[15px] font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Ağ Haritası</h1>
        {health && !loading && (
          <span className={cn('ml-auto text-xs font-semibold px-2.5 py-1 rounded-full', health.textColor, health.bg)}>
            {health.label} · {health.score}
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : (
        <>
          {/* ── Network canvas ────────────────────────────────────── */}
          <div className="relative overflow-hidden border-b border-(--color-border-secondary)">
            {/* Subtle gradient bg behind graph */}
            <div className="absolute inset-0 bg-gradient-to-b from-(--color-background-secondary)/30 via-transparent to-transparent pointer-events-none" />

            <NetworkCanvas nodes={graphNodes} edges={graphEdges} hoveredId={hoveredId} onHover={onHover} />

            {/* Stats strip overlaid at bottom of graph */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-t from-(--color-background)/90 via-(--color-background)/60 to-transparent">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-(--color-teal) inline-block" />
                  <span className="text-[10px] text-(--color-text-secondary)">Karşılıklı</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-(--color-coral)/60 inline-block" />
                  <span className="text-[10px] text-(--color-text-secondary)">Tek yön</span>
                </div>
                {(pulse?.connections.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-(--color-teal)" />
                    <span className="text-[10px] text-(--color-text-secondary)">{pulse!.connections.length} federe</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-(--color-text-tertiary) tabular-nums">
                {graphNodes.length} kişi · {graphEdges.length} bağlantı
              </span>
            </div>
          </div>

          {/* ── Stat tabs ────────────────────────────────────────── */}
          <div className="flex border-b border-(--color-border-secondary)">
            {TABS.map((t) => (
              <StatTab
                key={t.id}
                icon={t.icon}
                label={t.shortLabel}
                value={counts[t.id]}
                color={t.color}
                bg={t.bg}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
              />
            ))}
          </div>

          {/* ── Section header ───────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
            <div className={cn('flex items-center gap-2', currentTab.color)}>
              {currentTab.icon}
              <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>{currentTab.label}</span>
              {counts[tab] > 0 && (
                <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums', currentTab.bg, currentTab.color)}>
                  {counts[tab]}
                </span>
              )}
            </div>
            {tab === 'notFollowedBack' && !isEmpty && (
              <Link href="/explore" className="text-xs text-(--color-coral) font-medium flex items-center gap-0.5 hover:opacity-75 transition-opacity">
                Keşfet <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* ── List ─────────────────────────────────────────────── */}
          {isEmpty ? (
            <div className="flex flex-col items-center gap-4 py-14 px-8 text-center">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', currentTab.bg)}>
                <span className={cn('[&>svg]:w-6 [&>svg]:h-6', currentTab.color)}>{currentTab.icon}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {EMPTY[tab].title}
                </p>
                <p className="text-xs text-(--color-text-secondary) mt-1.5 max-w-[220px] leading-relaxed">{EMPTY[tab].body}</p>
              </div>
              {tab === 'notFollowedBack' && (
                <Link href="/explore" className="text-xs font-semibold text-(--color-coral) hover:opacity-75 transition-opacity flex items-center gap-1">
                  Yeni kişiler keşfet <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="pb-8">{listContent}</div>
          )}
        </>
      )}
    </div>
  )
}
