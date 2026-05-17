import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/plugins'

export const authClient = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  plugins: [twoFactorClient()],
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
