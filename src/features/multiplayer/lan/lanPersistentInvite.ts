import { createLanInvite, validInvite } from './lanInvite'
import type { LanInvite } from './lanInvite'

const PREFIX = 'galerows-lan-v2:'
const MAX_BYTES = 1024
const FIELDS = ['version', 'roomId', 'hostIp', 'port', 'fingerprint', 'issuedAt', 'expiresAt', 'capability'] as const

export type PersistentLanInvite = Omit<LanInvite, 'version'> & { version: 2 }
export type PersistentInviteResult =
  | { ok: true; invite: PersistentLanInvite }
  | { ok: false; error: 'invalid_invite' | 'invite_expired' | 'incompatible_invite' }

export function createPersistentLanInvite(options: Parameters<typeof createLanInvite>[0]): PersistentLanInvite {
  const legacy = createLanInvite(options)
  return { ...legacy, version: 2 }
}

export function validPersistentLanInvite(value: unknown): value is PersistentLanInvite {
  return record(value) && value.version === 2 && Object.keys(value).length === FIELDS.length
    && FIELDS.every(field => Object.hasOwn(value, field))
    && validInvite({ ...value, version: 1 })
}

export function samePersistentLanInvite(a: PersistentLanInvite, b: PersistentLanInvite): boolean {
  return FIELDS.every(field => a[field] === b[field])
}

export function encodePersistentLanInvite(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  if (bytes.length > MAX_BYTES) throw new Error('invalid_invite')
  const encoded = PREFIX + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  if (encoded.length > MAX_BYTES) throw new Error('invalid_invite')
  return encoded
}

export function decodePersistentLanInvite(raw: string, now = Date.now()): PersistentInviteResult {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES || !raw.startsWith(PREFIX)) {
    return { ok: false, error: 'invalid_invite' }
  }
  try {
    const b64 = raw.slice(PREFIX.length)
    if (!/^[A-Za-z0-9_-]+$/.test(b64)) return { ok: false, error: 'invalid_invite' }
    const bytes = Uint8Array.from(atob(b64.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
    if (bytes.length > MAX_BYTES) return { ok: false, error: 'invalid_invite' }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!record(value)) return { ok: false, error: 'invalid_invite' }
    if (value.version !== 2) return { ok: false, error: 'incompatible_invite' }
    if (!validPersistentLanInvite(value)) return { ok: false, error: 'invalid_invite' }
    if (value.issuedAt > now + 5_000 || value.expiresAt <= now) return { ok: false, error: 'invite_expired' }
    return { ok: true, invite: value }
  } catch { return { ok: false, error: 'invalid_invite' } }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
