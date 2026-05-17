/**
 * E2E DM encryption — sealed box with forward secrecy
 *
 * Pattern: X25519 ECDH + HKDF-SHA256 + AES-256-GCM
 *   - Recipient has a long-term X25519 keypair (private key stays in IndexedDB)
 *   - Each message generates a fresh ephemeral keypair on the sender side
 *   - ECDH(ephemeral_priv, recipient_pub) → shared secret → AES key via HKDF
 *   - The ephemeral private key is discarded after encryption
 *   - Stored per message: ciphertext + nonce + ephemeralPublicKey
 *
 * Forward secrecy: compromising the recipient's long-term key later cannot
 * decrypt past messages because the ephemeral keys were never persisted.
 */

const DB_NAME = 'floq-e2e'
const DB_VERSION = 1
const STORE_NAME = 'keys'
const PRIVATE_KEY_ID = 'dm-private-key'
const X25519_PARAMS = { name: 'ECDH', namedCurve: 'X25519' } as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}

/** Generate a long-term X25519 keypair. Stores private key in IndexedDB. Returns base64url public key. */
export async function generateAndStoreKeyPair(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(X25519_PARAMS, false, ['deriveKey'])
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(keyPair.privateKey, PRIVATE_KEY_ID)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  db.close()
  const exported = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  return toBase64url(exported)
}

export async function loadPrivateKey(): Promise<CryptoKey | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(PRIVATE_KEY_ID)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function clearPrivateKey(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(PRIVATE_KEY_ID)
    req.onsuccess = () => { db.close(); resolve() }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function importSpkiPublicKey(b64url: string): Promise<CryptoKey> {
  const raw = fromBase64url(b64url)
  return crypto.subtle.importKey('spki', raw, X25519_PARAMS, false, [])
}

async function deriveAesKey(privateKey: CryptoKey, peerPublicKey: CryptoKey, ephemeralPubRaw: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublicKey }, privateKey, 256)
  const hkdfMaterial = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // Salt = ephemeral public key bytes — ties the AES key to this specific message
      salt: new Uint8Array(ephemeralPubRaw),
      info: new TextEncoder().encode('floq-dm-sealed-box-v1'),
    },
    hkdfMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a message for a recipient.
 * Generates a fresh ephemeral keypair (discarded after this call) for forward secrecy.
 */
export async function sealMessage(
  plaintext: string,
  recipientPublicKeyB64url: string,
): Promise<{ encryptedContent: string; encryptionIv: string; ephemeralPublicKey: string }> {
  // Ephemeral keypair — private key intentionally not stored
  const ephemeral = await crypto.subtle.generateKey(X25519_PARAMS, true, ['deriveKey'])
  const ephemeralPubRaw = await crypto.subtle.exportKey('spki', ephemeral.publicKey)
  const recipientKey = await importSpkiPublicKey(recipientPublicKeyB64url)
  const aesKey = await deriveAesKey(ephemeral.privateKey, recipientKey, ephemeralPubRaw)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext))
  return {
    encryptedContent: toBase64url(ciphertext),
    encryptionIv: toBase64url(iv),
    ephemeralPublicKey: toBase64url(ephemeralPubRaw),
  }
}

/**
 * Decrypt a message using the recipient's long-term private key + sender's ephemeral public key.
 */
export async function openMessage(
  encryptedContent: string,
  encryptionIv: string,
  ephemeralPublicKey: string,
  myPrivateKey: CryptoKey,
): Promise<string> {
  const ephemeralPubRaw = fromBase64url(ephemeralPublicKey)
  const ephemeralKeyObj = await crypto.subtle.importKey('spki', ephemeralPubRaw, X25519_PARAMS, true, [])
  const aesKey = await deriveAesKey(myPrivateKey, ephemeralKeyObj, ephemeralPubRaw)
  const iv = fromBase64url(encryptionIv)
  const ciphertext = fromBase64url(encryptedContent)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  return new TextDecoder().decode(plaintext)
}

// Legacy compat — kept for migration; remove after all clients re-key
export { sealMessage as encryptMessage, openMessage as decryptMessage }
