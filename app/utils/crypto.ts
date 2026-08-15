/**
 * Thin helpers over Web Crypto. Everything here needs a secure context
 * (https or localhost) — `crypto.subtle` is undefined otherwise.
 */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export const HASH_ALGORITHMS: HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export function subtleAvailable() {
  return typeof globalThis.crypto?.subtle !== 'undefined'
}

/* --------------------------------------------------------------- encoding */

export function utf8(text: string) {
  return new TextEncoder().encode(text)
}

export function fromUtf8(bytes: BufferSource) {
  return new TextDecoder().decode(bytes)
}

export function toHex(input: BufferSource) {
  const bytes = asBytes(input)
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

export function fromHex(hex: string) {
  const clean = hex.replace(/[^0-9a-f]/gi, '')
  const bytes = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function toBase64(input: BufferSource, urlSafe = false) {
  const bytes = asBytes(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  return urlSafe ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : base64
}

export function fromBase64(text: string) {
  const normalized = text.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function asBytes(input: BufferSource) {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
}

export function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/* ----------------------------------------------------------------- hashes */

export async function digest(algorithm: HashAlgorithm, data: BufferSource) {
  return new Uint8Array(await crypto.subtle.digest(algorithm, data))
}

export async function hashText(algorithm: HashAlgorithm, text: string) {
  return toHex(await digest(algorithm, utf8(text)))
}

/** Streams the file through `digest` in one pass; fine for files up to ~1 GB. */
export async function hashFile(algorithm: HashAlgorithm, file: File) {
  return toHex(await digest(algorithm, await file.arrayBuffer()))
}

export async function hmac(algorithm: HashAlgorithm, key: BufferSource, data: BufferSource) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: algorithm }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

/* ------------------------------------------------------ password envelope */

export const DEFAULT_PBKDF2_ITERATIONS = 310_000

const MAGIC = utf8('TBE1')

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * AES-256-GCM with a PBKDF2-derived key. The result is a self-describing
 * base64 envelope: magic | salt(16) | iv(12) | iterations(u32) | ciphertext.
 */
export async function encryptText(plaintext: string, password: string, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(password, salt, iterations)
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plaintext)))

  const envelope = new Uint8Array(MAGIC.length + salt.length + iv.length + 4 + ciphertext.length)
  let offset = 0
  envelope.set(MAGIC, offset); offset += MAGIC.length
  envelope.set(salt, offset); offset += salt.length
  envelope.set(iv, offset); offset += iv.length
  new DataView(envelope.buffer).setUint32(offset, iterations, false); offset += 4
  envelope.set(ciphertext, offset)

  return toBase64(envelope)
}

export async function decryptText(payload: string, password: string) {
  let envelope: Uint8Array
  try {
    envelope = fromBase64(payload)
  } catch {
    throw new Error('That does not look like an encrypted message.')
  }

  const header = MAGIC.length + 16 + 12 + 4
  if (envelope.length <= header || fromUtf8(envelope.slice(0, MAGIC.length)) !== 'TBE1') {
    throw new Error('That does not look like an encrypted message.')
  }

  let offset = MAGIC.length
  const salt = envelope.slice(offset, offset += 16)
  const iv = envelope.slice(offset, offset += 12)
  const iterations = new DataView(envelope.buffer, envelope.byteOffset).getUint32(offset, false)
  offset += 4
  const ciphertext = envelope.slice(offset)

  const key = await deriveKey(password, salt, iterations)

  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return fromUtf8(plaintext)
  } catch {
    throw new Error('Wrong password, or the message was modified.')
  }
}

/* -------------------------------------------------------------- key pairs */

export type KeyPairKind = 'ECDSA-P256' | 'ECDSA-P384' | 'RSA-2048' | 'RSA-4096' | 'Ed25519'

export const KEY_PAIR_KINDS: Array<{ id: KeyPairKind; label: string; hint: string }> = [
  { id: 'ECDSA-P256', label: 'ECDSA P-256', hint: 'Small, fast, the usual default' },
  { id: 'ECDSA-P384', label: 'ECDSA P-384', hint: 'Higher security margin' },
  { id: 'Ed25519', label: 'Ed25519', hint: 'Modern signatures (newer browsers)' },
  { id: 'RSA-2048', label: 'RSA 2048', hint: 'Widest compatibility' },
  { id: 'RSA-4096', label: 'RSA 4096', hint: 'Slow to generate, long lived' }
]

function keyParams(kind: KeyPairKind): { algorithm: EcKeyGenParams | RsaHashedKeyGenParams | { name: string }; usages: KeyUsage[] } {
  switch (kind) {
    case 'ECDSA-P256':
      return { algorithm: { name: 'ECDSA', namedCurve: 'P-256' }, usages: ['sign', 'verify'] }
    case 'ECDSA-P384':
      return { algorithm: { name: 'ECDSA', namedCurve: 'P-384' }, usages: ['sign', 'verify'] }
    case 'Ed25519':
      return { algorithm: { name: 'Ed25519' }, usages: ['sign', 'verify'] }
    default:
      return {
        algorithm: {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: kind === 'RSA-4096' ? 4096 : 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        usages: ['sign', 'verify']
      }
  }
}

function toPem(label: string, body: Uint8Array) {
  const base64 = toBase64(body)
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

export async function generateKeyPair(kind: KeyPairKind) {
  const { algorithm, usages } = keyParams(kind)
  const pair = await crypto.subtle.generateKey(algorithm as AlgorithmIdentifier, true, usages) as CryptoKeyPair

  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey)
  ])

  return {
    publicKey: toPem('PUBLIC KEY', new Uint8Array(publicKey)),
    privateKey: toPem('PRIVATE KEY', new Uint8Array(privateKey))
  }
}

/** Strips the PEM armour and returns the raw DER bytes. */
export function pemToDer(pem: string) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')

  if (!body) throw new Error('That key looks empty.')
  return fromBase64(body)
}

/** UUID v4, with a manual fallback for browsers without `randomUUID`. */
export function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = randomBytes(16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = toHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
