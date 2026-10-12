import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import { PERSISTENT_ROOM_PROTOCOL_VERSION } from '../persistentProtocol'
import type { RoomCommandV2 } from '../persistentProtocol'
import { decodePersistentLanFrame, encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame } from './lanPersistentWire'
import { decodeLanFrame, encodeLanFrame } from './lanWire'

const V2 = PERSISTENT_ROOM_PROTOCOL_VERSION

function fixture() {
  const room = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-one', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames), createPlayerId: () => 'guest',
  })
  const joined = room.joinGuest('guest-conn')
  if (!joined.ok) throw new Error(joined.error)
  const hostSnapshot = room.snapshotFor('host', 'host-conn')
  if (!hostSnapshot.ok) throw new Error(hostSnapshot.error)
  return { host: hostSnapshot.snapshot, guest: joined.snapshot }
}
function cmd(): RoomCommandV2 {
  return { protocolVersion: V2, scope: 'room', roomId: 'room-one', playerId: 'host',
    commandId: 'cmd-1', clientSeq: 1, type: 'SELECT_GAME', payload: { gameId: 'toy' } }
}
function roundtrip(frame: PersistentLanFrame) {
  expect(decodePersistentLanFrame(encodePersistentLanFrame(frame))).toEqual({ ok: true, frame })
}

