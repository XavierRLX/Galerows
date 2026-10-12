const PREFIX = 'galerows-lan-v1:'
const MAX_INVITE_BYTES = 1024
const TTL_MS = 120_000
const FIELDS = ['version', 'roomId', 'hostIp', 'port', 'fingerprint', 'issuedAt', 'expiresAt', 'capability'] as const

export interface LanInvite {
  version: 1
  roomId: string
  hostIp: string
  port: number
  fingerprint: string
  issuedAt: number
  expiresAt: number
  capability: string
}

export type InviteDecodeResult =
  | { ok: true; invite: LanInvite }
  | { ok: false; error: 'invalid_invite' | 'invite_expired' | 'incompatible_invite' }

export function createLanInvite(options: {
  roomId: string; hostIp: string; port: number; fingerprint: string; now?: number; capability?: string
}): LanInvite {
  const now = options.now ?? Date.now()
  const capability = options.capability ?? newLanCapability()
  const invite = {
    version: 1 as const, roomId: options.roomId, hostIp: options.hostIp, port: options.port,
    fingerprint: options.fingerprint.toLowerCase(), issuedAt: now, expiresAt: now + TTL_MS, capability,
  }
  if (!validInvite(invite)) throw new Error('invalid_invite')
  return invite
}

export function newLanCapability(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function encodeLanInvite(invite: object): string {
  const json = JSON.stringify(invite)
  const bytes = new TextEncoder().encode(json)
  if (bytes.length > MAX_INVITE_BYTES) throw new Error('invalid_invite')
  const encoded = PREFIX + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  if (encoded.length > MAX_INVITE_BYTES) throw new Error('invalid_invite')
  return encoded
}

export function decodeLanInvite(raw: string, now = Date.now()): InviteDecodeResult {
  if (typeof raw !== 'string' || raw.length > MAX_INVITE_BYTES || !raw.startsWith(PREFIX)) return invalid()
  try {
    const encoded = raw.slice(PREFIX.length)
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return invalid()
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
    if (bytes.length > MAX_INVITE_BYTES) return invalid()
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!isRecord(value)) return invalid()
    if (value.version !== 1) return { ok: false, error: 'incompatible_invite' }
    if (!validInvite(value)) return invalid()
    if (value.issuedAt > now + 5_000 || value.expiresAt <= now) return { ok: false, error: 'invite_expired' }
    return { ok: true, invite: value }
  } catch { return invalid() }
}

/** Public comparison code. A person must compare it with the host screen outside the QR. */
export function hostVerificationCode(verifiedFingerprint: string): string {
  if (!/^[0-9a-f]{64}$/i.test(verifiedFingerprint)) throw new Error('invalid_fingerprint')
  const prefix = verifiedFingerprint.slice(0, 12).toUpperCase()
  return `${prefix.slice(0, 4)}-${prefix.slice(4, 8)}-${prefix.slice(8, 12)}`
}

export function sameLanInvite(a: LanInvite, b: LanInvite): boolean {
  return FIELDS.every(field => a[field] === b[field])
}

export function validInvite(value: Record<string, unknown>): value is Record<string, unknown> & LanInvite {
  return Object.keys(value).length === FIELDS.length
    && FIELDS.every(field => Object.hasOwn(value, field))
    && value.version === 1
    && typeof value.roomId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value.roomId)
    && typeof value.hostIp === 'string' && privateIpv4(value.hostIp)
    && typeof value.port === 'number' && Number.isInteger(value.port) && value.port >= 1 && value.port <= 65535
    && typeof value.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(value.fingerprint)
    && typeof value.capability === 'string' && /^[0-9a-f]{64}$/.test(value.capability)
    && typeof value.issuedAt === 'number' && Number.isSafeInteger(value.issuedAt)
    && typeof value.expiresAt === 'number' && Number.isSafeInteger(value.expiresAt)
    && value.expiresAt > value.issuedAt && value.expiresAt - value.issuedAt <= TTL_MS
}

function privateIpv4(raw: string): boolean {
  const parts = raw.split('.')
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)) return false
  const [a, b] = parts.map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function invalid(): InviteDecodeResult { return { ok: false, error: 'invalid_invite' } }
