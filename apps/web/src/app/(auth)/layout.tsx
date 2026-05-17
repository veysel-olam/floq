import Link from 'next/link'
import { FloqLogo } from '@/components/floq-logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--color-background) flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />

      {/* Gradient orbs */}
      <div
        className="pointer-events-none absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-coral) 0%, transparent 65%)', opacity: 0.07 }}
      />
      <div
        className="pointer-events-none absolute -bottom-48 -left-32 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-teal) 0%, transparent 65%)', opacity: 0.05 }}
      />

      <div className="relative z-10 w-full max-w-[400px] space-y-6">

        {/* Logo */}
        <div className="flex justify-center pb-2">
          <Link href="/">
            <FloqLogo size="md" />
          </Link>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-xl shadow-black/[0.06] dark:shadow-black/30 p-8">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-(--color-text-tertiary)">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ActivityPub
          </span>
          <span>·</span>
          <span>Açık Kaynak</span>
          <span>·</span>
          <span>Verilerini sen sahiplen</span>
        </div>
      </div>
    </div>
  )
}
