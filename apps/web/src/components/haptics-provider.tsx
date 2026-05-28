'use client'

import { useEffect } from 'react'
import { _setHapticsInstance } from '@/hooks/use-haptics'

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let h: { trigger: (p: string) => Promise<void>; destroy: () => void } | null = null
    let style: HTMLStyleElement | null = null

    import('web-haptics').then(({ WebHaptics }) => {
      h = new WebHaptics({ showSwitch: true })
      style = document.createElement('style')
      style.textContent = `label[for^="web-haptics-"]{position:fixed!important;left:-9999px!important;top:-9999px!important;pointer-events:none!important}`
      document.head.appendChild(style)
      _setHapticsInstance(h)
    }).catch(() => {})

    return () => {
      h?.destroy()
      _setHapticsInstance(null)
      style?.remove()
    }
  }, [])

  return <>{children}</>
}
