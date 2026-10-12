import { describe, expect, it, vi } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import type { PersistentLanFrame } from './lanPersistentWire'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'

function fixture(timeout = 500) {
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-2', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
    createPlayerId: () => 'guest',
  })
  let listener: ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | undefined
  const removeListener = vi.fn(async () => { listener = undefined })
  const native = {
    startSecureV2: vi.fn(async () => ({ port: 43111, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async (_token: string) => { void _token }),
    registerResumeToken: vi.fn(async (_player: string, _token: string, _until: number) => { void [_player, _token, _until] }),
    revokeResumeToken: vi.fn(async (_player: string, _token: string) => { void [_player, _token] }),
    closePeer: vi.fn(async (_peer: string) => { void _peer }),
    sendV2: vi.fn(async (_peer: string, _frame: PersistentLanFrame) => { void [_peer, _frame] }),
    stop: vi.fn(async () => undefined),
    onV2Event: vi.fn(async (callback: typeof listener) => {
      listener = callback
      return { remove: removeListener }
    }),
    emit: (type: string, peerId: string, frame?: PersistentLanFrame) => listener?.({ type, peerId, frame }),
  }
  const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), native, { admissionTimeoutMs: timeout })
  return { native, host, runtime, removeListener }
}
function admitted(native: ReturnType<typeof fixture>['native']) {
  const call = native.sendV2.mock.calls.find(([, frame]) => frame.kind === 'admittedV2')
  if (!call) throw new Error('no admission')
  const frame = call[1]
  if (frame.kind !== 'admittedV2') throw new Error('wrong frame')
  return frame
}

