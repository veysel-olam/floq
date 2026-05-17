'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
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
