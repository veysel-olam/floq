import { create } from 'zustand'
import type { MastodonAccount } from './api'

interface AuthState {
  account: MastodonAccount | null
  serverUrl: string | null
  setAccount: (account: MastodonAccount | null) => void
  setServerUrl: (url: string | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  serverUrl: null,
  setAccount: (account) => set({ account }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  clear: () => set({ account: null, serverUrl: null }),
}))
