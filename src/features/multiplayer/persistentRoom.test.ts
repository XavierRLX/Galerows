import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from './persistentRoom'
import { ClientReplicaV2 } from './persistentReplica'
import { syntheticMultiplayerGames } from './multiplayerGames.synthetic'
import { defineMultiplayerGame, type RegisteredMultiplayerGame } from './multiplayerGames'
import { parseRoomCommandV2 } from './persistentProtocol'

function setup(games: readonly RegisteredMultiplayerGame[] = syntheticMultiplayerGames) {
  let nextPlayer = 0
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'room', hostPlayerId: 'host',
    hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter(games),
    createPlayerId: () => `guest-${++nextPlayer}`, clock: { now: () => 1000 }, random: () => 0.25 })
  const guest = runtime.joinGuest('guest-conn')
  if (!guest.ok) throw new Error('guest join failed')
  const send = (playerId: string, connectionId: string, clientSeq: number, type: string,
    payload: unknown = null, scope: 'room' | 'game' = 'room', gameSessionId?: string, commandId = `${playerId}-${clientSeq}`) =>
    runtime.processCommand({ protocolVersion: 2, roomId: 'room', playerId, commandId,
      clientSeq, scope, type, payload, ...(gameSessionId ? { gameSessionId } : {}) }, connectionId)
  const host = (seq: number, type: string, payload: unknown = null) => send('host', 'host-conn', seq, type, payload)
  const player = (seq: number, type: string, payload: unknown = null) => send(guest.playerId, 'guest-conn', seq, type, payload)
  return { runtime, guest, send, host, player }
}

function startToy(s: ReturnType<typeof setup>) {
  expect(s.host(1, 'SELECT_GAME', { gameId: 'toy' }).result.status).toBe('accepted')
  expect(s.host(2, 'CONFIGURE_GAME', { rounds: 2 }).result.status).toBe('accepted')
  expect(s.host(3, 'READY', { ready: true }).result.status).toBe('accepted')
  expect(s.player(1, 'READY', { ready: true }).result.status).toBe('accepted')
  const started = s.host(4, 'START_GAME')
  expect(started.result.status).toBe('accepted')
  const snapshot = s.runtime.snapshotFor('host', 'host-conn')
  if (!snapshot.ok) throw new Error('no host snapshot')
  return { started, sessionId: snapshot.snapshot.roomState.currentGameSessionId! }
}

