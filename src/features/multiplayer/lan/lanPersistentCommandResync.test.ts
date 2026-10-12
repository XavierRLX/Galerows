import { describe, expect, it, vi } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import type { RoomCommandV2 } from '../persistentProtocol'
import type { PersistentLanFrame } from './lanPersistentWire'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from './lanPersistentGuestAdmission'

function fixture(timeoutMs = 15_000) {
  let hostHandler: ((e: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | undefined
  let guestHandler: ((e: { type: string; frame?: PersistentLanFrame }) => void) | undefined
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-2', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
    createPlayerId: () => 'guest',
    random: () => 0.5,
  })
  let dropCommandResult = false
  const nativeHost = {
    startSecureV2: vi.fn(async () => ({ port: 44311, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async () => undefined),
    registerResumeToken: vi.fn(async () => undefined),
    revokeResumeToken: vi.fn(async () => undefined),
    closePeer: vi.fn(async () => {
      hostHandler?.({ type: 'disconnected', peerId: 'peer-1' })
      guestHandler?.({ type: 'closed' })
    }),
    sendV2: vi.fn(async (_peer: string, frame: PersistentLanFrame) => {
      void _peer
      if (dropCommandResult && frame.kind === 'commandResultV2') return
      guestHandler?.({ type: 'message', frame })
    }),
    stop: vi.fn(async () => undefined),
    onV2Event: vi.fn(async (listener: typeof hostHandler) => {
      hostHandler = listener
      return { remove: async () => { hostHandler = undefined } }
    }),
  }
  const nativeGuest = {
    connectV2: vi.fn(async () => { hostHandler?.({ type: 'connected', peerId: 'peer-1' }) }),
    sendV2: vi.fn(async (frame: PersistentLanFrame) => {
      hostHandler?.({ type: 'message', peerId: 'peer-1', frame })
    }),
    storeResumeCredential: vi.fn(async () => undefined),
    connectResume: vi.fn(async () => undefined),
    rotateResumeCredential: vi.fn(async () => undefined),
    clearResumeCredential: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => { hostHandler?.({ type: 'disconnected', peerId: 'peer-1' }) }),
    onV2Event: vi.fn(async (listener: typeof guestHandler) => {
      guestHandler = listener
      return { remove: async () => { guestHandler = undefined } }
    }),
  }
  const coordinator = new RoomCoordinatorV2(runtime)
  const host = new LanPersistentRoomHost(coordinator, nativeHost)
  const guest = new LanPersistentGuestAdmission(nativeGuest, { timeoutMs })
  const emitGuest = (frame: PersistentLanFrame) => guestHandler?.({ type: 'message', frame })
  const emitHost = (frame: PersistentLanFrame) => hostHandler?.({ type: 'message', peerId: 'peer-1', frame })
  const enter = async () => {
    const invite = await host.start('room-2', '10.1.1.2')
    await guest.connectInvite(invite, () => host.hostCode())
  }
  return { runtime, coordinator, nativeHost, nativeGuest, host, guest, emitGuest, emitHost, enter,
    setDropCommandResult: (drop: boolean) => { dropCommandResult = drop } }
}
function hostCommand(seq: number, type: string, payload: unknown): RoomCommandV2 {
  return { protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'host',
    commandId: `h-${seq}`, clientSeq: seq, type, payload }
}

describe('PL-02B bound commands and authorized resync', () => {
  it('executes guest commands only after ACK, sends result + ordered projection, without duplicate revision', async () => {
    const { enter, guest, runtime, host, nativeHost } = fixture()
    await enter()
    const response = await guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })
    expect(response.status).toBe('accepted')
    expect(response.nextClientSeq).toBe(2)
    expect(runtime.getRevision()).toBe(3)
    expect(guest.getState()?.roomState.members.find(m => m.playerId === 'guest')?.ready).toBe(true)
    expect(guest.getState()?.revision).toBe(3)
    const command = nativeHost.sendV2.mock.calls.filter(([, frame]) => frame.kind === 'commandResultV2')
    expect(command).toHaveLength(1)
    expect(nativeHost.sendV2).toHaveBeenCalledWith('peer-1', expect.objectContaining({ kind: 'eventV2' }))
    await guest.disconnect()
    await host.stop()
  })

  it('requires authorized resync after a lost command result instead of guessing the next sequence', async () => {
    const { enter, guest, host, setDropCommandResult, runtime } = fixture(80)
    await enter()
    setDropCommandResult(true)
    await expect(guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } }))
      .rejects.toThrow('command_timeout')
    expect(runtime.getRevision()).toBe(3)
    await expect(guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: false } }))
      .rejects.toThrow('resync_required')
    setDropCommandResult(false)
    const snapshot = await guest.requestResync()
    expect(snapshot.nextClientSeq).toBe(2)
    const response = await guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: false } })
    expect(response.status).toBe('accepted')
    expect(response.nextClientSeq).toBe(3)
    expect(runtime.getRevision()).toBe(4)
    await guest.disconnect()
    await host.stop()
  })

  it('rejects peer impersonation before runtime consumes client sequence', async () => {
    const { enter, guest, runtime, host, nativeHost, emitHost } = fixture()
    await enter()
    emitHost({ kind: 'commandV2', protocolVersion: 2,
      command: { protocolVersion: 2, scope: 'room', roomId: 'room-2',
        playerId: 'host', commandId: 'forged', clientSeq: 1,
        type: 'SELECT_GAME', payload: { gameId: 'toy' } } })
    await vi.waitFor(() => expect(nativeHost.closePeer).toHaveBeenCalled())
    expect(runtime.getRevision()).toBe(3) // join and secure disconnect only
    expect(runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { roomState: { phase: 'lobby' }, nextClientSeq: 1 } })
    expect(host.playerForPeer('peer-1')).toBeNull()
    expect(guest.getState()).toBeNull()
    await host.stop()
  })

  it('deduplicates a replayed guest command with the original clientSeq and commandId', async () => {
    const { enter, nativeGuest, nativeHost, runtime, guest, host } = fixture()
    await enter()
    const frame: PersistentLanFrame = { kind: 'commandV2', protocolVersion: 2,
      command: { protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'guest',
        commandId: 'retry-1', clientSeq: 1, type: 'READY', payload: { ready: true } } }
    await nativeGuest.sendV2(frame)
    await vi.waitFor(() => expect(nativeHost.sendV2.mock.calls
      .filter(([, f]) => f.kind === 'commandResultV2')).toHaveLength(1))
    await nativeGuest.sendV2(frame)
    await vi.waitFor(() => expect(nativeHost.sendV2.mock.calls
      .filter(([, f]) => f.kind === 'commandResultV2')).toHaveLength(2))
    const responses = nativeHost.sendV2.mock.calls
      .filter(([, f]) => f.kind === 'commandResultV2').map(([, f]) => f)
    expect(responses[0]).toEqual(responses[1])
    expect(runtime.getRevision()).toBe(3)
    expect(nativeHost.sendV2.mock.calls.filter(([, f]) => f.kind === 'eventV2')).toHaveLength(1)
    expect(guest.getState()?.revision).toBe(3)
    await guest.disconnect()
    await host.stop()
  })

  it('rejects forged resync identity, rather than sending another member snapshot', async () => {
    const { enter, nativeHost, emitHost, host } = fixture()
    await enter()
    const previous = nativeHost.sendV2.mock.calls.length
    emitHost({ kind: 'resyncV2', protocolVersion: 2, request: {
      protocolVersion: 2, roomId: 'room-2', playerId: 'host', lastAppliedRevision: 0,
    } })
    await vi.waitFor(() => expect(nativeHost.closePeer).toHaveBeenCalled())
    expect(nativeHost.sendV2.mock.calls.slice(previous).some(([, f]) => f.kind === 'snapshotV2')).toBe(false)
    await host.stop()
  })

  it('rejects guest or stale local connections at the host-only command boundary', async () => {
    const { enter, runtime, host, guest } = fixture()
    await enter()
    const revision = runtime.getRevision()
    const guestConnection = runtime.getConnectionId('guest')!
    await expect(host.processLocalCommand({
      protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'guest',
      commandId: 'bad-local', clientSeq: 1, type: 'SELECT_GAME', payload: { gameId: 'toy' },
    }, guestConnection)).rejects.toThrow('unauthorized_host')
    await expect(host.processLocalCommand(hostCommand(1, 'SELECT_GAME', { gameId: 'toy' }),
      'stale-host-connection')).rejects.toThrow('unauthorized_host')
    expect(runtime.getRevision()).toBe(revision)
    await guest.disconnect()
    await host.stop()
  })

  it('keeps one Room and member identities while host runs toy A, returns, then counter B', async () => {
    const { enter, runtime, guest, host } = fixture()
    await enter()
    const local = (seq: number, type: string, payload: unknown) =>
      host.processLocalCommand(hostCommand(seq, type, payload), 'host-conn')
    expect((await local(1, 'SELECT_GAME', { gameId: 'toy' })).status).toBe('accepted')
    expect((await local(2, 'CONFIGURE_GAME', { rounds: 2 })).status).toBe('accepted')
    expect((await local(3, 'READY', { ready: true })).status).toBe('accepted')
    expect((await guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status).toBe('accepted')
    expect((await local(4, 'START_GAME', null)).status).toBe('accepted')
    const playingA = guest.getState()
    const sessionA = playingA?.roomState.currentGameSessionId
    const guestSecret = (playingA?.privateState?.data as { secret?: string })?.secret
    const hostSnapshot = runtime.snapshotFor('host', 'host-conn')
    if (!hostSnapshot.ok) throw new Error('host unavailable')
    expect(playingA?.roomState.phase).toBe('playing')
    expect(sessionA).toBeTruthy()
    expect(guestSecret).toBeTruthy()
    expect(guestSecret).not.toBe((hostSnapshot.snapshot.privateState?.data as { secret?: string })?.secret)
    expect((await local(5, 'END_GAME', null)).status).toBe('accepted')
    expect((await local(6, 'RETURN_TO_LOBBY', null)).status).toBe('accepted')
    expect(guest.getState()?.privateState).toBeNull()
    expect(guest.getState()?.gamePublicState).toBeNull()
    expect((await local(7, 'SELECT_GAME', { gameId: 'counter' })).status).toBe('accepted')
    expect((await local(8, 'CONFIGURE_GAME', { target: 3 })).status).toBe('accepted')
    expect((await local(9, 'READY', { ready: true })).status).toBe('accepted')
    expect((await guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status).toBe('accepted')
    expect((await local(10, 'START_GAME', null)).status).toBe('accepted')
    const playingB = guest.getState()
    const sessionB = playingB?.roomState.currentGameSessionId
    if (!sessionB) throw new Error('counter session missing')
    expect(playingB?.roomId).toBe('room-2')
    expect(playingB?.roomState.members.map(m => m.playerId)).toEqual(['host', 'guest'])
    expect(sessionB).not.toBe(sessionA)
    expect(playingB?.revision).toBeGreaterThan(playingA!.revision)
    expect(playingB?.privateState).toBeNull()
    expect(JSON.stringify(playingB)).not.toContain(guestSecret!)
    expect((await guest.sendCommand({ scope: 'game', type: 'INCREMENT', payload: null,
      gameSessionId: sessionB })).status).toBe('accepted')
    expect((guest.getState()?.gamePublicState?.data as { count: number }).count).toBe(1)
    expect(runtime.hasMembership('guest')).toBe(true)
    await guest.disconnect()
    await host.stop()
  })

  it('recovers a revision gap with the latest guest-only private snapshot', async () => {
    const { enter, runtime, coordinator, guest, nativeGuest, nativeHost, emitGuest, host } = fixture()
    await enter()
    expect((await coordinator.processCommand(hostCommand(1, 'SELECT_GAME', { gameId: 'toy' }), 'host-conn')).result.status).toBe('accepted')
    expect((await coordinator.processCommand(hostCommand(2, 'CONFIGURE_GAME', { rounds: 2 }), 'host-conn')).result.status).toBe('accepted')
    expect((await coordinator.processCommand(hostCommand(3, 'READY', { ready: true }), 'host-conn')).result.status).toBe('accepted')
    const ready = await guest.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })
    expect(ready.status).toBe('accepted')
    await vi.waitFor(() => {
      expect(guest.getState()?.revision).toBe(runtime.getRevision())
      expect(guest.getState()?.needsResync).toBe(false)
    })
    expect((await coordinator.processCommand(hostCommand(4, 'START_GAME', null), 'host-conn')).result.status).toBe('accepted')
    const live = runtime.snapshotFor('host', 'host-conn')
    if (!live.ok || !live.snapshot.roomState.currentGameSessionId) throw new Error('game not running')
    for (const seq of [5, 6]) {
      const event = await coordinator.processCommand({ protocolVersion: 2, scope: 'game', roomId: 'room-2',
        playerId: 'host', commandId: `h-${seq}`, clientSeq: seq, type: 'TOY_CLUE', payload: null,
        gameSessionId: live.snapshot.roomState.currentGameSessionId }, 'host-conn')
      expect(event.result.status).toBe('accepted')
    }
    const authoritative = runtime.snapshotFor('guest', 'lan-v2-conn-placeholder')
    expect(authoritative.ok).toBe(false)
    const delivered = await coordinator.runExclusive(r => r.snapshotFor('guest', r.getConnectionId('guest')!))
    if (!delivered.ok) throw new Error('no guest snapshot')
    const hostSnapshot = runtime.snapshotFor('host', 'host-conn')
    if (!hostSnapshot.ok) throw new Error('no host snapshot')
    expect(delivered.snapshot.privateState).not.toEqual(hostSnapshot.snapshot.privateState)
    const before = nativeGuest.sendV2.mock.calls.length
    expect(guest.getState()?.revision).toBeLessThan(delivered.snapshot.revision - 1)
    emitGuest({ kind: 'eventV2', protocolVersion: 2,
      event: { ...delivered.snapshot, kind: 'projection' } })
    await vi.waitFor(() => expect(nativeGuest.sendV2.mock.calls.slice(before)
      .some(([f]) => f.kind === 'resyncV2')).toBe(true))
    await vi.waitFor(() => expect(guest.getState()?.revision).toBe(delivered.snapshot.revision))
    expect(guest.getState()?.needsResync).toBe(false)
    expect(guest.getState()?.privateState).toEqual(delivered.snapshot.privateState)
    const resyncFrames = nativeHost.sendV2.mock.calls.filter(([, f]) => f.kind === 'snapshotV2')
    expect(resyncFrames.length).toBeGreaterThan(0)
    for (const [, frame] of resyncFrames) {
      const encoded = JSON.stringify(frame)
      const secret = (hostSnapshot.snapshot.privateState?.data as { secret?: string } | undefined)?.secret
      if (secret) expect(encoded).not.toContain(secret)
    }
    await guest.disconnect()
    await host.stop()
  })
})