describe('isolated persistent LAN v2 wire codec', () => {
  it('roundtrips room commands, results, snapshots, events and resync', () => {
    const { host } = fixture()
    roundtrip({ kind: 'commandV2', protocolVersion: V2, command: cmd() })
    roundtrip({ kind: 'commandResultV2', protocolVersion: V2,
      result: { protocolVersion: V2, roomId: 'room-one', commandId: 'cmd-1',
        revision: host.revision, nextClientSeq: 2, status: 'accepted' } })
    roundtrip({ kind: 'snapshotV2', protocolVersion: V2, snapshot: host })
    roundtrip({ kind: 'eventV2', protocolVersion: V2, event: { ...host, kind: 'projection' } })
    roundtrip({ kind: 'eventV2', protocolVersion: V2,
      event: { kind: 'marker', protocolVersion: V2, roomId: 'room-one', revision: host.revision } })
    roundtrip({ kind: 'resyncV2', protocolVersion: V2,
      request: { protocolVersion: V2, roomId: 'room-one', playerId: 'guest', lastAppliedRevision: 2 } })
  })

  it('keeps LAN v1 usable independently and never accepts its wire envelope as v2', () => {
    const old = { kind: 'roomClosed', protocolVersion: 1, roomId: 'room-one' } as const
    expect(decodeLanFrame(encodeLanFrame(old))).toEqual({ ok: true, frame: old })
    expect(decodePersistentLanFrame(encodeLanFrame(old))).toEqual({ ok: false, error: 'incompatible_protocol' })
    expect(decodeLanFrame(JSON.stringify({ kind: 'commandV2', protocolVersion: 2, command: cmd() })))
      .toEqual({ ok: false, error: 'invalid_frame' })
  })

  it('rejects v1 and unversioned v2 shapes without a downgrade', () => {
    for (const bad of [
      { kind: 'commandV2', protocolVersion: 1, command: cmd() },
      { kind: 'snapshotV2', snapshot: fixture().host },
      { kind: 'eventV2', protocolVersion: 77, event: { kind: 'marker' } },
    ]) expect(decodePersistentLanFrame(JSON.stringify(bad))).toEqual({ ok: false, error: 'incompatible_protocol' })
  })

  it('rejects malformed v2 commands including missing gameSessionId and invalid JSON payload', () => {
    const game = { ...cmd(), scope: 'game', type: 'INCREMENT' }
    expect(decodePersistentLanFrame(JSON.stringify({ kind: 'commandV2', protocolVersion: V2, command: game })))
      .toEqual({ ok: false, error: 'invalid_frame' })
    const invalid = { ...cmd(), payload: { value: null }, clientSeq: 0 }
    expect(decodePersistentLanFrame(JSON.stringify({ kind: 'commandV2', protocolVersion: V2, command: invalid })))
      .toEqual({ ok: false, error: 'invalid_frame' })
  })

  it('rejects malformed snapshots, foreign private sessions and forged host membership', () => {
    const { host } = fixture()
    const base = { kind: 'snapshotV2', protocolVersion: V2 }
    for (const snapshot of [
      { ...host, roomState: { ...host.roomState, members: [] } },
      { ...host, roomState: { ...host.roomState,
        members: host.roomState.members.map(m => ({ ...m, role: 'owner' })) } },
      { ...host, privateState: { gameId: 'toy', gameSessionId: 'foreign', data: { secret: 'x' } } },
      { ...host, nextClientSeq: -1 },
      { ...host, roomState: { ...host.roomState, currentGameSessionId: 'session-1' },
        gamePublicState: { gameId: 'toy', gameSessionId: 'other-session', data: {} } },
    ]) expect(decodePersistentLanFrame(JSON.stringify({ ...base, snapshot })))
      .toEqual({ ok: false, error: 'invalid_frame' })
  })

  it('rejects malformed resync, marker and command-result controls', () => {
    const cases = [
      { kind: 'resyncV2', protocolVersion: V2,
        request: { protocolVersion: V2, roomId: 'room-one', playerId: 'guest', lastAppliedRevision: -1 } },
      { kind: 'eventV2', protocolVersion: V2,
        event: { kind: 'marker', protocolVersion: V2, roomId: 'room-one', revision: -1 } },
      { kind: 'commandResultV2', protocolVersion: V2,
        result: { protocolVersion: V2, roomId: 'room-one', status: 'accepted', commandId: 'c',
          revision: 3, nextClientSeq: -4 } },
    ]
    for (const frame of cases) expect(decodePersistentLanFrame(JSON.stringify(frame)))
      .toEqual({ ok: false, error: 'invalid_frame' })
  })

  it('enforces 16 KiB UTF-8 limit on both encode and decode', () => {
    const frame: PersistentLanFrame = { kind: 'commandV2', protocolVersion: V2,
      command: { ...cmd(), payload: { text: '🚀'.repeat(5000) } } }
    expect(() => encodePersistentLanFrame(frame)).toThrow('frame_too_large')
    expect(decodePersistentLanFrame(JSON.stringify(frame)))
      .toEqual({ ok: false, error: 'frame_too_large' })
  })

  it('rejects unknown, broken and non-JSON frames', () => {
    expect(decodePersistentLanFrame('{')).toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodePersistentLanFrame('[]')).toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodePersistentLanFrame(JSON.stringify({ kind: 'not-a-frame', protocolVersion: V2 })))
      .toEqual({ ok: false, error: 'invalid_frame' })
    expect(() => encodePersistentLanFrame({ kind: 'commandV2', protocolVersion: V2,
      command: { ...cmd(), payload: { n: Number.NaN } } })).toThrow('invalid_frame')
  })

  it('preserves per-recipient private projection without mutating either snapshot', () => {
    const { host, guest } = fixture()
    const guestFrame: PersistentLanFrame = { kind: 'snapshotV2', protocolVersion: V2, snapshot: guest }
    const hostFrame: PersistentLanFrame = { kind: 'snapshotV2', protocolVersion: V2, snapshot: host }
    const g = decodePersistentLanFrame(encodePersistentLanFrame(guestFrame))
    const h = decodePersistentLanFrame(encodePersistentLanFrame(hostFrame))
    expect(g.ok && h.ok).toBe(true)
    if (!g.ok || !h.ok || g.frame.kind !== 'snapshotV2' || h.frame.kind !== 'snapshotV2') return
    expect(g.frame.snapshot.roomState.hostPlayerId).toBe('host')
    expect(g.frame.snapshot.roomState.members).toHaveLength(2)
    expect(g.frame.snapshot.privateState).toBeNull()
    expect(h.frame.snapshot.privateState).toBeNull()
  })

  it('roundtrips actual playing and lobby snapshots without exposing another player secret', () => {
    const adapter = new RoomLifecycleAdapter(syntheticMultiplayerGames)
    const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'live', hostPlayerId: 'host',
      hostConnectionId: 'conn-h', adapter, createPlayerId: () => 'guest',
      clock: { now: () => 100 }, random: () => 0.5 })
    const joined = runtime.joinGuest('conn-g')
    if (!joined.ok) throw new Error('join failed')
    const send = (seq: number, playerId: string, conn: string, type: string, payload: unknown) =>
      runtime.processCommand({ protocolVersion: V2, scope: 'room', roomId: 'live',
        playerId, commandId: `${playerId}-${seq}`, clientSeq: seq, type, payload }, conn)
    expect(send(1, 'host', 'conn-h', 'SELECT_GAME', { gameId: 'toy' }).result.status).toBe('accepted')
    expect(send(2, 'host', 'conn-h', 'CONFIGURE_GAME', { rounds: 2 }).result.status).toBe('accepted')
    expect(send(3, 'host', 'conn-h', 'READY', { ready: true }).result.status).toBe('accepted')
    expect(send(1, 'guest', 'conn-g', 'READY', { ready: true }).result.status).toBe('accepted')
    expect(send(4, 'host', 'conn-h', 'START_GAME', null).result.status).toBe('accepted')
    const a = runtime.snapshotFor('host', 'conn-h')
    const b = runtime.snapshotFor('guest', 'conn-g')
    if (!a.ok || !b.ok) throw new Error('snapshot failed')
    const wireA = encodePersistentLanFrame({ kind: 'snapshotV2', protocolVersion: V2, snapshot: a.snapshot })
    const wireB = encodePersistentLanFrame({ kind: 'snapshotV2', protocolVersion: V2, snapshot: b.snapshot })
    const secretA = (a.snapshot.privateState?.data as { secret: string }).secret
    const secretB = (b.snapshot.privateState?.data as { secret: string }).secret
    expect(secretA).not.toBe(secretB)
    expect(wireA).not.toContain(secretB)
    expect(wireB).not.toContain(secretA)
    expect(decodePersistentLanFrame(wireA).ok).toBe(true)
    expect(decodePersistentLanFrame(wireB).ok).toBe(true)
    expect(send(5, 'host', 'conn-h', 'END_GAME', null).result.status).toBe('accepted')
    expect(send(6, 'host', 'conn-h', 'RETURN_TO_LOBBY', null).result.status).toBe('accepted')
    const after = runtime.snapshotFor('guest', 'conn-g')
    if (!after.ok) throw new Error('no lobby')
    const lobby = encodePersistentLanFrame({ kind: 'snapshotV2', protocolVersion: V2, snapshot: after.snapshot })
    expect(lobby).not.toContain(secretA)
    expect(lobby).not.toContain(secretB)
    expect(after.snapshot.privateState).toBeNull()
  })

  it('rejects barriers attributed to a different GameSession', () => {
    const host = fixture().host
    const playing = { ...host,
      roomState: { ...host.roomState, phase: 'playing', selectedGameId: 'toy',
        currentGameSessionId: 'game-a', barriers: [{ gameSessionId: 'game-b', id: 'b',
          type: 'checkpoint', expectedCount: 2, completedCount: 0, isComplete: false }] },
      gamePublicState: { gameSessionId: 'game-a', gameId: 'toy', data: { clueCount: 0 } } }
    expect(decodePersistentLanFrame(JSON.stringify({ kind: 'snapshotV2', protocolVersion: V2, snapshot: playing })))
      .toEqual({ ok: false, error: 'invalid_frame' })
  })

})
