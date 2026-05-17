/**
 * FEP-8b32: Object Integrity Proofs
 * Signs AP objects with ed25519 so relay servers can't tamper with content.
 * Spec: https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { decryptEd25519PrivateKey, base58Decode } from './keys.js'
import { env } from './env.js'

const PROOF_CONTEXT = 'https://w3id.org/security/data-integrity/v1'

export interface DataIntegrityProof {
  type: 'DataIntegrityProof'
  cryptosuite: 'eddsa-jcs-2022'
  created: string
  verificationMethod: string
  proofPurpose: 'assertionMethod'
  proofValue: string  // multibase base58btc ("z" prefix)
}

/**
 * JCS (RFC 8785) canonical JSON serialization.
 */
function jcs(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(jcs).join(',') + ']'
  const obj = value as Record<string, unknown>
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + jcs(obj[k])).join(',') + '}'
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Encode(buf: Buffer): string {
  let num = BigInt('0x' + (buf.length ? buf.toString('hex') : '00'))
  let result = ''
  while (num > 0n) { result = BASE58[Number(num % 58n)]! + result; num /= 58n }
  for (const b of buf) { if (b !== 0) break; result = '1' + result }
  return result
}

function hashMessage(proofOptions: Record<string, unknown>, doc: Record<string, unknown>): Buffer {
  const proofHash = createHash('sha256').update(jcs(proofOptions)).digest()
  const docHash = createHash('sha256').update(jcs({ ...doc, proof: undefined })).digest()
  return Buffer.concat([proofHash, docHash])
}

export function signObject(
  obj: Record<string, unknown>,
  actor: { handle: string; ed25519PrivateKeyEncrypted: string },
): Record<string, unknown> {
  const verificationMethod = `${env.APP_URL}/users/${actor.handle}#ed25519-key`

  const proofOptions: Record<string, unknown> = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: 'assertionMethod',
  }

  const message = hashMessage(proofOptions, obj)
  const pkcs8Der = decryptEd25519PrivateKey(actor.ed25519PrivateKeyEncrypted)
  const privateKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' })
  // ed25519 sign() with null algorithm uses the key's built-in digest
  const signature = sign(null, message, privateKey)

  const proof: DataIntegrityProof = {
    ...(proofOptions as Omit<DataIntegrityProof, 'proofValue'>),
    proofValue: 'z' + base58Encode(signature),
  }

  const contexts = Array.isArray(obj['@context'])
    ? [...(obj['@context'] as unknown[]), PROOF_CONTEXT]
    : [obj['@context'], PROOF_CONTEXT]

  return { ...obj, '@context': contexts, proof }
}

/**
 * Issue a W3C Verifiable Credential asserting that the given actor controls
 * their ActivityPub actor URL and DID:key identity.
 * Signed with the actor's ed25519 key using eddsa-jcs-2022.
 */
export function issueVerifiableCredential(actor: {
  handle: string
  ed25519PublicKey: string
  ed25519PrivateKeyEncrypted: string
  did: string
  apActorUrl: string
  didKey: string
}): Record<string, unknown> {
  const vcId = `${actor.apActorUrl}#vc-${Date.now()}`
  const issuanceDate = new Date().toISOString()

  const vc: Record<string, unknown> = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/data-integrity/v1',
    ],
    id: vcId,
    type: ['VerifiableCredential', 'ActivityPubActorCredential'],
    issuer: {
      id: actor.didKey,
      name: actor.handle,
    },
    issuanceDate,
    credentialSubject: {
      id: actor.did,
      actorUrl: actor.apActorUrl,
      handle: actor.handle,
      ed25519PublicKey: actor.ed25519PublicKey,
    },
  }

  return signObject(vc, actor)
}

/**
 * Verify an object proof against the actor's ed25519 public key (multibase).
 * Returns false if no proof, wrong cryptosuite, or invalid signature.
 */
export function verifyObjectProof(
  obj: Record<string, unknown>,
  ed25519PublicKeyMultibase: string,
): boolean {
  const proof = obj['proof'] as DataIntegrityProof | undefined
  if (!proof || proof.cryptosuite !== 'eddsa-jcs-2022') return false

  try {
    const { proofValue, ...proofOptions } = proof
    const message = hashMessage(proofOptions as Record<string, unknown>, obj)

    // Strip "z" multibase prefix, decode base58 to raw signature
    const signature = base58Decode(proofValue.slice(1))

    // Reconstruct SPKI DER from raw 32-byte ed25519 public key
    const rawPublic = base58Decode(ed25519PublicKeyMultibase.slice(1))
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex')
    const spkiDer = Buffer.concat([spkiHeader, rawPublic])
    const publicKey = createPublicKey({ key: spkiDer, format: 'der', type: 'spki' })

    return verify(null, message, publicKey, signature)
  } catch {
    return false
  }
}
