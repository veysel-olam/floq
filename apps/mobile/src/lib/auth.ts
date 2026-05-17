import { saveAuth, clearAuth, getToken } from './api'

export interface OAuthApp {
  client_id: string
  client_secret: string
  redirect_uri: string
}

const REDIRECT_URI = 'floq://oauth'
const SCOPES = 'read write follow push'

export async function registerApp(serverUrl: string): Promise<OAuthApp> {
  const res = await fetch(`${serverUrl}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'floq',
      redirect_uris: REDIRECT_URI,
      scopes: SCOPES,
      website: 'https://floq.com',
    }),
  })
  if (!res.ok) throw new Error(`App registration failed: ${res.status}`)
  return res.json() as Promise<OAuthApp>
}

export function buildAuthUrl(serverUrl: string, app: OAuthApp): string {
  const params = new URLSearchParams({
    client_id: app.client_id,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  })
  return `${serverUrl}/oauth/authorize?${params}`
}

export async function exchangeCode(serverUrl: string, app: OAuthApp, code: string): Promise<string> {
  const res = await fetch(`${serverUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: app.client_id,
      client_secret: app.client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
      scope: SCOPES,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  await saveAuth(serverUrl, data.access_token)
  return data.access_token
}

export async function signOut(): Promise<void> {
  await clearAuth()
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken()
  return token !== null
}
