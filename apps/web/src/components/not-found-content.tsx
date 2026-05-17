'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Home, Compass } from 'lucide-react'

// Fake ghost posts for visual texture
const GHOST_POSTS = [
  { w: 'w-32', h: 'h-3', delay: '0ms' },
  { w: 'w-48', h: 'h-3', delay: '150ms' },
  { w: 'w-24', h: 'h-3', delay: '300ms' },
]

export function NotFoundContent() {
  const [t, setT] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let raf: number
    let start: number | null = null
    function tick(ts: number) {
      if (!start) start = ts
      setT((ts - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Signal strength bars — animating to "lost"
  const bars = [1, 0.75, 0.5, 0.25]
  const signalAlive = mounted ? Math.max(0, 1 - t * 0.18) : 1

  // Slow drift for the circles
  const d1 = Math.sin(t * 0.35) * 5
  const d2 = Math.sin(t * 0.35 + 2.09) * 5
  const d3 = Math.sin(t * 0.35 + 4.19) * 5

  return (
    <div className="min-h-screen bg-(--color-background) flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <style>{`
        @keyframes nf-in {
          from { opacity: 0; transform: translateY(14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .nf-in { animation: nf-in 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes ghost-pulse {
          0%, 100% { opacity: 0.06 }
          50%       { opacity: 0.13 }
        }
        .ghost { animation: ghost-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Background: faint network mesh */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
        style={{ opacity: 0.045 }}
      >
        {/* Horizontal lines */}
        {[15, 30, 50, 70, 85].map((y) => (
          <line key={`h${y}`} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="#E8593C" strokeWidth="1" />
        ))}
        {/* Vertical lines */}
        {[10, 25, 40, 60, 75, 90].map((x) => (
          <line key={`v${x}`} x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%" stroke="#E8593C" strokeWidth="1" />
        ))}
        {/* Intersection dots */}
        {[15, 30, 50, 70, 85].flatMap((y) =>
          [10, 25, 40, 60, 75, 90].map((x) => (
            <circle key={`${x}-${y}`} cx={`${x}%`} cy={`${y}%`} r="2" fill="#E8593C" />
          ))
        )}
      </svg>

      {/* Ghost post cards — faint background texture */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {[
          { top: '12%', left: '5%', rotate: '-3deg' },
          { top: '22%', right: '4%', rotate: '2deg' },
          { top: '65%', left: '3%', rotate: '-1.5deg' },
          { top: '72%', right: '5%', rotate: '3deg' },
        ].map((pos, i) => (
          <div
            key={i}
            className="ghost absolute w-48 rounded-2xl border border-(--color-coral)/20 bg-(--color-coral)/5 p-3 space-y-2"
            style={{ top: pos.top, left: pos.left, right: (pos as { right?: string }).right, transform: `rotate(${pos.rotate})`, animationDelay: `${i * 700}ms` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-(--color-coral)/20" />
              <div className="h-2 rounded-full bg-(--color-coral)/15 flex-1" />
            </div>
            {GHOST_POSTS.map((p, j) => (
              <div key={j} className={`${p.w} ${p.h} rounded-full bg-(--color-coral)/10`} style={{ animationDelay: p.delay }} />
            ))}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Disconnecting circles — logo motif */}
        <div
          className="relative mb-8 nf-in"
          style={{ animationDelay: '0ms', width: 96, height: 56 }}
          aria-hidden
        >
          <div className="absolute w-12 h-12 rounded-full border-2 border-(--color-coral) opacity-60"
            style={{ left: `${d1}px`, top: 4, boxShadow: '0 0 12px #E8593C33' }} />
          <div className="absolute w-12 h-12 rounded-full border-2 border-(--color-coral) opacity-35"
            style={{ left: `${28 + d2 * 1.4}px`, top: 4 }} />
          <div className="absolute w-12 h-12 rounded-full border-2 border-(--color-coral) opacity-18"
            style={{ left: `${56 + d3 * 2}px`, top: 4 }} />
        </div>

        {/* Signal bars — fading out */}
        <div className="flex items-end gap-1 mb-8 nf-in" style={{ animationDelay: '40ms' }} aria-hidden>
          {bars.map((threshold, i) => (
            <div
              key={i}
              className="rounded-sm transition-all duration-300"
              style={{
                width: 5,
                height: 6 + i * 5,
                background: '#E8593C',
                opacity: signalAlive >= threshold ? 0.7 - i * 0.08 : 0.1,
              }}
            />
          ))}
          <span className="ml-2 text-[10px] font-mono text-(--color-text-tertiary) mb-0.5">
            {signalAlive > 0.01 ? 'bağlanıyor...' : 'sinyal yok'}
          </span>
        </div>

        {/* 404 */}
        <div
          className="text-[7.5rem] sm:text-[10rem] font-bold leading-none tracking-tight select-none nf-in"
          style={{
            fontFamily: 'var(--font-outfit)',
            animationDelay: '80ms',
            background: 'linear-gradient(135deg, #D44A2E 0%, #E8593C 35%, #F2845C 65%, #FAE4DC 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 2px 24px #E8593C22)',
          }}
        >
          404
        </div>

        {/* Text */}
        <h1
          className="text-xl sm:text-2xl font-semibold text-(--color-text-primary) text-center mt-3 mb-2 nf-in"
          style={{ fontFamily: 'var(--font-outfit)', animationDelay: '140ms' }}
        >
          Bu düğüm ağda yok
        </h1>
        <p
          className="text-sm text-(--color-text-tertiary) text-center max-w-[300px] leading-relaxed mb-10 nf-in"
          style={{ animationDelay: '200ms' }}
        >
          Silinmiş, taşınmış ya da hiç var olmamış olabilir.
          Ama ağın geri kalanı hâlâ burada.
        </p>

        {/* Actions */}
        <div
          className="flex items-center gap-6 nf-in"
          style={{ animationDelay: '260ms' }}
        >
          <Link
            href="/home"
            className="flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-coral) transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Ana akış
          </Link>
          <span className="w-px h-3 bg-(--color-border)" />
          <Link
            href="/explore"
            className="flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-coral) transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            Keşfet
          </Link>
        </div>
      </div>
    </div>
  )
}
