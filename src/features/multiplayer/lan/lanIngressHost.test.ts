import { expect, it, vi } from 'vitest'
import { LanIngressHost } from './lanIngressHost'
import type { LanFrame } from './lanWire'

function fakeHost() {
  let listener: ((event: { type: string; peerId: string; frame?: LanFrame }) => void) | undefined
  return {
    startSecure: vi.fn(async () => ({ port: 4321, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async () => undefined),
    send: vi.fn(async (peerId: string, frame: LanFrame) => { void peerId; void frame }),
    stop: vi.fn(async () => undefined),
    onEvent: vi.fn(async (callback: typeof listener) => { listener = callback; return { remove: async () => { listener = undefined } } }),
    emit: (event: { type: string; peerId: string; frame?: LanFrame }) => listener?.(event),
  }
}

it('opens native WSS without admitting, then replies and rotates capacity only after coordinator admission', async () => {
  const native = fakeHost()
  const coordinator = vi.fn(async () => ({ playerId: 'p', snapshot: { protocolVersion: 1, roomId: 'r', revision: 0,
    roomState: { playerIds: ['p'], barriers: [] }, gamePublicState: {}, privateState: null } }))
  const host = new LanIngressHost(native, coordinator)
  const issued = await host.start('r', '10.1.1.2')
  expect(native.startSecure).toHaveBeenCalledWith('r', issued.capability)
  native.emit({ type: 'connected', peerId: 'peer-1' })
  expect(coordinator).not.toHaveBeenCalled()
  native.emit({ type: 'message', peerId: 'peer-1', frame: { kind: 'joinRequest', protocolVersion: 1, invite: issued } })
  await vi.waitFor(() => expect(native.send).toHaveBeenCalledWith('peer-1', expect.objectContaining({ kind: 'admitted', playerId: 'p' })))
  await vi.waitFor(() => expect(native.rotateInviteToken).toHaveBeenCalledTimes(1))
  expect(host.currentInvite?.capability).not.toBe(issued.capability)
  expect(coordinator).toHaveBeenCalledTimes(1)
})

it('rejects a tampered invitation without calling the coordinator', async () => {
  const native = fakeHost()
  const coordinator = vi.fn(async () => ({ ok: false as const, error: 'room_closed' as const }))
  const host = new LanIngressHost(native, coordinator)
  const issued = await host.start('r', '10.1.1.2')
  native.emit({ type: 'message', peerId: 'peer-1', frame: { kind: 'joinRequest', protocolVersion: 1,
    invite: { ...issued, expiresAt: issued.expiresAt - 1 } } })
  await vi.waitFor(() => expect(native.send).toHaveBeenCalledWith('peer-1',
    { kind: 'rejected', protocolVersion: 1, error: 'invalid_invite' }))
  expect(coordinator).not.toHaveBeenCalled()
})

it('rotates a consumed capability after coordinator denial and refreshes a changed host IP', async () => {
  const native = fakeHost()
  const host = new LanIngressHost(native, async () => ({ ok: false, error: 'room_closed' }))
  const first = await host.start('r', '10.1.1.2')
  native.emit({ type: 'message', peerId: 'peer-1', frame: { kind: 'joinRequest', protocolVersion: 1, invite: first } })
  await vi.waitFor(() => expect(native.send).toHaveBeenCalledWith('peer-1',
    { kind: 'rejected', protocolVersion: 1, error: 'room_closed' }))
  await vi.waitFor(() => expect(host.currentInvite?.capability).not.toBe(first.capability))
  const secondCapability = host.currentInvite?.capability
  const next = await host.refreshInvite('10.1.1.3')
  expect(next.hostIp).toBe('10.1.1.3')
  expect(next.capability).not.toBe(secondCapability)
})

it('retires a consumed capability when its reply cannot be delivered', async () => {
  const native = fakeHost()
  native.send.mockRejectedValueOnce(new Error('peer_closed'))
  const host = new LanIngressHost(native, async () => ({ ok: false, error: 'room_closed' }))
  const issued = await host.start('r', '10.1.1.2')
  native.emit({ type: 'message', peerId: 'peer-1', frame: { kind: 'joinRequest', protocolVersion: 1, invite: issued } })
  await vi.waitFor(() => expect(host.currentInvite?.capability).not.toBe(issued.capability))
})

it('stops the native listener if the dynamic endpoint cannot form a valid invite', async () => {
  const native = fakeHost()
  const host = new LanIngressHost(native, async () => ({ ok: false, error: 'room_closed' }))
  await expect(host.start('r', '8.8.8.8')).rejects.toThrow('invalid_invite')
  expect(native.stop).toHaveBeenCalledTimes(1)
  expect(host.currentInvite).toBeNull()
})
