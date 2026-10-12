import { describe, expect, it, vi } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import type { PersistentLanFrame } from './lanPersistentWire'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from './lanPersistentGuestAdmission'

function network(rekeyAfterMs?: number, rekeyRetryMs?: number) {
  type Callback = (event: { type: string; frame?: PersistentLanFrame }) => void
  let onHost: ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | undefined
  const callbacks = new Map<string, Callback>()
  const tokens = new Map<string, Set<string>>()
  type VaultRecord = { roomId: string; playerId: string; resumeToken: string;
    expiresAt?: number; protocolVersion?: number }
  const vaults = new Map<string, VaultRecord>()
  let guestOrdinal = 0
  let joinOrdinal = 0
  let revocationFailures = 0
  let rotationFailures = 0
  let registrationFailures = 0
  let registrationBarrier: Promise<void> | null = null
  let rotationBarrier: Promise<void> | null = null
  let droppedConfirmation: PersistentLanFrame['kind'] | null = null
  let droppedGuestFrame: PersistentLanFrame['kind'] | null = null
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-2', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
    createPlayerId: () => ++joinOrdinal === 1 ? 'guest' : `guest-${joinOrdinal}`,
  })
  const nativeHost = {
    startSecureV2: vi.fn(async () => ({ port: 44311, fingerprint: 'ab'.repeat(32) })),
    rotateInviteToken: vi.fn(async () => undefined),
    registerResumeToken: vi.fn(async (playerId: string, token: string) => {
      if (registrationFailures-- > 0) throw new Error('registration_failed')
      if (registrationBarrier) { await registrationBarrier; registrationBarrier = null }
      const set = tokens.get(playerId) ?? new Set<string>()
      set.add(token)
      tokens.set(playerId, set)
    }),
    revokeResumeToken: vi.fn(async (playerId: string, token: string) => {
      if (revocationFailures-- > 0) throw new Error('revocation_failed')
      tokens.get(playerId)?.delete(token)
    }),
    closePeer: vi.fn(async (peerId: string) => {
      onHost?.({ type: 'disconnected', peerId })
      callbacks.get(peerId)?.({ type: 'closed' })
    }),
    sendV2: vi.fn(async (peerId: string, frame: PersistentLanFrame) => {
      if (droppedConfirmation === frame.kind) {
        droppedConfirmation = null
        return
      }
      callbacks.get(peerId)?.({ type: 'message', frame })
    }),
    stop: vi.fn(async () => undefined),
    onV2Event: vi.fn(async (handler: typeof onHost) => {
      onHost = handler
      return { remove: async () => { onHost = undefined } }
    }),
  }
  const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), nativeHost,
    rekeyAfterMs === undefined ? {} : { rekeyAfterMs, rekeyRetryMs })
  function guest(timeoutMs = 150, deviceId = 'primary') {
    const peerId = `peer-${++guestOrdinal}`
    const getStored = () => vaults.get(deviceId)
    const native = {
      connectV2: vi.fn(async () => { onHost?.({ type: 'connected', peerId }) }),
      connectResume: vi.fn(async (roomId: string) => {
        const stored = getStored()
        if (!stored || stored.roomId !== roomId || stored.protocolVersion !== 2
          || !tokens.get(stored.playerId)?.has(stored.resumeToken)) throw new Error('invalid_native_resume')
        onHost?.({ type: 'connected', peerId })
        onHost?.({ type: 'message', peerId, frame: { kind: 'resumeHello', protocolVersion: 2,
          roomId, playerId: stored.playerId, resumeToken: stored.resumeToken } })
      }),
      sendV2: vi.fn(async (frame: PersistentLanFrame) => {
        if (droppedGuestFrame === frame.kind) { droppedGuestFrame = null; return }
        onHost?.({ type: 'message', peerId, frame })
      }),
      storeResumeCredential: vi.fn(async (value: VaultRecord) => { vaults.set(deviceId, { ...value }) }),
      rotateResumeCredential: vi.fn(async (roomId: string, playerId: string,
        resumeToken: string, expiresAt: number) => {
        if (rotationFailures-- > 0) throw new Error('vault_failed')
        if (rotationBarrier) { await rotationBarrier; rotationBarrier = null }
        const stored = getStored()
        if (!stored || stored.roomId !== roomId || stored.playerId !== playerId) throw new Error('vault_mismatch')
        vaults.set(deviceId, { ...stored, resumeToken, expiresAt })
      }),
      clearResumeCredential: vi.fn(async (roomId: string) => {
        if (getStored()?.roomId === roomId) vaults.delete(deviceId)
      }),
      disconnect: vi.fn(async () => {
        onHost?.({ type: 'disconnected', peerId })
        callbacks.get(peerId)?.({ type: 'closed' })
      }),
      onV2Event: vi.fn(async (handler: Callback) => {
        callbacks.set(peerId, handler)
        return { remove: async () => { callbacks.delete(peerId) } }
      }),
    }
    return { peerId, native, session: new LanPersistentGuestAdmission(native, { timeoutMs }) }
  }
  const enter = async (client: ReturnType<typeof guest>) => {
    const invite = await host.start('room-2', '10.1.1.2')
    await client.session.connectInvite(invite, () => host.hostCode())
  }
  return { host, runtime, nativeHost, guest, enter,
    hasToken: (playerId: string, token: string) => tokens.get(playerId)?.has(token) ?? false,
    getCredential: (deviceId = 'primary') => {
      const stored = vaults.get(deviceId)
      return stored ? { ...stored } : null
    },
    failRevocation: (times: number) => { revocationFailures = times },
    failRegistration: (times: number) => { registrationFailures = times },
    pauseNextRegistration: () => {
      let release!: () => void
      registrationBarrier = new Promise<void>(resolve => { release = resolve })
      return release
    },
    failRotation: (times: number) => { rotationFailures = times },
    pauseNextRotation: () => {
      let release!: () => void
      rotationBarrier = new Promise<void>(resolve => { release = resolve })
      return release
    },
    drop: (kind: PersistentLanFrame['kind']) => { droppedConfirmation = kind },
    dropGuest: (kind: PersistentLanFrame['kind']) => { droppedGuestFrame = kind },
    inject: (peerId: string, frame: PersistentLanFrame) => onHost?.({ type: 'message', peerId, frame }),
  }
}