describe('persistent Room core v2', () => {
  it('emits consecutive room revisions for each visible lifecycle change', () => {
    const s = setup()
    const outcomes = [s.host(1, 'SELECT_GAME', { gameId: 'toy' }),
      s.host(2, 'CONFIGURE_GAME', { rounds: 2 }),
      s.host(3, 'READY', { ready: true }),
      s.player(1, 'READY', { ready: true }),
      s.host(4, 'START_GAME'), s.host(5, 'END_GAME'), s.host(6, 'RETURN_TO_LOBBY')]
    expect(outcomes.map(outcome => outcome.result.revision)).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(outcomes.flatMap(outcome => outcome.deliveries).every(delivery =>
      delivery.event.revision >= 3 && delivery.event.revision <= 9)).toBe(true)
    expect(s.runtime.getRevision()).toBe(9)
  })

  it('keeps members and one revision across toy A, results, lobby and counter B', () => {
    const s = setup()
    const beforePlayers = s.runtime.snapshotFor('host', 'host-conn')
    const a = startToy(s)
    expect(s.host(5, 'END_GAME').result.status).toBe('accepted')
    expect(s.host(6, 'RETURN_TO_LOBBY').result.status).toBe('accepted')
    const lobby = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    expect(lobby).toMatchObject({ ok: true, snapshot: { roomState: { phase: 'lobby' },
      gamePublicState: null, privateState: null } })
    expect(s.host(7, 'SELECT_GAME', { gameId: 'counter' }).result.status).toBe('accepted')
    expect(s.host(8, 'CONFIGURE_GAME', { target: 5 }).result.status).toBe('accepted')
    expect(s.host(9, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.player(2, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.host(10, 'START_GAME').result.status).toBe('accepted')
    const b = s.runtime.snapshotFor('host', 'host-conn')
    expect(beforePlayers.ok && b.ok && b.snapshot.roomState.members.map(m => m.playerId))
      .toEqual(['host', s.guest.playerId])
    if (!b.ok) throw new Error('no B snapshot')
    expect(b.snapshot.roomState.currentGameSessionId).not.toBe(a.sessionId)
    expect(b.snapshot.revision).toBeGreaterThan(lobby.ok ? lobby.snapshot.revision : 0)
    expect(b.snapshot.revision).toBe(s.runtime.getRevision())
  })

  it('does not let a caller mutate validated configuration through a snapshot', () => {
    const s = setup()
    s.host(1, 'SELECT_GAME', { gameId: 'toy' })
    s.host(2, 'CONFIGURE_GAME', { rounds: 2 })
    const projected = s.runtime.snapshotFor('host', 'host-conn')
    if (!projected.ok) throw new Error('no snapshot')
    ;(projected.snapshot.roomState.selectedConfig as { rounds: number }).rounds = 5
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.status).toBe('accepted')
    const after = s.runtime.snapshotFor('host', 'host-conn')
    expect(after.ok && after.snapshot.gamePublicState?.data).toMatchObject({ rounds: 2 })
  })

  it('rejects guest host actions and START with invalid phase, readiness or player count', () => {
    const s = setup()
    const before = s.runtime.getRevision()
    expect(s.player(1, 'SELECT_GAME', { gameId: 'toy' }).result.error).toBe('unauthorized')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.host(1, 'START_GAME').result.error).toBe('invalid_phase')
    expect(s.host(2, 'SELECT_GAME', { gameId: 'toy' }).result.status).toBe('accepted')
    expect(s.host(3, 'CONFIGURE_GAME', { rounds: 0 }).result.error).toBe('invalid_config')
    expect(s.host(4, 'CONFIGURE_GAME', { rounds: 2 }).result.status).toBe('accepted')
    expect(s.host(5, 'START_GAME').result.error).toBe('not_ready')
    expect(s.host(6, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.host(7, 'START_GAME').result.error).toBe('not_ready')
    expect(s.player(2, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.host(8, 'START_GAME').result.status).toBe('accepted')
    expect(s.player(3, 'END_GAME').result.error).toBe('unauthorized')
    expect(s.player(4, 'RETURN_TO_LOBBY').result.error).toBe('unauthorized')
  })

  it('deduplicates a START retry and rejects conflicting or old sequence without a second session', () => {
    const s = setup()
    const { started, sessionId } = startToy(s)
    const retry = s.send('host', 'host-conn', 4, 'START_GAME', null, 'room', undefined, 'host-4')
    expect(retry.result).toEqual(started.result)
    expect(retry.deduplicated).toBe(true)
    expect(s.send('host', 'host-conn', 4, 'END_GAME', null, 'room', undefined, 'host-4').result.error)
      .toBe('command_conflict')
    expect(s.host(6, 'END_GAME').result.error).toBe('future_sequence')
    expect(s.host(5, 'END_GAME').result.status).toBe('accepted')
    expect(s.send('host', 'host-conn', 4, 'START_GAME', null, 'room', undefined, 'host-4').result.error)
      .toBe('stale_sequence')
    const current = s.runtime.snapshotFor('host', 'host-conn')
    expect(current.ok && current.snapshot.roomState.currentGameSessionId).toBe(sessionId)
  })

  it('rejects reuse of a recent commandId with a fresh sequence', () => {
    const s = setup()
    s.host(1, 'SELECT_GAME', { gameId: 'toy' })
    s.host(2, 'CONFIGURE_GAME', { rounds: 2 })
    const before = s.runtime.getRevision()
    const reused = s.send('host', 'host-conn', 3, 'READY', { ready: true }, 'room', undefined, 'host-1')
    expect(reused.result.error).toBe('command_conflict')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.host(3, 'READY', { ready: true }).result.status).toBe('accepted')
  })

  it('keeps the cached retry result authoritative if a caller mutates its first copy', () => {
    const s = setup()
    const first = s.host(1, 'SELECT_GAME', { gameId: 'toy' })
    first.result.status = 'rejected'
    const retry = s.host(1, 'SELECT_GAME', { gameId: 'toy' })
    expect(retry.result.status).toBe('accepted')
    expect(retry.deduplicated).toBe(true)
  })

  it('keeps toy secrets private, makes mid-game join wait, and rejects old-session commands', () => {
    const s = setup()
    const a = startToy(s)
    const hostA = s.runtime.snapshotFor('host', 'host-conn')
    const guestA = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    expect(hostA.ok && hostA.snapshot.gamePublicState?.data).toMatchObject({ startedAt: 1000 })
    expect(hostA.ok && hostA.snapshot.privateState).not.toEqual(guestA.ok && guestA.snapshot.privateState)
    const waiting = s.runtime.joinGuest('waiting-conn')
    expect(waiting).toMatchObject({ ok: true, snapshot: { privateState: null } })
    if (!waiting.ok) throw new Error('waiting join failed')
    expect(waiting.snapshot.roomState.members.find(m => m.playerId === waiting.playerId)?.participation).toBe('waiting')
    expect(s.send(waiting.playerId, 'waiting-conn', 1, 'TOY_CHECKPOINT', { id: 'x' }, 'game', a.sessionId).result.error)
      .toBe('not_participant')
    expect(s.host(5, 'END_GAME').result.status).toBe('accepted')
    expect(s.host(6, 'RETURN_TO_LOBBY').result.status).toBe('accepted')
    expect(s.host(7, 'SELECT_GAME', { gameId: 'counter' }).result.status).toBe('accepted')
    expect(s.host(8, 'CONFIGURE_GAME', { target: 3 }).result.status).toBe('accepted')
    expect(s.host(9, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.player(2, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.send(waiting.playerId, 'waiting-conn', 2, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.host(10, 'START_GAME').result.status).toBe('accepted')
    const before = s.runtime.getRevision()
    expect(s.send(s.guest.playerId, 'guest-conn', 3, 'TOY_CHECKPOINT', { id: 'late' }, 'game', a.sessionId).result.error)
      .toBe('stale_game_session')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.runtime.snapshotFor(waiting.playerId, 'waiting-conn')).toMatchObject({ ok: true,
      snapshot: { gamePublicState: { gameId: 'counter' }, privateState: null } })
  })

  it('isolates three simultaneous private projections without leaking secrets into public state', () => {
    const s = setup()
    const second = s.runtime.joinGuest('second-conn')
    if (!second.ok) throw new Error('second guest failed')
    s.host(1, 'SELECT_GAME', { gameId: 'toy' }); s.host(2, 'CONFIGURE_GAME', { rounds: 2 })
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    s.send(second.playerId, 'second-conn', 1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.status).toBe('accepted')
    const views = [s.runtime.snapshotFor('host', 'host-conn'),
      s.runtime.snapshotFor(s.guest.playerId, 'guest-conn'),
      s.runtime.snapshotFor(second.playerId, 'second-conn')]
    expect(views.every(view => view.ok)).toBe(true)
    const secrets = views.map(view => view.ok && (view.snapshot.privateState?.data as { secret: string }).secret)
    expect(new Set(secrets).size).toBe(3)
    for (const view of views) {
      if (!view.ok) continue
      const publicJson = JSON.stringify({ roomState: view.snapshot.roomState, gamePublicState: view.snapshot.gamePublicState })
      for (const secret of secrets) expect(publicJson).not.toContain(secret)
      const otherSecrets = secrets.filter(secret => secret !== (view.snapshot.privateState?.data as { secret: string }).secret)
      for (const secret of otherSecrets) expect(JSON.stringify(view.snapshot)).not.toContain(secret)
    }
  })

  it('uses a safe snapshot to clear an old secret after a revision gap', () => {
    const s = setup(); startToy(s)
    const initial = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    if (!initial.ok) throw new Error('no initial snapshot')
    const replica = new ClientReplicaV2('room', initial.snapshot)
    s.host(5, 'END_GAME'); s.host(6, 'RETURN_TO_LOBBY')
    const lobby = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    if (!lobby.ok) throw new Error('no lobby snapshot')
    expect(replica.applyEvent({ protocolVersion: 2, roomId: 'room', kind: 'marker', revision: lobby.snapshot.revision })).toBe('gap')
    expect(replica.getState().privateState).toBeNull()
    expect(replica.getState().gamePublicState).toBeNull()
    expect(replica.applySnapshot({ ...lobby.snapshot, revision: initial.snapshot.revision - 1 })).toBe('stale')
    expect(replica.applySnapshot({ ...lobby.snapshot, roomId: 'other' })).toBe('wrong_room')
    expect(replica.applySnapshot(lobby.snapshot)).toBe('applied')
    expect(replica.getState()).toMatchObject({ lastAppliedRevision: lobby.snapshot.revision,
      privateState: null, gamePublicState: null, needsResync: false })
  })

  it('does not expose mutable replica state to its caller', () => {
    const s = setup()
    startToy(s)
    const snapshot = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    if (!snapshot.ok) throw new Error('no guest snapshot')
    const replica = new ClientReplicaV2('room', snapshot.snapshot)
    const privateBefore = replica.getState().privateState
    const view = replica.getState()
    view.roomState.members[0].playerId = 'forged'
    ;(view.privateState!.data as { secret: string }).secret = 'forged'
    ;(snapshot.snapshot.privateState!.data as { secret: string }).secret = 'forged-again'
    expect(replica.getState().roomState.members[0].playerId).toBe('host')
    expect(replica.getState().privateState).toEqual(privateBefore)
  })

  it('scopes barriers to one GameSession and clears them in the lobby', () => {
    const s = setup(); const a = startToy(s)
    expect(s.send('host', 'host-conn', 5, 'TOY_CHECKPOINT', { id: 'ready' }, 'game', a.sessionId).result.status)
      .toBe('accepted')
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { roomState: { barriers: [{ gameSessionId: a.sessionId, id: 'ready' }] } } })
    s.host(6, 'END_GAME'); s.host(7, 'RETURN_TO_LOBBY')
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { roomState: { barriers: [] }, privateState: null } })
  })

  it('versions v2 commands separately and rejects wrong identity before consuming sequence', () => {
    const s = setup()
    expect(parseRoomCommandV2({ protocolVersion: 1, roomId: 'room' })).toMatchObject({ ok: false, error: 'incompatible_protocol' })
    expect(s.runtime.processCommand({ protocolVersion: 1 }, 'guest-conn').result).toMatchObject({
      status: 'rejected', commandId: null, error: 'incompatible_protocol', nextClientSeq: null,
    })
    const forged = s.send(s.guest.playerId, 'host-conn', 1, 'READY', { ready: true })
    expect(forged.result.error).toBe('unauthorized')
    const own = s.player(1, 'READY', { ready: true })
    expect(own.result.status).toBe('accepted')
    const next = s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')
    expect(next.ok && next.snapshot.nextClientSeq).toBe(2)
  })

  it('revisions disconnect/resume without losing membership or accepting the old connection', () => {
    const s = setup()
    const before = s.runtime.getRevision()
    expect(s.runtime.disconnect('guest-conn').ok).toBe(true)
    expect(s.runtime.getRevision()).toBe(before + 1)
    expect(s.runtime.hasMembership(s.guest.playerId)).toBe(true)
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { roomState: { members: [expect.anything(), { playerId: s.guest.playerId, connected: false }] } } })
    const resumed = s.runtime.reassociate(s.guest.playerId, 'new-conn')
    expect(resumed.ok).toBe(true)
    expect(s.runtime.getRevision()).toBe(before + 2)
    expect(s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')).toMatchObject({ ok: false, error: 'unauthorized' })
    expect(s.runtime.snapshotFor(s.guest.playerId, 'new-conn')).toMatchObject({ ok: true,
      snapshot: { roomState: { members: [expect.anything(), { connected: true }] } } })
  })

  it('caps one Room at twelve memberships without advancing revision on overflow', () => {
    const s = setup()
    for (let index = 2; index <= 11; index++) expect(s.runtime.joinGuest(`conn-${index}`).ok).toBe(true)
    const before = s.runtime.getRevision()
    expect(s.runtime.joinGuest('thirteenth')).toEqual({ ok: false, error: 'room_full' })
    expect(s.runtime.getRevision()).toBe(before)
    const snapshot = s.runtime.snapshotFor('host', 'host-conn')
    expect(snapshot.ok && snapshot.snapshot.roomState.members).toHaveLength(12)
  })

  it('requires three ready connected players when a registered game declares minimum three', () => {
    const strict = defineMultiplayerGame<null, { count: number }>({
      gameId: 'strict', minPlayers: 3, maxPlayers: 12,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ count: 0 }),
      applyCommand: () => ({ accepted: false, error: 'invalid_payload' }),
      projectPublic: state => state, projectPrivate: () => null,
    })
    const s = setup([strict])
    s.host(1, 'SELECT_GAME', { gameId: 'strict' })
    s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true })
    s.player(1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.error).toBe('invalid_player_count')
    const third = s.runtime.joinGuest('third-conn')
    if (!third.ok) throw new Error('third join failed')
    expect(s.send(third.playerId, 'third-conn', 1, 'READY', { ready: true }).result.status).toBe('accepted')
    expect(s.host(5, 'START_GAME').result.status).toBe('accepted')
  })

  it('revisions the first valid null configuration and enforces a game maximum below the Room cap', () => {
    const strict = defineMultiplayerGame<null, { count: number }>({
      gameId: 'two-only', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ count: 0 }),
      applyCommand: () => ({ accepted: false, error: 'invalid_payload' }),
      projectPublic: state => state, projectPrivate: () => null,
    })
    const s = setup([strict])
    expect(s.host(1, 'SELECT_GAME', { gameId: 'two-only' }).result.revision).toBe(3)
    expect(s.host(2, 'CONFIGURE_GAME', null).result.revision).toBe(4)
    const third = s.runtime.joinGuest('third-conn')
    if (!third.ok) throw new Error('third join failed')
    s.host(3, 'READY', { ready: true })
    s.player(1, 'READY', { ready: true })
    s.send(third.playerId, 'third-conn', 1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.error).toBe('invalid_player_count')
  })

  it('does not commit a projector exception or consume its command sequence', () => {
    const fragile = defineMultiplayerGame<null, { value: number; broken: boolean }>({
      gameId: 'fragile', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ value: 0, broken: false }),
      applyCommand: (state, action) => action.type === 'BREAK'
        ? { accepted: true, changed: true, state: { ...state, broken: true } }
        : { accepted: true, changed: true, state: { value: state.value + 1, broken: false } },
      projectPublic: state => { if (state.broken) throw new Error('projection_failed'); return { value: state.value } },
      projectPrivate: () => null,
    })
    const s = setup([fragile])
    s.host(1, 'SELECT_GAME', { gameId: 'fragile' }); s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.status).toBe('accepted')
    const snapshot = s.runtime.snapshotFor('host', 'host-conn')
    if (!snapshot.ok) throw new Error('no snapshot')
    const sessionId = snapshot.snapshot.roomState.currentGameSessionId!
    const before = s.runtime.getRevision()
    expect(s.send('host', 'host-conn', 5, 'BREAK', null, 'game', sessionId).result.error).toBe('internal_authority_failure')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { nextClientSeq: 5, gamePublicState: { data: { value: 0 } } } })
    expect(s.send('host', 'host-conn', 5, 'SAFE', null, 'game', sessionId).result.status).toBe('accepted')
  })

  it('does not publish partial deliveries when the second player private projector fails', () => {
    const fragilePrivate = defineMultiplayerGame<null, { breakGuest: boolean }>({
      gameId: 'private-fragile', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ breakGuest: false }),
      applyCommand: () => ({ accepted: true, changed: true, state: { breakGuest: true } }),
      projectPublic: () => ({ safe: true }),
      projectPrivate: (state, playerId) => {
        if (state.breakGuest && playerId !== 'host') throw new Error('private_projector_failed')
        return { own: playerId }
      },
    })
    const s = setup([fragilePrivate])
    s.host(1, 'SELECT_GAME', { gameId: 'private-fragile' }); s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    s.host(4, 'START_GAME')
    const snapshot = s.runtime.snapshotFor('host', 'host-conn')
    if (!snapshot.ok) throw new Error('no session')
    const before = s.runtime.getRevision()
    const result = s.send('host', 'host-conn', 5, 'BREAK', null, 'game', snapshot.snapshot.roomState.currentGameSessionId!)
    expect(result.result.error).toBe('internal_authority_failure')
    expect(result.deliveries).toEqual([])
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.runtime.snapshotFor(s.guest.playerId, 'guest-conn')).toMatchObject({ ok: true,
      snapshot: { privateState: { data: { own: s.guest.playerId } } } })
  })

  it('does not let a public projector mutate canonical or private game state', () => {
    const mutating = defineMultiplayerGame<null, { count: number }>({
      gameId: 'mutating', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ count: 0 }),
      applyCommand: state => ({ accepted: true, changed: true, state: { count: state.count + 1 } }),
      projectPublic: state => { (state as { count: number }).count = 999; return { count: 999 } },
      projectPrivate: state => ({ canonicalCount: state.count }),
    })
    const s = setup([mutating])
    s.host(1, 'SELECT_GAME', { gameId: 'mutating' }); s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    s.host(4, 'START_GAME')
    const first = s.runtime.snapshotFor('host', 'host-conn')
    expect(first.ok && first.snapshot.privateState?.data).toEqual({ canonicalCount: 0 })
    if (!first.ok) throw new Error('no session')
    s.send('host', 'host-conn', 5, 'INCREMENT', null, 'game', first.snapshot.roomState.currentGameSessionId!)
    const second = s.runtime.snapshotFor('host', 'host-conn')
    expect(second.ok && second.snapshot.privateState?.data).toEqual({ canonicalCount: 1 })
  })

  it('rejects an oversized UTF-8 configuration before state, revision or sequence commit', () => {
    const large = defineMultiplayerGame<{ note: string }, { note: string }>({
      gameId: 'large', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => typeof input === 'object' && input !== null && 'note' in input
        && typeof input.note === 'string' ? { ok: true, config: { note: input.note } } : { ok: false },
      createInitialState: config => ({ note: config.note }),
      applyCommand: () => ({ accepted: false, error: 'invalid_payload' }),
      projectPublic: state => state, projectPrivate: () => null,
    })
    const s = setup([large])
    s.host(1, 'SELECT_GAME', { gameId: 'large' })
    const before = s.runtime.getRevision()
    expect(s.host(2, 'CONFIGURE_GAME', { note: '😀'.repeat(5000) }).result.error).toBe('frame_too_large')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { nextClientSeq: 2, roomState: { selectedConfig: null } } })
    expect(s.host(2, 'CONFIGURE_GAME', { note: 'ok' }).result.status).toBe('accepted')
  })

  it('serializes future membership work behind a pending external effect', async () => {
    const s = setup()
    const coordinator = new RoomCoordinatorV2(s.runtime)
    let release!: () => void
    const external = coordinator.runExclusive(async () => new Promise<void>(resolve => { release = resolve }))
    const join = coordinator.joinGuest('delayed-conn')
    await Promise.resolve()
    expect(s.runtime.getRevision()).toBe(2)
    release()
    await external
    expect((await join).ok).toBe(true)
    expect(s.runtime.getRevision()).toBe(3)
  })

  it('rejects an oversized projected event even when its command input is small', () => {
    const growing = defineMultiplayerGame<null, { huge: boolean }>({
      gameId: 'growing', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ huge: false }),
      applyCommand: (_state, action) => ({ accepted: true, changed: true, state: { huge: action.type === 'GROW' } }),
      projectPublic: state => ({ text: state.huge ? '😀'.repeat(5000) : 'small' }),
      projectPrivate: () => null,
    })
    const s = setup([growing])
    s.host(1, 'SELECT_GAME', { gameId: 'growing' }); s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    expect(s.host(4, 'START_GAME').result.status).toBe('accepted')
    const current = s.runtime.snapshotFor('host', 'host-conn')
    if (!current.ok) throw new Error('no session')
    const id = current.snapshot.roomState.currentGameSessionId!
    const before = s.runtime.getRevision()
    expect(s.send('host', 'host-conn', 5, 'GROW', null, 'game', id).result.error).toBe('frame_too_large')
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.runtime.snapshotFor('host', 'host-conn')).toMatchObject({ ok: true,
      snapshot: { nextClientSeq: 5, gamePublicState: { data: { text: 'small' } } } })
    expect(s.send('host', 'host-conn', 5, 'SMALL', null, 'game', id).result.status).toBe('accepted')
  })

  it('rejects a non-JSON projector value before committing the transition', () => {
    const malformed = defineMultiplayerGame<null, { malformed: boolean }>({
      gameId: 'malformed', minPlayers: 2, maxPlayers: 2,
      validateConfig: input => input === null ? { ok: true, config: null } : { ok: false },
      createInitialState: () => ({ malformed: false }),
      applyCommand: () => ({ accepted: true, changed: true, state: { malformed: true } }),
      projectPublic: state => state.malformed ? { value: undefined } : { value: 0 },
      projectPrivate: () => null,
    })
    const s = setup([malformed])
    s.host(1, 'SELECT_GAME', { gameId: 'malformed' }); s.host(2, 'CONFIGURE_GAME', null)
    s.host(3, 'READY', { ready: true }); s.player(1, 'READY', { ready: true })
    s.host(4, 'START_GAME')
    const current = s.runtime.snapshotFor('host', 'host-conn')
    if (!current.ok) throw new Error('no session')
    const before = s.runtime.getRevision()
    const outcome = s.send('host', 'host-conn', 5, 'MALFORM', null, 'game', current.snapshot.roomState.currentGameSessionId!)
    expect(outcome.result.error).toBe('internal_authority_failure')
    expect(outcome.deliveries).toEqual([])
    expect(s.runtime.getRevision()).toBe(before)
  })

  it('consumes an authenticated rejected command but leaves a future sequence pending', () => {
    const s = setup()
    const future = s.player(2, 'SELECT_GAME', { gameId: 'toy' })
    expect(future.result.error).toBe('future_sequence')
    expect(future.result.nextClientSeq).toBe(1)
    const denied = s.player(1, 'SELECT_GAME', { gameId: 'toy' })
    expect(denied.result.error).toBe('unauthorized')
    expect(denied.result.nextClientSeq).toBe(2)
    expect(s.player(1, 'SELECT_GAME', { gameId: 'toy' }).result).toEqual(denied.result)
    expect(s.player(2, 'READY', { ready: true }).result.status).toBe('accepted')
  })

  it('treats reordered JSON payload keys as the same retried command intent', () => {
    const s = setup()
    const first = s.send(s.guest.playerId, 'guest-conn', 1, 'READY', { ready: true, note: 'same' })
    const retry = s.send(s.guest.playerId, 'guest-conn', 1, 'READY', { note: 'same', ready: true })
    expect(retry.result).toEqual(first.result)
    expect(retry.deduplicated).toBe(true)
  })
})
