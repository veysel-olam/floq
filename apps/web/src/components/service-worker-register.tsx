'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // When a new SW version activates, reload so the open tab picks up the
        // latest app automatically (no manual refresh needed after a deploy).
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'activated' && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
        // Re-check for a new version whenever the tab regains focus.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
        })
      }).catch(() => {})
    }

    if (process.env.NODE_ENV === 'development') {
      const handler = (e: PromiseRejectionEvent) => {
        // Prevent Next.js dev overlay from showing for network-level failures
        e.preventDefault()
        console.warn('[floq unhandledRejection]', e.reason)
      }
      window.addEventListener('unhandledrejection', handler)
      return () => window.removeEventListener('unhandledrejection', handler)
    }
  }, [])

  return null
}
