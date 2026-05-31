import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { env } from './env.js'

// Nostr secret-key crypto (AES-256-CBC, iv prepended, base64). Single source so
// encrypt/decrypt always match — the secret key is stored as encrypted hex.
export function encryptNostrKey(hex: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([iv, cipher.update(hex, 'utf8'), cipher.final()]).toString('base64')
}

export function decryptNostrKey(encrypted: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const data = Buffer.from(encrypted, 'base64')
  const decipher = createDecipheriv('aes-256-cbc', key, data.subarray(0, 16))
  return Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]).toString('utf8')
}

// Relays to publish to — can be overridden via NOSTR_RELAYS env var (comma-separated)
function getRelays(): string[] {
  if (env.NOSTR_RELAYS) return env.NOSTR_RELAYS.split(',').map((r) => r.trim())
  return [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://nostr.wine',
  ]
}

// Generate a new Nostr secp256k1 keypair
// Returns { publicKeyHex, privateKeyHex }
export function generateNostrKeypair(): { publicKeyHex: string; privateKeyHex: string } {
  const seckey = generateSecretKey()
  const pubkey = getPublicKey(seckey)
  const privateKeyHex = Buffer.from(seckey).toString('hex')
  return { publicKeyHex: pubkey, privateKeyHex }
}

// Format public key as npub1... bech32
export function toNpub(hexPubkey: string): string {
  return nip19.npubEncode(hexPubkey)
}

// Publish a kind:1 note event to Nostr relays
export async function publishNote(
  content: string,
  privateKeyEncrypted: string,
  tags: string[][] = [],
): Promise<void> {
  let privateKeyHex: string
  try {
    privateKeyHex = decryptNostrKey(privateKeyEncrypted)
  } catch {
    return
  }

  const seckey = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'))

  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  }, seckey)

  const pool = new SimplePool()
  const relays = getRelays()

  try {
    await Promise.allSettled(
      pool.publish(relays, event),
    )
  } finally {
    pool.close(relays)
  }
}

// Cross-post a floq post to Nostr (kind:1). Strips HTML, maps hashtags to `t`
// tags. Best-effort — never throws into the caller's request path.
export async function crosspostToNostr(
  privateKeyEncrypted: string,
  content: string,
  hashtags: string[] = [],
): Promise<void> {
  const text = content.replace(/<[^>]+>/g, '').trim()
  if (!text) return
  const tags = hashtags
    .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean)
    .map((t) => ['t', t])
  await publishNote(text, privateKeyEncrypted, tags)
}
