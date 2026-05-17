'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type ActorPreferences } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

const DEFAULTS: ActorPreferences = {
  dmEnabled: true, allowReplyFrom: 'everyone', hideLikesCount: false,
  hideReadReceipts: false, defaultVisibility: 'public', filterBots: false,
  hideBoosts: false, minAccountAgeFilter: 0, nsfwMode: 'blur',
  preferredLanguages: [], hideShortVideos: false, usageTimeLimit: 0,
}

const UserPrefsContext = createContext<ActorPreferences>(DEFAULTS)

export function UserPrefsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [prefs, setPrefs] = useState<ActorPreferences>(DEFAULTS)

  useEffect(() => {
    if (!session) return
    api.account.getPreferences()
      .then((p) => setPrefs({ ...DEFAULTS, ...p }))
      .catch(() => {})
  }, [session])

  return <UserPrefsContext.Provider value={prefs}>{children}</UserPrefsContext.Provider>
}

export function useUserPrefs() {
  return useContext(UserPrefsContext)
}
