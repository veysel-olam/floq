/**
 * Federation-aware fetch wrapper.
 * When FEDERATION_PROXY_URL is set, routes all outgoing AP requests through
 * the configured proxy (HTTP CONNECT or SOCKS5 via Tor for IP protection).
 *
 * Requires `undici` package for proxy support:
 *   pnpm add undici --filter api
 *
 * Without undici installed, falls back to native fetch (no proxy).
 */
import { env } from './env.js'

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>

let _proxyFetch: FetchLike | null = null
let _proxyChecked = false

async function getProxyFetch(): Promise<FetchLike | null> {
  if (_proxyChecked) return _proxyFetch
  _proxyChecked = true

  if (!env.FEDERATION_PROXY_URL) return null

  try {
    // Dynamically import undici — optional dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const undici = await import('undici' as any) as any
    const agent = new undici.ProxyAgent(env.FEDERATION_PROXY_URL)
    _proxyFetch = (url, init) => undici.fetch(url, { ...init, dispatcher: agent }) as unknown as Promise<Response>
    return _proxyFetch
  } catch {
    console.warn('[federation] FEDERATION_PROXY_URL set but undici not installed — falling back to direct fetch. Run: pnpm add undici --filter api')
    return null
  }
}

export async function federationFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxyFetch = await getProxyFetch()
  if (proxyFetch) return proxyFetch(url, init)
  return fetch(url, init)
}
