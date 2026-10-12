import { describe, expect, it, vi } from 'vitest'
import { createPersistentLanInvite } from './lanPersistentInvite'
import type { PersistentLanFrame } from './lanPersistentWire'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from './lanPersistentGuestAdmission'

function setup() {
  let onHost: ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | undefined
  let onGuest: ((event: { type: string; frame?: PersistentLanFrame }) => void) | undefined
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-2', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
    createPlayerId: () => 'guest',
  })
  const hostNative = {
    startSecureV2: vi.fn(async () => ({ port: 42222, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async () => undefined),
    registerResumeToken: vi.fn(async () => undefined),
    revokeResumeToken: vi.fn(async () => undefined),
    closePeer: vi.fn(async (_peer: string) => {
      void _peer
      onHost?.({ type: 'disconnected', peerId: 'peer-a' })
      onGuest?.({ type: 'closed' })
    }),
    sendV2: vi.fn(async (_peer: string, frame: PersistentLanFrame) => { onGuest?.({ type: 'message', frame }) }),
    stop: vi.fn(async () => undefined),
    onV2Event: vi.fn(async (handler: typeof onHost) => {
      onHost = handler
      return { remove: async () => { onHost = undefined } }
    }),
  }
  const guestNative = {
    connectV2: vi.fn(async () => { onHost?.({ type: 'connected', peerId: 'peer-a' }) }),
    sendV2: vi.fn(async (frame: PersistentLanFrame) => { onHost?.({ type: 'message', peerId: 'peer-a', frame }) }),
    storeResumeCredential: vi.fn(async () => undefined),
    connectResume: vi.fn(async () => undefined),
    rotateResumeCredential: vi.fn(async () => undefined),
    clearResumeCredential: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => { onHost?.({ type: 'disconnected', peerId: 'peer-a' }) }),
    onV2Event: vi.fn(async (handler: typeof onGuest) => {
      onGuest = handler
      return { remove: async () => { onGuest = undefined } }
    }),
  }
  const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), hostNative)
  const guest = new LanPersistentGuestAdmission(guestNative, { timeoutMs: 300 })
  return { host, guest, runtime, hostNative, guestNative,
    emitGuest: (frame: PersistentLanFrame) => onGuest?.({ type: 'message', frame }) }
}

describe('PL-02B guest v2 authorized entry', () => {
  it('uses WSS v2, checks the host code, stores versioned credential before ACK, and confirms membership', async () => {
    const { host, guest, runtime, guestNative, hostNative } = setup()
    const invite = await host.start('room-2', '10.1.1.2')
    const entry = await guest.connectInvite(invite, () => host.hostCode())
    expect(entry.playerId).toBe('guest')
    expect(entry.snapshot.roomId).toBe('room-2')
    expect(entry.snapshot.roomState.members.map(m => m.playerId)).toEqual(['host', 'guest'])
    expect(guestNative.connectV2).toHaveBeenCalledWith(invite.hostIp, invite.port, invite.fingerprint,
      invite.roomId, invite.capability)
    expect(guestNative.storeResumeCredential).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 'room-2', playerId: 'guest', protocolVersion: 2,
      fingerprint: invite.fingerprint, resumeToken: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))
    expect(guestNative.sendV2.mock.invocationCallOrder[1]).toBeGreaterThan(guestNative.storeResumeCredential.mock.invocationCallOrder[0])
    expect(host.playerForPeer('peer-a')).toBe('guest')
    expect(hostNative.registerResumeToken).toHaveBeenCalledTimes(1)
    expect(runtime.getRevision()).toBe(2)
    await guest.disconnect()
    await host.stop()
  })

  it('rejects a wrong verification code before any join, store or ACK', async () => {
    const { host, guest, guestNative, runtime } = setup()
    const invite = await host.start('room-2', '10.1.1.2')
    await expect(guest.connectInvite(invite, () => '0000-0000-0000')).rejects.toThrow('host_identity_mismatch')
    expect(guestNative.storeResumeCredential).not.toHaveBeenCalled()
    expect(guestNative.sendV2).not.toHaveBeenCalled()
    expect(runtime.getRevision()).toBe(1)
    await host.stop()
  })

  it('rejects expired or v1-shape tickets before connecting to native', async () => {
    const { guest, guestNative } = setup()
    const invite = createPersistentLanInvite({ roomId: 'room-2', hostIp: '10.1.1.2',
      port: 42222, fingerprint: 'ab'.repeat(32), now: Date.now() - 180_000 })
    await expect(guest.connectInvite(invite, () => 'ABAB-ABAB-ABAB')).rejects.toThrow('invite_expired')
    expect(guestNative.connectV2).not.toHaveBeenCalled()
  })

  it('refuses malformed admitted snapshot and never persists its token', async () => {
    const { guest, guestNative, runtime, emitGuest } = setup()
    const invite = createPersistentLanInvite({ roomId: 'room-2', hostIp: '10.1.1.2',
      port: 42222, fingerprint: 'ab'.repeat(32) })
    const promise = guest.connectInvite(invite, () => 'ABAB-ABAB-ABAB')
    await vi.waitFor(() => expect(guestNative.sendV2).toHaveBeenCalledTimes(1))
    const hostSnapshot = runtime.snapshotFor('host', 'host-conn')
    if (!hostSnapshot.ok) throw new Error('snapshot failed')
    guestNative.sendV2.mockClear()
    // Native bridge drops this impossible frame, but a forged/mock event must still be rejected by the guest.
    const offer: PersistentLanFrame = { kind: 'admittedV2', protocolVersion: 2, playerId: 'guest',
      snapshot: hostSnapshot.snapshot, admissionId: 'ab'.repeat(32),
      resumeToken: 'cd'.repeat(32), resumeExpiresAt: Date.now() + 20_000 }
    // Deliberately feed the client rather than the real WSS host.
    emitGuest(offer)
    await expect(promise).rejects.toThrow('invalid_admission')
    expect(guestNative.storeResumeCredential).not.toHaveBeenCalled()
  })
})
