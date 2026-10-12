import { describe, expect, it, vi } from 'vitest'
import { createLanInvite, hostVerificationCode } from './lanInvite'
import { LanIngressClient } from './lanIngressClient'
import type { LanFrame } from './lanWire'

const invite = () => createLanInvite({ roomId: 'r', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })

function fakeTransport() {
  let listener: ((event: { type: string; frame?: LanFrame }) => void) | undefined
  return {
    connect: vi.fn(async () => undefined),
    connectResume: vi.fn(async (roomId: string) => { void roomId }),
    send: vi.fn(async (frame: LanFrame) => { void frame }),
    disconnect: vi.fn(async () => undefined),
    onEvent: vi.fn(async (callback: typeof listener) => { listener = callback; return { remove: async () => { listener = undefined } } }),
    emit: (event: { type: string; frame?: LanFrame }) => listener?.(event),
  }
}

describe('guest ingress over pinned native WSS', () => {
  const admissionId = 'c'.repeat(64)
  it('keeps TLS verification separate from membership and requires manual host code', async () => {
    const transport = fakeTransport()
    const session = new LanIngressClient(transport)
    const issued = invite()
    await session.connect(issued)
    expect(session.state).toBe('tls_verified')
    expect(session.playerId).toBeNull()
    expect(session.verificationCode).toBe(hostVerificationCode(issued.fingerprint))
    await expect(session.requestAdmission()).rejects.toThrow('confirmation_required')
    expect(transport.send).not.toHaveBeenCalled()
    expect(session.confirmHostCode('DEAD-BEEF-0000')).toBe(false)
    expect(session.state).toBe('rejected')
    expect(transport.disconnect).toHaveBeenCalled()
  })

  it('sends a join request only after the host display matches and waits for admitted', async () => {
    const transport = fakeTransport()
    const session = new LanIngressClient(transport)
    const issued = invite()
    await session.connect(issued)
    expect(session.confirmHostCode(hostVerificationCode(issued.fingerprint))).toBe(true)
    const response = session.requestAdmission()
    expect(session.state).toBe('ingress_requested')
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledWith({ kind: 'joinRequest', protocolVersion: 1, invite: issued }))
    expect(session.playerId).toBeNull()
    const snapshot = { protocolVersion: 1, roomId: 'r', revision: 0,
      roomState: { playerIds: ['p'], barriers: [] }, gamePublicState: {}, privateState: null }
    transport.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p', snapshot, admissionId } })
    expect(await response).toEqual({ playerId: 'p', snapshot, admissionId })
    const confirmed = session.confirmAdmission('r', 'p', admissionId)
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledWith({ kind: 'admissionAck', protocolVersion: 1,
      roomId: 'r', playerId: 'p', admissionId }))
    transport.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'r', playerId: 'p', admissionId } })
    await confirmed
    expect(session.state).toBe('admitted')
  })

  it('reports a typed rejection and never initializes membership', async () => {
    const transport = fakeTransport()
    const session = new LanIngressClient(transport)
    const issued = invite()
    await session.connect(issued)
    session.confirmHostCode(hostVerificationCode(issued.fingerprint))
    const response = session.requestAdmission()
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalled())
    transport.emit({ type: 'message', frame: { kind: 'rejected', protocolVersion: 1, error: 'invite_used' } })
    await expect(response).rejects.toThrow('invite_used')
    expect(session.state).toBe('rejected')
    expect(session.playerId).toBeNull()
  })

  it('rejects a wrong TLS pin before any join request or human confirmation', async () => {
    const transport = fakeTransport()
    transport.connect.mockRejectedValueOnce(new Error('host_identity_mismatch'))
    const session = new LanIngressClient(transport)
    await expect(session.connect(invite())).rejects.toThrow('host_identity_mismatch')
    expect(session.state).toBe('rejected')
    expect(transport.send).not.toHaveBeenCalled()
    expect(session.verificationCode).toBeNull()
  })

  it('does not treat a socket closed during native connect as verified TLS', async () => {
    const transport = fakeTransport()
    let release!: () => void
    transport.connect.mockImplementationOnce(() => new Promise<undefined>(resolve => { release = () => resolve(undefined) }))
    const session = new LanIngressClient(transport)
    const pending = session.connect(invite())
    await vi.waitFor(() => expect(transport.connect).toHaveBeenCalledOnce())
    transport.emit({ type: 'closed' })
    release()
    await expect(pending).rejects.toThrow('room_closed')
    expect(session.state).toBe('rejected')
    expect(session.verificationCode).toBeNull()
    expect(transport.send).not.toHaveBeenCalled()
  })

  it('rejects expired invitations before sending the capability to native WSS', async () => {
    const transport = fakeTransport()
    const session = new LanIngressClient(transport)
    const expired = createLanInvite({ roomId: 'r', hostIp: '10.1.1.2', port: 4321,
      fingerprint: 'ab'.repeat(32), now: Date.now() - 120_001 })
    await expect(session.connect(expired)).rejects.toThrow('invite_expired')
    expect(transport.connect).not.toHaveBeenCalled()
  })

  it('retains a frame arriving immediately after admitted until the session subscribes', async () => {
    const native = fakeTransport()
    const ingress = new LanIngressClient(native)
    await ingress.connect(invite())
    ingress.confirmHostCode(hostVerificationCode(invite().fingerprint))
    const admission = ingress.requestAdmission()
    const snapshot = { protocolVersion: 1, roomId: 'r', revision: 1,
      roomState: { playerIds: ['p'], barriers: [] }, gamePublicState: { count: 0 }, privateState: null }
    native.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p', snapshot, admissionId } })
    const confirmed = ingress.confirmAdmission('r', 'p', admissionId)
    native.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'r', playerId: 'p', admissionId } })
    await confirmed
    native.emit({ type: 'message', frame: { kind: 'event', event: { protocolVersion: 1, roomId: 'r', revision: 2, kind: 'marker' } } })
    await admission
    const received: unknown[] = []
    ingress.subscribeAdmitted(event => received.push(event))
    expect(received).toEqual([{ type: 'message', frame: { kind: 'event', event: { protocolVersion: 1, roomId: 'r', revision: 2, kind: 'marker' } } }])
  })

  it('revokes the admitted send path when the native socket closes', async () => {
    const native = fakeTransport()
    const ingress = new LanIngressClient(native)
    await ingress.connect(invite())
    ingress.confirmHostCode(hostVerificationCode(invite().fingerprint))
    const admission = ingress.requestAdmission()
    native.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p', snapshot: {
      protocolVersion: 1, roomId: 'r', revision: 1,
      roomState: { playerIds: ['p'], barriers: [] }, gamePublicState: {}, privateState: null,
    }, admissionId } })
    await admission
    const confirmed = ingress.confirmAdmission('r', 'p', admissionId)
    native.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'r', playerId: 'p', admissionId } })
    await confirmed
    native.emit({ type: 'closed' })
    await expect(ingress.sendFrame({ kind: 'ping', protocolVersion: 1 })).rejects.toThrow('lan_disconnected')
    expect(native.send).toHaveBeenCalledTimes(2)
    expect(native.send).not.toHaveBeenCalledWith({ kind: 'ping', protocolVersion: 1 })
  })

  it('closes an overloaded admission handoff before accepting another outbound frame', async () => {
    const native = fakeTransport()
    const ingress = new LanIngressClient(native)
    await ingress.connect(invite())
    ingress.confirmHostCode(hostVerificationCode(invite().fingerprint))
    const admission = ingress.requestAdmission()
    native.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p', snapshot: {
      protocolVersion: 1, roomId: 'r', revision: 1,
      roomState: { playerIds: ['p'], barriers: [] }, gamePublicState: {}, privateState: null,
    }, admissionId } })
    await admission
    const confirmed = ingress.confirmAdmission('r', 'p', admissionId)
    native.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'r', playerId: 'p', admissionId } })
    await confirmed
    for (let revision = 2; revision <= 66; revision++) native.emit({ type: 'message', frame: {
      kind: 'event', event: { protocolVersion: 1, roomId: 'r', revision, kind: 'marker' },
    } })
    expect(native.disconnect).toHaveBeenCalledOnce()
    await expect(ingress.sendFrame({ kind: 'ping', protocolVersion: 1 })).rejects.toThrow('lan_disconnected')
    const received: unknown[] = []
    ingress.subscribeAdmitted(event => received.push(event))
    expect(received).toEqual([{ type: 'closed' }])
  })
})
