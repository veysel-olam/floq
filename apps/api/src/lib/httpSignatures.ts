import { createSign, createVerify, createHash } from 'node:crypto'

export interface SignedHeaders {
  Date: string
  Signature: string
  Digest?: string
}

export function signRequest(opts: {
  method: string
  url: URL
  body?: string
  privateKeyPem: string
  keyId: string
}): SignedHeaders {
  const date = new Date().toUTCString()
  const headerNames: string[] = ['(request-target)', 'host', 'date']
  const lines: string[] = [
    `(request-target): ${opts.method.toLowerCase()} ${opts.url.pathname}${opts.url.search}`,
    `host: ${opts.url.host}`,
    `date: ${date}`,
  ]

  let digest: string | undefined
  if (opts.body) {
    digest = `SHA-256=${createHash('sha256').update(opts.body).digest('base64')}`
    headerNames.push('digest')
    lines.push(`digest: ${digest}`)
  }

  const signingString = lines.join('\n')
  const signer = createSign('RSA-SHA256')
  signer.update(signingString)
  const sig = signer.sign(opts.privateKeyPem, 'base64')

  return {
    Date: date,
    Signature: `keyId="${opts.keyId}",algorithm="rsa-sha256",headers="${headerNames.join(' ')}",signature="${sig}"`,
    ...(digest && { Digest: digest }),
  }
}

function parseSignatureHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const m of header.matchAll(/([a-zA-Z]+)="([^"]*)"/g)) {
    result[m[1]!] = m[2]!
  }
  return result
}

export function verifySignature(opts: {
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
  publicKeyPem: string
}): boolean {
  const sigHeader = opts.headers['signature']
  if (!sigHeader) return false
  const parsed = parseSignatureHeader(Array.isArray(sigHeader) ? sigHeader[0]! : sigHeader)
  const headerList = (parsed['headers'] ?? '(request-target) host date').split(' ')

  const lines: string[] = []
  for (const h of headerList) {
    if (h === '(request-target)') {
      lines.push(`(request-target): ${opts.method.toLowerCase()} ${opts.path}`)
    } else {
      const val = opts.headers[h]
      if (!val) return false
      lines.push(`${h}: ${Array.isArray(val) ? val.join(', ') : val}`)
    }
  }

  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(lines.join('\n'))
    return verifier.verify(opts.publicKeyPem, parsed['signature'] ?? '', 'base64')
  } catch {
    return false
  }
}
