'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { RightPanel } from '@/components/layout/right-panel'
import { UserPrefsProvider, useUserPrefs } from '@/lib/user-prefs-context'
import { useUsageTimer } from '@/hooks/use-usage-timer'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Clock, X } from 'lucide-react'

function UsageReminder() {
  const { usageTimeLimit } = useUserPrefs()
  const { showReminder, dismiss } = useUsageTimer(usageTimeLimit)

  if (!showReminder) return null

  const hours = Math.floor(usageTimeLimit / 60)
  const mins = usageTimeLimit % 60
  const label = hours > 0
    ? `${hours} saat${mins > 0 ? ` ${mins} dakika` : ''}`
    : `${mins} dakika`

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
      <div className="rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl shadow-black/10 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-(--color-coral)/10 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-(--color-coral)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-(--color-text-primary)">Mola zamanı</p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5 leading-relaxed">
            floq'ta {label} geçirdin. Bir mola vermek ister misin?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => dismiss(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-(--color-coral) text-white font-medium hover:opacity-90 transition-opacity"
            >
              Bugün hatırlatma
            </button>
            <button
              onClick={() => dismiss(false)}
              className="text-xs px-3 py-1.5 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors"
            >
              Devam et
            </button>
          </div>
        </div>
        <button onClick={() => dismiss(false)} className="flex-shrink-0 text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)

  useKeyboardShortcuts({
    onToggleHelp: () => setShortcutsHelpOpen((v) => !v),
  })

  return (
    <div className="min-h-screen bg-(--color-background) flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-(--color-coral) focus:text-white focus:text-sm focus:font-medium"
      >
        Ana içeriğe geç
      </a>
      <Sidebar />
      <div className="flex-1 ml-16 lg:ml-64 flex min-h-screen">
        <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
          {children}
        </main>
        <RightPanel />
      </div>
      <UsageReminder />
      {shortcutsHelpOpen && <KeyboardShortcutsHelp onClose={() => setShortcutsHelpOpen(false)} />}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserPrefsProvider>
      <TooltipProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </TooltipProvider>
    </UserPrefsProvider>
  )
}
