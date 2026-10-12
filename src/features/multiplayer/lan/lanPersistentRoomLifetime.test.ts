import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'

const HOUR = 60 * 60 * 1000
function fixture() {
  let emitNative: (event: { type: string; peerId: string }) => void = () => undefined
  const native = {
    startSecureV2: vi.fn(async () => ({ port: 44111, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async () => undefined),
    registerResumeToken: vi.fn(async () => undefined),
    revokeResumeToken: vi.fn(async () => undefined),
    sendV2: vi.fn(async () => undefined),
    closePeer: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    onV2Event: vi.fn(async (listener: typeof emitNative) => {
      emitNative = listener
      return { remove: vi.fn(async () => undefined) }
    }),
  }
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'long-room', hostPlayerId: 'host',
    hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames) })
  return { native, host: new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), native),
    emitNative: (type: string) => emitNative({ type, peerId: '' }) }
}

afterEach(() => vi.useRealTimers())

describe('PL-02B bounded Room lifetime prior to native TLS certificate expiry', () => {
  it('treats a native expiry event as terminal even if the JS timer is background-suspended', async () => {
    const { host, native, emitNative } = fixture()
    await host.start('long-room', '10.1.1.2')
    emitNative('room_expired')
    await vi.waitFor(() => expect(native.stop).toHaveBeenCalledTimes(1))
    await expect(host.refreshInvite()).rejects.toThrow('invite_unavailable')
    await host.stop()
    expect(native.stop).toHaveBeenCalledTimes(1)
  })
  it('closes WSS and rejects invite refresh and game commands at the 23h guard', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
    const { native, host } = fixture()
    await host.start('long-room', '10.1.1.2')
    await vi.advanceTimersByTimeAsync(23 * HOUR - 1)
    expect(native.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(native.stop).toHaveBeenCalledTimes(1)
    await expect(host.refreshInvite()).rejects.toThrow('invite_unavailable')
    await expect(host.processLocalCommand({ protocolVersion: 2, roomId: 'long-room',
      playerId: 'host', scope: 'room', type: 'READY',
      commandId: 'late', clientSeq: 1, payload: { ready: true } }, 'host-conn')).rejects.toThrow('room_closed')
    await host.stop()
    expect(native.stop).toHaveBeenCalledTimes(1)
  })
  it('cancels the automatic closure timer after an explicit stop', async () => {
    vi.useFakeTimers()
    const { native, host } = fixture()
    await host.start('long-room', '10.1.1.2')
    await host.stop()
    await vi.advanceTimersByTimeAsync(25 * HOUR)
    expect(native.stop).toHaveBeenCalledTimes(1)
  })
})
