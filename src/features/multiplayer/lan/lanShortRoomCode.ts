import { createPersistentLanInvite } from './lanPersistentInvite'
import type { PersistentLanInvite } from './lanPersistentInvite'
import type { DiscoveredLanRoom } from './lanRoomDiscovery'

/**
 * Convenience-only code for friends on the same LAN. This is NOT a high-entropy secret.
 * The DNS-SD advertisement includes the code, so LAN participants can read it.
 */
export function newShortRoomCode(): string {
  const bytes = new Uint32Array(1)
  const range = 0x1_0000_0000
  const upper = range - (range % 1_000_000)
  do { crypto.getRandomValues(bytes) } while (bytes[0] >= upper)
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

export function normalizeRoomCode(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 6)
}

export async function codeRoomCapability(roomId: string, code: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId) || !/^\d{6}$/.test(code)) throw new Error('invalid_room_code')
  const source = new TextEncoder().encode(`galerows-short-room-v1:${roomId}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', source)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function inviteFromDiscoveredCode(room: DiscoveredLanRoom): Promise<PersistentLanInvite> {
  const capability = await codeRoomCapability(room.roomId, room.code)
  // Reuse the versioned pinned WSS/Room join and Keystore admission flow.
  return createPersistentLanInvite({
    roomId: room.roomId, hostIp: room.hostIp, port: room.port,
    fingerprint: room.fingerprint, capability,
  })
}

export function isValidDiscoveredRoom(room: DiscoveredLanRoom): boolean {
  return /^Galerows-[A-Za-z0-9]{4,16}$/.test(room.id)
    && /^\d{6}$/.test(room.code)
    && /^[A-Za-z0-9_-]{1,64}$/.test(room.roomId)
    && /^[0-9a-f]{64}$/.test(room.fingerprint)
    && Number.isInteger(room.port) && room.port >= 1 && room.port <= 65535
    && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.)/.test(room.hostIp)
}
