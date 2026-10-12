import { describe, expect, it } from 'vitest'
import { decodePersistentLanFrame, encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame } from './lanPersistentWire'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'

const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'room-2', hostPlayerId: 'host',
  hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
  createPlayerId: () => 'guest' })
const guest = runtime.joinGuest('conn-1')
if (!guest.ok) throw new Error('guest missing')
const v2 = 2 as const
const token = 'ab'.repeat(32)
const next = 'cd'.repeat(32)
const id = 'ef'.repeat(32)

describe('isolated v2 resume and terminal leave codec', () => {
  const frames: PersistentLanFrame[] = [
    { kind: 'resumeHello', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', resumeToken: token },
    { kind: 'rekeyOfferV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest',
      resumeToken: next, resumeExpiresAt: Date.now() + 90000, rekeyId: id },
    { kind: 'rekeyAckV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', rekeyId: id },
    { kind: 'rekeyConfirmedV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', rekeyId: id },
    { kind: 'resumedV2', protocolVersion: v2, playerId: 'guest', snapshot: guest.snapshot,
      resumeToken: next, resumeExpiresAt: Date.now() + 90000, resumeId: id },
    { kind: 'resumeAckV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', resumeId: id },
    { kind: 'resumeConfirmedV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', resumeId: id },
    { kind: 'leaveRequestV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest', commandId: 'leave-1' },
    { kind: 'leaveConfirmedV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest',
      commandId: 'leave-1', revision: 4 },
    { kind: 'leaveRejectedV2', protocolVersion: v2, roomId: 'room-2', playerId: 'guest',
      commandId: 'leave-1', error: 'revocation_failed' },
  ]
  it('roundtrips exact v2 resume/leave frames', () => {
    for (const frame of frames) {
      expect(decodePersistentLanFrame(JSON.stringify(frame))).toEqual({ ok: true, frame })
      expect(encodePersistentLanFrame(frame)).toBe(JSON.stringify(frame))
    }
  })
  it('rejects forged, cross-version, missing and unexpected fields', () => {
    const cases = [
      { ...frames[0], protocolVersion: 1 },
      { ...frames[0], resumeToken: 'bad' },
      { ...frames[0], extra: 'payload' },
      { ...frames[1], resumeExpiresAt: -2 },
      { ...frames[1], rekeyId: 'invalid' },
      { ...frames[1], extra: 'payload' },
      { ...frames[2], rekeyId: 'bad' },
      { ...frames[4], resumeExpiresAt: -2 },
      { ...frames[4], playerId: 'fake' },
      { ...frames[5], resumeId: 'bad' },
      { ...frames[7], roomId: '' },
      { ...frames[8], revision: -1 },
      { ...frames[9], error: 'unknown' },
    ]
    for (const frame of cases) expect(decodePersistentLanFrame(JSON.stringify(frame)).ok).toBe(false)
  })
})
