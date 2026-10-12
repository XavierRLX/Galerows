import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import { createPersistentLanInvite } from './lanPersistentInvite'
import { decodePersistentLanFrame, encodePersistentLanFrame } from './lanPersistentWire'

const version = 2
const invite = createPersistentLanInvite({
  roomId: 'room-2', hostIp: '10.1.1.2', port: 41234, fingerprint: 'ab'.repeat(32),
})
const runtime = new AuthoritativeRoomRuntimeV2({
  roomId: 'room-2', hostPlayerId: 'host', hostConnectionId: 'host-connection',
  adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
  createPlayerId: () => 'guest',
})
const joined = runtime.joinGuest('connection')
if (!joined.ok) throw new Error(joined.error)
const admissionId = 'cd'.repeat(32)
const resumeToken = 'ef'.repeat(32)
const expiry = Date.now() + 120_000

describe('PL-02B admission frames stay isolated from v1', () => {
  it('roundtrips join, admitted, ack, confirmed, rejected and closure v2', () => {
    const frames = [
      { kind: 'joinRequestV2', protocolVersion: version, invite },
      { kind: 'admittedV2', protocolVersion: version, playerId: 'guest', snapshot: joined.snapshot,
        admissionId, resumeToken, resumeExpiresAt: expiry },
      { kind: 'admissionAckV2', protocolVersion: version, roomId: 'room-2', playerId: 'guest', admissionId },
      { kind: 'admissionConfirmedV2', protocolVersion: version, roomId: 'room-2', playerId: 'guest', admissionId },
      { kind: 'rejectedV2', protocolVersion: version, error: 'invite_used' },
      { kind: 'roomClosedV2', protocolVersion: version, roomId: 'room-2' },
    ]
    for (const frame of frames) {
      const result = decodePersistentLanFrame(JSON.stringify(frame))
      expect(result).toEqual({ ok: true, frame })
      if (result.ok) expect(encodePersistentLanFrame(result.frame)).toBe(JSON.stringify(frame))
    }
  })

  it('rejects arbitrary fields, missing secrets and malformed snapshots', () => {
    const cases = [
      { kind: 'joinRequestV2', protocolVersion: 2, invite: { ...invite, version: 1 } },
      { kind: 'joinRequestV2', protocolVersion: 2, invite: { ...invite, privateState: 'leak' } },
      { kind: 'admittedV2', protocolVersion: 2, playerId: 'guest', snapshot: joined.snapshot, admissionId, resumeToken: 'x', resumeExpiresAt: expiry },
      { kind: 'admittedV2', protocolVersion: 2, playerId: 'guest', snapshot: { ...joined.snapshot, roomState: { ...joined.snapshot.roomState, members: joined.snapshot.roomState.members.slice(0, 1) } }, admissionId, resumeToken, resumeExpiresAt: expiry },
      { kind: 'admissionAckV2', protocolVersion: 2, roomId: 'room-2', playerId: 'guest', admissionId: 'bogus' },
      { kind: 'rejectedV2', protocolVersion: 2, error: 'arbitrary' },
    ]
    for (const frame of cases) expect(decodePersistentLanFrame(JSON.stringify(frame)))
      .toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodePersistentLanFrame(JSON.stringify({ kind: 'joinRequestV2', protocolVersion: 1, invite })))
      .toEqual({ ok: false, error: 'incompatible_protocol' })
  })
})
