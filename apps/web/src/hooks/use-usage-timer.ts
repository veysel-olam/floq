'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'floq_usage_start'
const DISMISSED_KEY = 'floq_usage_dismissed_date'

export function useUsageTimer(limitMinutes: number) {
  const [showReminder, setShowReminder] = useState(false)

  useEffect(() => {
    if (limitMinutes <= 0) return

    // Reset timer each new calendar day
    const today = new Date().toDateString()
    const dismissedDate = sessionStorage.getItem(DISMISSED_KEY)
    if (dismissedDate === today) return // already dismissed today

    if (!sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    const interval = setInterval(() => {
      const start = Number(sessionStorage.getItem(STORAGE_KEY) ?? Date.now())
      const elapsedMinutes = (Date.now() - start) / 60000
      if (elapsedMinutes >= limitMinutes) {
        setShowReminder(true)
        clearInterval(interval)
      }
    }, 30000) // check every 30 seconds

    return () => clearInterval(interval)
  }, [limitMinutes])

  function dismiss(stopToday = false) {
    setShowReminder(false)
    if (stopToday) {
      sessionStorage.setItem(DISMISSED_KEY, new Date().toDateString())
    }
  }

  return { showReminder, dismiss }
}
