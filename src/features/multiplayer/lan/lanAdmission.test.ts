import { describe, expect, it } from 'vitest'
import { LanAdmissionGate } from './lanAdmission'
import { createLanInvite } from './lanInvite'
import { PROTOCOL_VERSION } from '../protocol'

const now = 1_760_000_000_000
const invite = () => createLanInvite({ roomId: 'room-1', hostIp: '10.245.112.98', port: 36157, fingerprint: 'ab'.repeat(32), now })
const snapshot = { protocolVersion: PROTOCOL_VERSION, roomId: 'room-1', revision: 0,
  roomState: { playerIds: ['player-1'], barriers: [] }, gamePublicState: {}, privateState: null }
const authorize = async () => ({ playerId: 'player-1', snapshot })

describe('single-use admission gate', () => {
  it('rejects a socket that has opened but has not requested admission', () => {
    const gate = new LanAdmissionGate(invite())
    expect(gate.state('peer-1')).toBe('socket_connected')
  })

  it('admits only after an explicit request and coordinator decision', async () => {
    const issued = invite()
    const gate = new LanAdmissionGate(issued)
    const reply = await gate.request('peer-1', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, now, authorize)
    expect(reply).toEqual({ kind: 'admitted', protocolVersion: 1, playerId: 'player-1', snapshot })
    expect(gate.state('peer-1')).toBe('admitted')
  })

  it('atomically reserves a capability across simultaneous peers and rejects replay', async () => {
    const issued = invite()
    const gate = new LanAdmissionGate(issued)
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    const first = gate.request('peer-1', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, now,
      async () => { await wait; return authorize() })
    const second = await gate.request('peer-2', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, now, authorize)
    expect(second).toEqual({ kind: 'rejected', protocolVersion: 1, error: 'invite_used' })
    release()
    expect((await first).kind).toBe('admitted')
    expect(await gate.request('peer-3', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, now, authorize))
      .toEqual({ kind: 'rejected', protocolVersion: 1, error: 'invite_used' })
  })

  it('rejects a changed invitation and an expired invitation without calling the coordinator', async () => {
    const issued = invite()
    const gate = new LanAdmissionGate(issued)
    const changed = { ...issued, expiresAt: issued.expiresAt - 1 }
    expect(await gate.request('peer-1', { kind: 'joinRequest', protocolVersion: 1, invite: changed }, now, authorize))
      .toEqual({ kind: 'rejected', protocolVersion: 1, error: 'invalid_invite' })
    expect(await gate.request('peer-2', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, issued.expiresAt, authorize))
      .toEqual({ kind: 'rejected', protocolVersion: 1, error: 'invite_expired' })
    expect(gate.state('peer-1')).toBe('rejected')
  })

  it('limits failed attempts across peers and rejects coordinator denial explicitly', async () => {
    const issued = invite()
    const gate = new LanAdmissionGate(issued)
    const wrong = { ...issued, capability: 'cd'.repeat(32) }
    for (let index = 0; index < 3; index++) {
      expect((await gate.request(`peer-${index}`, { kind: 'joinRequest', protocolVersion: 1, invite: wrong }, now, authorize)).kind)
        .toBe('rejected')
    }
    expect(await gate.request('peer-4', { kind: 'joinRequest', protocolVersion: 1, invite: issued }, now, authorize))
      .toEqual({ kind: 'rejected', protocolVersion: 1, error: 'too_many_attempts' })

    const fresh = new LanAdmissionGate(invite())
    expect(await fresh.request('peer-5', { kind: 'joinRequest', protocolVersion: 1, invite: fresh.invite }, now,
      async () => ({ ok: false as const, error: 'room_closed' as const })))
      .toEqual({ kind: 'rejected', protocolVersion: 1, error: 'room_closed' })
  })
})
