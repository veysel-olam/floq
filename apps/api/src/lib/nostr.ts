import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { decryptPrivateKey } from './keys.js'
import { env } from './env.js'

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
    privateKeyHex = decryptPrivateKey(privateKeyEncrypted)
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
