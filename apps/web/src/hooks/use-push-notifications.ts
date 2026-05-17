'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type PushState = 'unsupported' | 'disabled' | 'loading' | 'subscribed' | 'error'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setSubscription(sub)
          setState('subscribed')
        } else {
          setState('disabled')
        }
      })
      .catch(() => setState('disabled'))
  }, [])

  const subscribe = useCallback(async () => {
    setState('loading')
    try {
      const { enabled, publicKey } = await api.push.getVapidKey()
      if (!enabled || !publicKey) { setState('unsupported'); return }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('disabled'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      })

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await api.push.subscribe({ endpoint: json.endpoint, keys: json.keys })
      setSubscription(sub)
      setState('subscribed')
    } catch {
      setState('error')
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    setState('loading')
    try {
      await api.push.unsubscribe(subscription.endpoint)
      await subscription.unsubscribe()
      setSubscription(null)
      setState('disabled')
    } catch {
      setState('error')
    }
  }, [subscription])

  return { state, subscribe, unsubscribe }
}
