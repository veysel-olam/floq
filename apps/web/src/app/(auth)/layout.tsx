import Link from 'next/link'
import { FloqLogo } from '@/components/floq-logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--color-background) flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Faint dot grid texture — calm, onboarding-aligned */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] space-y-6">

        {/* Logo */}
        <div className="flex justify-center pb-2">
          <Link href="/">
            <FloqLogo size="md" beta />
          </Link>
        </div>

        {/* Form card — flat & calm */}
        <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) p-8">
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
