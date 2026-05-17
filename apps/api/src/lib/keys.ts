import forge from 'node-forge'
import { generateKeyPairSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from './env.js'

const KEY_BITS = 2048
const CIPHER = 'AES-CBC' as const

export interface KeyPair {
  publicKeyPem: string
  privateKeyEncrypted: string
}

export interface Ed25519KeyPair {
  publicKeyMultibase: string   // base58btc multibase ("z" prefix)
  privateKeyEncrypted: string
}

export function generateEd25519KeyPair(): Ed25519KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  // Multibase base58btc: "z" + base58(raw 32-byte public key)
  // Strip the 12-byte SPKI header to get raw 32 bytes
  const rawPublic = (publicKey as Buffer).subarray(12)
  const publicKeyMultibase = 'z' + base58Encode(rawPublic)

  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', masterKey, iv)
  const encrypted = Buffer.concat([cipher.update(privateKey as Buffer), cipher.final()])
  const privateKeyEncrypted = Buffer.concat([iv, encrypted]).toString('base64')

  return { publicKeyMultibase, privateKeyEncrypted }
}

export function decryptEd25519PrivateKey(encrypted: string): Buffer {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const data = Buffer.from(encrypted, 'base64')
  const iv = data.subarray(0, 16)
  const ciphertext = data.subarray(16)
  const decipher = createDecipheriv('aes-256-cbc', masterKey, iv)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// Simple base58btc alphabet (Bitcoin)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Encode(buf: Buffer): string {
  let num = BigInt('0x' + buf.toString('hex'))
  let result = ''
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)]! + result
    num /= 58n
  }
  // Leading zero bytes
  for (const byte of buf) {
    if (byte !== 0) break
    result = '1' + result
  }
  return result
}

export function base58Decode(str: string): Buffer {
  let num = 0n
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char)
    if (idx < 0) throw new Error('Invalid base58 character')
    num = num * 58n + BigInt(idx)
  }
  const hex = num.toString(16).padStart(64, '0')
  return Buffer.from(hex, 'hex')
}

/**
 * Derives a did:key identifier from an ed25519 multibase public key.
 * Prepends the ed25519 multicodec prefix (0xed01) before re-encoding.
 */
export function didKeyFromMultibase(multibase: string): string {
  if (!multibase.startsWith('z')) throw new Error('Expected multibase base58btc (z prefix)')
  const rawKey = base58Decode(multibase.slice(1))  // 32-byte raw ed25519 public key
  const multicodecKey = Buffer.concat([Buffer.from([0xed, 0x01]), rawKey])
  return `did:key:z${base58Encode(multicodecKey)}`
}

export async function generateActorKeyPair(): Promise<KeyPair> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: KEY_BITS, workers: -1 }, (err, keypair) => {
      if (err) return reject(err)

      const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey)
      const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey)
      const privateKeyEncrypted = encryptPrivateKey(privateKeyPem)

      resolve({ publicKeyPem, privateKeyEncrypted })
    })
  })
}

export function decryptPrivateKey(encrypted: string): string {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const data = Buffer.from(encrypted, 'base64')
  const iv = forge.util.createBuffer(data.subarray(0, 16).toString('binary'))
  const ciphertext = forge.util.createBuffer(data.subarray(16).toString('binary'))

  const decipher = forge.cipher.createDecipher(
    CIPHER,
    forge.util.createBuffer(masterKey.toString('binary')),
  )
  decipher.start({ iv })
  decipher.update(ciphertext)
  decipher.finish()

  return forge.util.decodeUtf8(decipher.output.bytes())
}

function encryptPrivateKey(pem: string): string {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const ivBytes = forge.random.getBytesSync(16)

  const cipher = forge.cipher.createCipher(
    CIPHER,
    forge.util.createBuffer(masterKey.toString('binary')),
  )
  cipher.start({ iv: forge.util.createBuffer(ivBytes) })
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(pem)))
  cipher.finish()

  // .bytes() ham binary string döndürür, Buffer'a 'binary' encoding ile dönüştür
  const ivBuf = Buffer.from(ivBytes, 'binary')
  const ciphertextBuf = Buffer.from(cipher.output.bytes(), 'binary')
  return Buffer.concat([ivBuf, ciphertextBuf]).toString('base64')
}