describe('PL-02B secure resume and terminal leave', () => {
  it('does not offer a pending rekey after host stop races native token registration', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    const release = n.pauseNextRegistration()
    await vi.waitFor(() => expect(n.nativeHost.registerResumeToken.mock.calls.length).toBe(2))
    const shuttingDown = n.host.stop()
    release()
    await shuttingDown
    expect(n.nativeHost.sendV2.mock.calls.some(([, frame]) => frame.kind === 'rekeyOfferV2')).toBe(false)
    expect(n.hasToken('guest', old)).toBe(false)
    expect(n.runtime.hasMembership('guest')).toBe(true)
    expect(n.nativeHost.stop).toHaveBeenCalledTimes(1)
    await expect(n.host.refreshInvite()).rejects.toThrow('invite_unavailable')
    await first.session.disconnect().catch(() => undefined)
  })

  it('rotates active credentials before expiry, revokes old token and keeps game commands working', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    const revision = n.runtime.getRevision()
    await vi.waitFor(() => expect(n.getCredential()!.resumeToken).not.toBe(old))
    expect(n.hasToken('guest', old)).toBe(false)
    expect(n.hasToken('guest', n.getCredential()!.resumeToken)).toBe(true)
    expect(n.runtime.getRevision()).toBe(revision)
    expect((await first.session.sendCommand({ scope: 'room', type: 'READY',
      payload: { ready: true } })).status).toBe('accepted')
    await first.session.disconnect()
    const resumed = n.guest(250)
    expect((await resumed.session.resume('room-2', 'guest')).playerId).toBe('guest')
    await resumed.session.leaveRoom('post-rekey')
    await n.host.stop()
  })

  it('reconnects using the pending token when rekey ACK is lost', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    n.dropGuest('rekeyAckV2')
    await vi.waitFor(() => expect(n.getCredential()!.resumeToken).not.toBe(old))
    expect(n.hasToken('guest', old)).toBe(true)
    await first.session.disconnect()
    const resumed = n.guest(250)
    expect((await resumed.session.resume('room-2', 'guest')).playerId).toBe('guest')
    expect(n.hasToken('guest', old)).toBe(false)
    await resumed.session.leaveRoom('post-lost-rekey-ack')
    await n.host.stop()
  })

  it('keeps newly rotated native vault valid after a lost rekey confirmation', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    n.drop('rekeyConfirmedV2')
    await vi.waitFor(() => expect(n.getCredential()!.resumeToken).not.toBe(old))
    await vi.waitFor(() => expect(n.hasToken('guest', old)).toBe(false))
    await first.session.disconnect()
    const resumed = n.guest(250)
    expect((await resumed.session.resume('room-2', 'guest')).playerId).toBe('guest')
    await resumed.session.leaveRoom('post-lost-rekey-confirmation')
    await n.host.stop()
  })

  it('retries the exact offer after a transient Android vault failure without revoking the old credential', async () => {
    const n = network(35, 35)
    const first = n.guest(300)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    n.failRotation(1)
    await vi.waitFor(() => expect(n.nativeHost.sendV2.mock.calls
      .filter(([, frame]) => frame.kind === 'rekeyOfferV2').length).toBeGreaterThanOrEqual(2))
    await vi.waitFor(() => expect(n.getCredential()!.resumeToken).not.toBe(old))
    expect(n.hasToken('guest', old)).toBe(false)
    await first.session.leaveRoom('leave-after-vault-retry')
    await n.host.stop()
  })

  it('fails closed if registration or native revocation during rekey is uncertain', async () => {
    for (const failure of ['register', 'revoke'] as const) {
      const n = network(35)
      const first = n.guest(300)
      await n.enter(first)
      if (failure === 'register') n.failRegistration(1)
      else n.failRevocation(1)
      await vi.waitFor(() => expect(n.nativeHost.stop).toHaveBeenCalledTimes(1))
      await expect(n.host.processLocalCommand({ protocolVersion: 2,
        scope: 'room', roomId: 'room-2', playerId: 'host',
        commandId: 'denied', clientSeq: 1, type: 'READY',
        payload: { ready: true } }, 'host-conn')).rejects.toThrow('room_closed')
    }
  })

  it('renews across more than two token lifetimes without changing Room membership', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
      const n = network(55 * 60_000)
      const first = n.guest(500)
      await n.enter(first)
      const initialToken = n.getCredential()!.resumeToken
      const originalRevision = n.runtime.getRevision()
      await vi.advanceTimersByTimeAsync(5 * 60 * 60_000)
      const latest = n.getCredential()!
      expect(latest.resumeToken).not.toBe(initialToken)
      expect(latest.expiresAt).toBeGreaterThan(Date.now())
      expect(n.runtime.getRevision()).toBe(originalRevision)
      expect(n.nativeHost.registerResumeToken.mock.calls.length).toBeGreaterThanOrEqual(5)
      await first.session.disconnect()
      const resumed = n.guest(500)
      expect((await resumed.session.resume('room-2', 'guest')).playerId).toBe('guest')
      await resumed.session.leaveRoom('long-session-finished')
      await n.host.stop()
    } finally { vi.useRealTimers() }
  })

  it('waits for an in-flight native vault rotation before terminal leave', async () => {
    const n = network(35)
    const first = n.guest(300)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    const release = n.pauseNextRotation()
    await vi.waitFor(() => expect(n.nativeHost.sendV2.mock.calls
      .some(([, frame]) => frame.kind === 'rekeyOfferV2')).toBe(true))
    const leaving = first.session.leaveRoom('leave-during-vault-write')
    release()
    await leaving
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.hasToken('guest', old)).toBe(false)
    expect(n.getCredential()).toBeNull()
    await n.host.stop()
  })

  it('revokes both current and pending rekey credentials on confirmed leave', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    n.dropGuest('rekeyAckV2')
    await vi.waitFor(() => expect(n.getCredential()!.resumeToken).not.toBe(old))
    const pending = n.getCredential()!.resumeToken
    expect(n.hasToken('guest', old)).toBe(true)
    expect(n.hasToken('guest', pending)).toBe(true)
    await vi.waitFor(() => expect(first.session.getRekeyCount()).toBeGreaterThanOrEqual(1))
    await new Promise(resolve => setTimeout(resolve, 10))
    await first.session.leaveRoom('leave-during-pending-rekey')
    expect(n.hasToken('guest', old)).toBe(false)
    expect(n.hasToken('guest', pending)).toBe(false)
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.getCredential()).toBeNull()
    await n.host.stop()
  })

  it('does not accept a forged rekey ACK or advance guest command sequence', async () => {
    const n = network(35)
    const first = n.guest(250)
    await n.enter(first)
    const old = n.getCredential()!.resumeToken
    n.drop('rekeyOfferV2')
    await vi.waitFor(() => expect(n.nativeHost.sendV2.mock.calls
      .some(([, frame]) => frame.kind === 'rekeyOfferV2')).toBe(true))
    const revision = n.runtime.getRevision()
    n.inject(first.peerId, { kind: 'rekeyAckV2', protocolVersion: 2,
      roomId: 'room-2', playerId: 'guest', rekeyId: 'ab'.repeat(32) })
    await vi.waitFor(() => expect(n.nativeHost.closePeer).toHaveBeenCalledWith(first.peerId))
    expect(n.runtime.hasMembership('guest')).toBe(true)
    expect(n.runtime.getRevision()).toBe(revision + 1) // connection is now disconnected only
    expect(n.hasToken('guest', old)).toBe(true)
    await n.host.stop()
  })

  it('keeps three members and two independent Android-vault identities with no cross-private projection', async () => {
    const n = network()
    const first = n.guest(200, 'device-A')
    await n.enter(first)
    const other = n.guest(200, 'device-B')
    const joinedB = await other.session.connectInvite(n.host.currentInvite!, () => n.host.hostCode())
    expect(joinedB.playerId).toBe('guest-2')
    expect(n.runtime.getRevision()).toBe(3)
    const tokenA = n.getCredential('device-A')!.resumeToken
    const tokenB = n.getCredential('device-B')!.resumeToken
    expect(tokenA).not.toBe(tokenB)
    expect(n.hasToken('guest', tokenA)).toBe(true)
    expect(n.hasToken('guest-2', tokenB)).toBe(true)
    const hostAction = async (seq: number, type: string, payload: unknown) => {
      const result = await n.host.processLocalCommand({
        protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'host',
        commandId: 'multi-' + seq, clientSeq: seq, type, payload,
      }, 'host-conn')
      expect(result.status).toBe('accepted')
    }
    await hostAction(1, 'SELECT_GAME', { gameId: 'toy' })
    await hostAction(2, 'CONFIGURE_GAME', { rounds: 2 })
    await hostAction(3, 'READY', { ready: true })
    expect((await first.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status)
      .toBe('accepted')
    expect((await other.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status)
      .toBe('accepted')
    await hostAction(4, 'START_GAME', null)
    const secretA = (first.session.getState()?.privateState?.data as { secret: string }).secret
    const secretB = (other.session.getState()?.privateState?.data as { secret: string }).secret
    expect(secretA).not.toBe(secretB)
    expect(JSON.stringify(first.session.getState())).not.toContain(secretB)
    expect(JSON.stringify(other.session.getState())).not.toContain(secretA)

    // Another device cannot claim the first player's identity using its own native credential.
    await other.session.disconnect()
    const spoof = n.guest(200, 'device-B')
    await spoof.native.connectV2()
    n.inject(spoof.peerId, { kind: 'resumeHello', protocolVersion: 2, roomId: 'room-2',
      playerId: 'guest', resumeToken: tokenB })
    await vi.waitFor(() => expect(n.nativeHost.closePeer).toHaveBeenCalledWith(spoof.peerId))
    expect(n.runtime.hasMembership('guest')).toBe(true)
    expect(n.runtime.hasMembership('guest-2')).toBe(true)

    const resumedB = n.guest(200, 'device-B')
    const restored = await resumedB.session.resume('room-2', 'guest-2')
    expect(restored.snapshot.privateState?.data).toEqual({ secret: secretB })
    expect(JSON.stringify(restored.snapshot)).not.toContain(secretA)
    await first.session.leaveRoom('remove-a')
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.runtime.hasMembership('guest-2')).toBe(true)
    expect(n.hasToken('guest', tokenA)).toBe(false)
    expect(n.getCredential('device-A')).toBeNull()
    expect(n.getCredential('device-B')).not.toBeNull()
    expect((await resumedB.session.sendCommand({ scope: 'game', type: 'TOY_CLUE',
      payload: null, gameSessionId: restored.snapshot.roomState.currentGameSessionId! })).status).toBe('accepted')
    await resumedB.session.leaveRoom('remove-b')
    expect(n.getCredential('device-B')).toBeNull()
    await n.host.stop()
  })

  it('recovers rotated Keystore identity when resume ACK is lost before reaching the host', async () => {
    const n = network()
    const first = n.guest(200)
    await n.enter(first)
    const original = n.getCredential()!.resumeToken
    await first.session.disconnect()
    n.dropGuest('resumeAckV2')
    const second = n.guest(70)
    await expect(second.session.resume('room-2', 'guest')).rejects.toThrow('admission_timeout')
    const persistedPending = n.getCredential()!.resumeToken
    expect(persistedPending).not.toBe(original)
    expect(n.hasToken('guest', persistedPending)).toBe(true)
    expect(n.runtime.hasMembership('guest')).toBe(true)
    const third = n.guest(200)
    const restored = await third.session.resume('room-2', 'guest')
    expect(restored.playerId).toBe('guest')
    expect(n.hasToken('guest', original)).toBe(false)
    expect(n.hasToken('guest', persistedPending)).toBe(false)
    expect(n.hasToken('guest', n.getCredential()!.resumeToken)).toBe(true)
    await third.session.leaveRoom('leave-after-lost-resume-ack')
    await n.host.stop()
  })

  it('preserves membership, player sequence and revokes previous token and socket', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    const initialToken = n.getCredential()!.resumeToken
    expect((await first.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status)
      .toBe('accepted')
    const revision = n.runtime.getRevision()
    const second = n.guest()
    const resumed = await second.session.resume('room-2', 'guest')
    expect(resumed.playerId).toBe('guest')
    expect(resumed.snapshot.nextClientSeq).toBe(2)
    expect(n.runtime.getRevision()).toBe(revision + 1)
    expect(n.runtime.getConnectionId('guest')).not.toBeNull()
    expect(n.host.playerForPeer(first.peerId)).toBeNull()
    expect(n.host.playerForPeer(second.peerId)).toBe('guest')
    expect(first.session.getState()).toBeNull()
    expect(n.hasToken('guest', initialToken)).toBe(false)
    expect(n.hasToken('guest', n.getCredential()!.resumeToken)).toBe(true)
    expect((await second.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: false } })).status)
      .toBe('accepted')
    expect(n.runtime.hasMembership('guest')).toBe(true)
    await second.session.disconnect()
    await n.host.stop()
  })

  it('restores disconnected membership, then definitively leaves with native revocation and vault cleanup', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    const before = n.runtime.getRevision()
    await first.session.disconnect()
    await vi.waitFor(() => expect(n.runtime.getConnectionId('guest')).toBeNull())
    expect(n.runtime.hasMembership('guest')).toBe(true)
    expect(n.runtime.getRevision()).toBe(before + 1)
    const resumed = n.guest()
    await resumed.session.resume('room-2', 'guest')
    const activeToken = n.getCredential()!.resumeToken
    const revision = n.runtime.getRevision()
    await resumed.session.leaveRoom('leave-1')
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.runtime.getRevision()).toBe(revision + 1)
    expect(n.getCredential()).toBeNull()
    expect(n.hasToken('guest', activeToken)).toBe(false)
    expect(n.host.playerForPeer(resumed.peerId)).toBeNull()
    await n.host.stop()
  })

  it('recovers when resume confirmation is lost: persisted pending token can resume again', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    await first.session.disconnect()
    const before = n.getCredential()!.resumeToken
    n.drop('resumeConfirmedV2')
    const second = n.guest(80)
    await expect(second.session.resume('room-2', 'guest')).rejects.toThrow('admission_timeout')
    const pendingToken = n.getCredential()!.resumeToken
    expect(pendingToken).not.toBe(before)
    expect(n.hasToken('guest', before)).toBe(false)
    expect(n.hasToken('guest', pendingToken)).toBe(true)
    const third = n.guest()
    const resumed = await third.session.resume('room-2', 'guest')
    expect(resumed.playerId).toBe('guest')
    expect(n.runtime.hasMembership('guest')).toBe(true)
    expect(n.host.playerForPeer(third.peerId)).toBe('guest')
    expect(n.hasToken('guest', pendingToken)).toBe(false)
    await third.session.disconnect()
    await n.host.stop()
  })

  it('rejects forged resume IDs without accepting further commands from that peer', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    await first.session.disconnect()
    const next = n.guest(90)
    n.drop('resumedV2')
    const promise = next.session.resume('room-2', 'guest')
    await vi.waitFor(() => expect(n.nativeHost.sendV2.mock.calls
      .some(([, f]) => f.kind === 'resumedV2')).toBe(true))
    n.inject(next.peerId, { kind: 'resumeAckV2', protocolVersion: 2, roomId: 'room-2',
      playerId: 'guest', resumeId: '01'.repeat(32) })
    await expect(promise).rejects.toThrow()
    expect(n.host.playerForPeer(next.peerId)).toBeNull()
    expect(n.runtime.hasMembership('guest')).toBe(true)
    await n.host.stop()
  })

  it('keeps the encrypted credential after a lost leave confirmation and refuses resume after revocation', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    const saved = n.getCredential()!.resumeToken
    n.drop('leaveConfirmedV2')
    await expect(first.session.leaveRoom('leave-lost')).rejects.toThrow('leave_unconfirmed')
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.getCredential()?.resumeToken).toBe(saved)
    expect(n.hasToken('guest', saved)).toBe(false)
    const retry = n.guest(90)
    await expect(retry.session.resume('room-2', 'guest')).rejects.toThrow('invalid_native_resume')
    await n.host.stop()
  })

  it('resumes during toy A with the same private secret, then clears it when entering counter B', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    const hostAction = (seq: number, type: string, payload: unknown) => n.host.processLocalCommand({
      protocolVersion: 2, scope: 'room', roomId: 'room-2', playerId: 'host',
      commandId: `h-${seq}`, clientSeq: seq, type, payload,
    }, 'host-conn')
    expect((await hostAction(1, 'SELECT_GAME', { gameId: 'toy' })).status).toBe('accepted')
    expect((await hostAction(2, 'CONFIGURE_GAME', { rounds: 2 })).status).toBe('accepted')
    expect((await hostAction(3, 'READY', { ready: true })).status).toBe('accepted')
    expect((await first.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status)
      .toBe('accepted')
    expect((await hostAction(4, 'START_GAME', null)).status).toBe('accepted')
    const before = first.session.getState()
    const sessionA = before?.roomState.currentGameSessionId
    const privateA = before?.privateState
    expect(before?.roomState.phase).toBe('playing')
    expect(privateA).not.toBeNull()
    const oldRevision = before!.revision
    await first.session.disconnect()
    const recovered = n.guest()
    const restored = await recovered.session.resume('room-2', 'guest')
    expect(restored.snapshot.roomState.currentGameSessionId).toBe(sessionA)
    expect(restored.snapshot.privateState).toEqual(privateA)
    expect(restored.snapshot.revision).toBeGreaterThan(oldRevision)
    expect(recovered.session.getState()?.privateState).toEqual(privateA)
    expect((await hostAction(5, 'END_GAME', null)).status).toBe('accepted')
    expect((await hostAction(6, 'RETURN_TO_LOBBY', null)).status).toBe('accepted')
    expect(recovered.session.getState()?.privateState).toBeNull()
    expect((await hostAction(7, 'SELECT_GAME', { gameId: 'counter' })).status).toBe('accepted')
    expect((await hostAction(8, 'CONFIGURE_GAME', { target: 3 })).status).toBe('accepted')
    expect((await hostAction(9, 'READY', { ready: true })).status).toBe('accepted')
    expect((await recovered.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } })).status)
      .toBe('accepted')
    expect((await hostAction(10, 'START_GAME', null)).status).toBe('accepted')
    const inB = recovered.session.getState()
    expect(inB?.roomState.currentGameSessionId).not.toBe(sessionA)
    expect(inB?.privateState).toBeNull()
    expect(JSON.stringify(inB)).not.toContain(
      (privateA?.data as { secret: string }).secret,
    )
    await recovered.session.leaveRoom('leave-after-b')
    await n.host.stop()
  })

  it('fails closed if revocation is uncertain and the last authorized socket disconnects', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    n.failRevocation(1)
    await expect(first.session.leaveRoom('leave-uncertain')).rejects.toThrow('revocation_failed')
    expect(n.runtime.hasMembership('guest')).toBe(true)
    await first.session.disconnect()
    await vi.waitFor(() => expect(n.nativeHost.stop).toHaveBeenCalledTimes(1))
    const stale = n.guest(90)
    await expect(stale.session.resume('room-2', 'guest')).rejects.toThrow()
    expect(n.host.playerForPeer(first.peerId)).toBeNull()
  })

  it('keeps member locked on uncertain native revocation and allows retry of terminal leave', async () => {
    const n = network()
    const first = n.guest()
    await n.enter(first)
    n.failRevocation(1)
    await expect(first.session.leaveRoom('leave-retry')).rejects.toThrow('revocation_failed')
    expect(n.runtime.hasMembership('guest')).toBe(true)
    await expect(first.session.sendCommand({ scope: 'room', type: 'READY', payload: { ready: true } }))
      .rejects.toThrow()
    await first.session.leaveRoom('leave-retry')
    expect(n.runtime.hasMembership('guest')).toBe(false)
    expect(n.getCredential()).toBeNull()
    await n.host.stop()
  })
})
