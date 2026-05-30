// The instance's fediverse domain (e.g. "flq.social"), used for @handle@domain display.
// Prefers the actual host in the browser; falls back to the configured app URL at build time.
export function instanceDomain(): string {
  if (typeof window !== 'undefined') return window.location.host
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').host || 'flq.social'
  } catch {
    return 'flq.social'
  }
}
