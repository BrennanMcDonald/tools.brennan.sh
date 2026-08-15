import { hmac, randomBytes, type HashAlgorithm } from './crypto'

/** RFC 6238 TOTP, the algorithm behind every authenticator app. */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]

  return output
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!clean) return new Uint8Array()
  if (/[^A-Z2-7]/.test(clean)) throw new Error('Base32 secrets use A–Z and 2–7 only')

  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(output)
}

export interface TotpOptions {
  digits?: number
  period?: number
  algorithm?: HashAlgorithm
  /** Milliseconds since epoch; defaults to now. */
  at?: number
}

export async function totp(secret: Uint8Array, options: TotpOptions = {}) {
  const digits = options.digits ?? 6
  const period = options.period ?? 30
  const algorithm = options.algorithm ?? 'SHA-1'
  const counter = Math.floor((options.at ?? Date.now()) / 1000 / period)

  const message = new Uint8Array(8)
  new DataView(message.buffer).setBigUint64(0, BigInt(counter), false)

  const mac = await hmac(algorithm, secret, message)

  // Dynamic truncation: the low nibble of the last byte picks the offset.
  const offset = mac[mac.length - 1]! & 0x0f
  const binary = ((mac[offset]! & 0x7f) << 24)
    | ((mac[offset + 1]! & 0xff) << 16)
    | ((mac[offset + 2]! & 0xff) << 8)
    | (mac[offset + 3]! & 0xff)

  return String(binary % 10 ** digits).padStart(digits, '0')
}

/** Seconds left in the current step, for the countdown ring. */
export function secondsRemaining(period = 30, at = Date.now()) {
  return period - Math.floor(at / 1000) % period
}

export interface OtpauthConfig {
  issuer: string
  account: string
  secret: string
  digits: number
  period: number
  algorithm: HashAlgorithm
}

export function otpauthUri({ issuer, account, secret, digits, period, algorithm }: OtpauthConfig) {
  const label = issuer ? `${issuer}:${account || 'user'}` : account || 'user'
  const params = new URLSearchParams({
    secret: secret.replace(/\s/g, ''),
    algorithm: algorithm.replace('-', ''),
    digits: String(digits),
    period: String(period)
  })
  if (issuer) params.set('issuer', issuer)

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

/** Reads a secret and its settings out of an `otpauth://` URI. */
export function parseOtpauth(uri: string): Partial<OtpauthConfig> | null {
  if (!uri.toLowerCase().startsWith('otpauth://totp/')) return null

  try {
    const url = new URL(uri)
    const params = url.searchParams
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const [labelIssuer, labelAccount] = label.includes(':') ? label.split(':') : [undefined, label]

    const algorithm = (params.get('algorithm') ?? 'SHA1').toUpperCase()
    const normalized = algorithm.startsWith('SHA') && !algorithm.includes('-')
      ? `SHA-${algorithm.slice(3)}`
      : algorithm

    return {
      issuer: params.get('issuer') ?? labelIssuer ?? '',
      account: labelAccount ?? '',
      secret: params.get('secret') ?? '',
      digits: Number(params.get('digits')) || 6,
      period: Number(params.get('period')) || 30,
      algorithm: (['SHA-1', 'SHA-256', 'SHA-512'].includes(normalized) ? normalized : 'SHA-1') as HashAlgorithm
    }
  } catch {
    return null
  }
}

/** A fresh random secret, 20 bytes like most services issue. */
export function randomSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}