describe('PL-02B host admission with RoomCoordinatorV2', () => {
  it('fails closed and fully removes the listener after uncertain admission token revocation', async () => {
    const { native, host, runtime, removeListener } = fixture()
    const invite = await host.start('room-2', '10.1.1.2')
    native.emit('connected', 'peer-a')
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a',
      expect.objectContaining({ kind: 'admittedV2' })))
    native.revokeResumeToken.mockRejectedValueOnce(new Error('native_revocation_uncertain'))
    native.emit('disconnected', 'peer-a')
    await vi.waitFor(() => expect(native.stop).toHaveBeenCalled())
    await vi.waitFor(() => expect(runtime.hasMembership('guest')).toBe(false))
    await vi.waitFor(() => expect(removeListener).toHaveBeenCalledTimes(1))
    expect(host.currentInvite).toBeNull()
    await expect(host.refreshInvite()).rejects.toThrow('invite_unavailable')
    await host.stop()
  })

  it('does not join on native hello, reserves one valid ticket and binds peer only after credential ACK', async () => {
    const { native, host, runtime } = fixture()
    const invite = await host.start('room-2', '10.1.1.2')
    expect(native.startSecureV2).toHaveBeenCalledWith('room-2', invite.capability)
    native.emit('connected', 'peer-a')
    expect(runtime.getRevision()).toBe(1)
    expect(host.playerForPeer('peer-a')).toBeNull()
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a', expect.objectContaining({ kind: 'admittedV2' })))
    const offered = admitted(native)
    expect(offered.snapshot.roomState.members.map(m => m.playerId)).toEqual(['host', 'guest'])
    expect(native.registerResumeToken).toHaveBeenCalledWith('guest', offered.resumeToken, offered.resumeExpiresAt)
    expect(host.playerForPeer('peer-a')).toBeNull()
    expect(native.sendV2.mock.calls.filter(([, frame]) => frame.kind === 'eventV2')).toHaveLength(0)
    native.emit('message', 'peer-a', { kind: 'admissionAckV2', protocolVersion: 2,
      roomId: 'room-2', playerId: 'guest', admissionId: offered.admissionId })
    await vi.waitFor(() => expect(host.playerForPeer('peer-a')).toBe('guest'))
    expect(native.sendV2).toHaveBeenCalledWith('peer-a', expect.objectContaining({ kind: 'admissionConfirmedV2' }))
    expect(host.currentInvite?.capability).not.toBe(invite.capability)
    expect(runtime.getRevision()).toBe(2)
    await host.stop()
  })

  it('rejects a modified, expired or already consumed capability without admitting another peer', async () => {
    const { native, host, runtime } = fixture()
    const invite = await host.start('room-2', '10.1.1.2')
    native.emit('connected', 'peer-a')
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2,
      invite: { ...invite, hostIp: '10.1.1.3' } })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a',
      { kind: 'rejectedV2', protocolVersion: 2, error: 'invalid_invite' }))
    expect(runtime.getRevision()).toBe(1)
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.registerResumeToken).toHaveBeenCalledTimes(1))
    native.emit('connected', 'peer-b')
    native.emit('message', 'peer-b', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-b',
      { kind: 'rejectedV2', protocolVersion: 2, error: 'invite_used' }))
    expect(host.playerForPeer('peer-b')).toBeNull()
    await host.stop()
  })

  it('compensates pending membership, revokes native token and increments revision when peer disappears', async () => {
    const { native, host, runtime } = fixture()
    const invite = await host.start('room-2', '10.1.1.2')
    native.emit('connected', 'peer-a')
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.registerResumeToken).toHaveBeenCalledTimes(1))
    const offer = admitted(native)
    native.emit('disconnected', 'peer-a')
    await vi.waitFor(() => expect(native.revokeResumeToken).toHaveBeenCalledWith('guest', offer.resumeToken))
    await vi.waitFor(() => expect(runtime.hasMembership('guest')).toBe(false))
    expect(runtime.getRevision()).toBe(3)
    expect(host.playerForPeer('peer-a')).toBeNull()
    await host.stop()
  })

  it('ignores forged ACK and closes unadmitted peers sending commands', async () => {
    const { native, host, runtime } = fixture()
    const invite = await host.start('room-2', '10.1.1.2')
    native.emit('connected', 'peer-a')
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a', expect.objectContaining({ kind: 'admittedV2' })))
    native.emit('message', 'peer-a', { kind: 'admissionAckV2', protocolVersion: 2,
      roomId: 'room-2', playerId: 'guest', admissionId: '01'.repeat(32) })
    native.emit('message', 'peer-a', { kind: 'commandV2', protocolVersion: 2,
      command: { protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'guest',
        commandId: 'c', clientSeq: 1, type: 'READY', payload: { ready: true } } })
    await vi.waitFor(() => expect(native.closePeer).toHaveBeenCalledWith('peer-a'))
    await vi.waitFor(() => expect(runtime.hasMembership('guest')).toBe(false))
    expect(host.playerForPeer('peer-a')).toBeNull()
    await host.stop()
  })

  it('expires an unconfirmed admission without making its membership permanent', async () => {
    const { native, host, runtime } = fixture(20)
    const invite = await host.start('room-2', '10.1.1.2')
    native.emit('connected', 'peer-a')
    native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
    await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a',
      expect.objectContaining({ kind: 'admittedV2' })))
    await vi.waitFor(() => expect(runtime.hasMembership('guest')).toBe(false))
    expect(native.revokeResumeToken).toHaveBeenCalledTimes(1)
    expect(native.closePeer).toHaveBeenCalledWith('peer-a')
    expect(runtime.getRevision()).toBe(3)
    await host.stop()
  })

  it('compensates when native registration or the final ACK delivery fails', async () => {
    for (const failAt of ['register', 'confirmation'] as const) {
      const { native, host, runtime } = fixture()
      if (failAt === 'register') native.registerResumeToken.mockRejectedValueOnce(new Error('vault_failed'))
      const invite = await host.start('room-2', '10.1.1.2')
      native.emit('connected', 'peer-a')
      native.emit('message', 'peer-a', { kind: 'joinRequestV2', protocolVersion: 2, invite })
      if (failAt === 'confirmation') {
        await vi.waitFor(() => expect(native.sendV2).toHaveBeenCalledWith('peer-a', expect.objectContaining({ kind: 'admittedV2' })))
        native.sendV2.mockRejectedValueOnce(new Error('ack_failed'))
        native.emit('message', 'peer-a', { kind: 'admissionAckV2', protocolVersion: 2,
          roomId: 'room-2', playerId: 'guest', admissionId: admitted(native).admissionId })
      }
      await vi.waitFor(() => expect(runtime.hasMembership('guest')).toBe(false))
      expect(host.playerForPeer('peer-a')).toBeNull()
      await host.stop()
    }
  })
})
