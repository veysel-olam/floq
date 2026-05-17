'use client'

import { useState, useEffect } from 'react'
import { api, type KeywordFilter } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

let cache: KeywordFilter[] | null = null
let fetchPromise: Promise<void> | null = null

export function useKeywordFilters() {
  const { data: session } = useSession()
  const [filters, setFilters] = useState<KeywordFilter[]>(cache ?? [])

  useEffect(() => {
    if (!session) return
    if (cache !== null) { setFilters(cache); return }
    if (!fetchPromise) {
      fetchPromise = api.filters.list()
        .then((data) => { cache = data.filters; setFilters(data.filters) })
        .catch(() => {})
        .finally(() => { fetchPromise = null })
    } else {
      fetchPromise.then(() => { if (cache) setFilters(cache) }).catch(() => {})
    }
  }, [session])

  function invalidate() {
    cache = null
    api.filters.list()
      .then((data) => { cache = data.filters; setFilters(data.filters) })
      .catch(() => {})
  }

  return { filters, invalidate }
}
