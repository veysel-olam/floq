import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // App
  APP_DOMAIN: z.string().default('localhost:3001'),
  APP_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Crypto — master key for encrypting actor private keys (32 bytes hex)
  ENCRYPTION_KEY: z.string().length(64),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),

  // MinIO / S3
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('floq-media'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_REGION: z.string().default('us-east-1'),
  S3_PUBLIC_URL: z.string().url().default('http://localhost:9000/floq-media'),

  // Monitoring (optional)
  SENTRY_DSN: z.string().url().optional(),

  // Klipy GIF search (optional — if unset, GIF search is disabled)
  // Tenor API is shutting down June 2026 — use Klipy instead: https://klipy.com
  KLIPY_API_KEY: z.string().optional(),

  // Web Push / PWA notifications (optional — generate with: npx web-push generate-vapid-keys)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_MAILTO: z.string().default('admin@localhost'),

  // Beta invite gate (optional — if unset, registration is open)
  REQUIRE_INVITE: z.coerce.boolean().default(false),
  ADMIN_SECRET: z.string().min(16).optional(),

  // Federation outgoing proxy — HTTP/SOCKS5 proxy URL for federation requests.
  // Hides the server IP from remote instances. Example: socks5h://127.0.0.1:9050 (Tor)
  FEDERATION_PROXY_URL: z.string().url().optional(),

  // Tor hidden service — if set, advertises the .onion address in NodeInfo and AP responses.
  // Set to the full onion URL, e.g. http://youraddress.onion
  TOR_ONION_URL: z.string().url().optional(),

  // Nostr bridge — comma-separated WebSocket relay URLs for cross-posting (optional)
  NOSTR_RELAYS: z.string().optional(),

  // Email / SMTP (optional — if unset, emails are logged to console in dev)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Floq <noreply@floq.social>'),
})

export type Env = z.infer<typeof schema>

function parseEnv(): Env {
  // docker-compose passes unset optional vars as empty strings ("${VAR:-}").
  // Treat "" as undefined so schema defaults/optionals apply instead of failing .url()/.min().
  const cleaned = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
  )
  const result = schema.safeParse(cleaned)
  if (!result.success) {
    console.error('Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}

export const env = parseEnv()
