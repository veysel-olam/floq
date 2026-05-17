'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/lib/auth-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

type EventHandler = (data: unknown) => void

export function useRealtime(handlers: Record<string, EventHandler>) {
  const { data: session } = useSession()
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delay = useRef(RECONNECT_DELAY_MS)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback(() => {
    if (!session) return
    if (esRef.current?.readyState === EventSource.OPEN) return

    const es = new EventSource(`${API_URL}/api/stream`, { withCredentials: true })
    esRef.current = es

    es.addEventListener('connected', () => {
      delay.current = RECONNECT_DELAY_MS
    })

    // Route all named events to handlers
    const proxyHandler = (e: MessageEvent) => {
      const h = handlersRef.current[e.type]
      if (!h) return
      try { h(JSON.parse(e.data as string)) } catch { /* ignore */ }
    }

    Object.keys(handlers).forEach((name) => {
      es.addEventListener(name, proxyHandler)
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      reconnectTimer.current = setTimeout(() => {
        delay.current = Math.min(delay.current * 2, MAX_RECONNECT_DELAY_MS)
        connect()
      }, delay.current)
    }
  }, [session]) // handlers intentionally excluded — use ref

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])
}
