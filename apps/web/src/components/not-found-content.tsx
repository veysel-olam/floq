'use client'

import Link from 'next/link'

export function NotFoundContent() {
  return (
    <div className="min-h-screen bg-(--color-background) flex flex-col items-center justify-center px-6 text-center">
      <style>{`
        @keyframes nf-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nf { animation: nf-up 0.5s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <p className="nf text-[11px] font-mono tracking-[0.22em] uppercase text-(--color-text-tertiary) mb-5" style={{ animationDelay: '0ms' }}>
        404
      </p>

      <h1
        className="nf text-2xl font-bold text-(--color-text-primary) mb-2"
        style={{ fontFamily: 'var(--font-outfit)', animationDelay: '60ms' }}
      >
        Bu sayfa yok.
      </h1>

      <p className="nf text-sm text-(--color-text-tertiary) mb-10 max-w-xs leading-relaxed" style={{ animationDelay: '120ms' }}>
        Silinmiş, taşınmış ya da hiç var olmamış olabilir.
      </p>

      <div className="nf flex items-center gap-5" style={{ animationDelay: '180ms' }}>
        <Link href="/home" className="text-sm font-medium text-(--color-coral) hover:opacity-75 transition-opacity">
          Ana akışa dön
        </Link>
        <span className="w-px h-3 bg-(--color-border)" />
        <Link href="/explore" className="text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors">
          Keşfet
        </Link>
      </div>
    </div>
  )
}
