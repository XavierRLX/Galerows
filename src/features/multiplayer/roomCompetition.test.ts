import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { impostorLanGame } from './impostorLanGame'
import { syntheticMultiplayerGames } from './multiplayerGames.synthetic'
import { defineMultiplayerGame } from './multiplayerGames'
import { roomFrameFits, type RoomCompetitionV2 } from './persistentProtocol'

type Player = { id: string; conn: string }
function setup(guests = 2) {
  let seq = 0
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'g5e-room', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter([impostorLanGame, ...syntheticMultiplayerGames]),
    createPlayerId: () => `guest-${++seq}`, random: () => 0.01, clock: { now: () => 321 },
  })
  const players: Player[] = [{ id: 'host', conn: 'host-conn' }]
  for (let n = 0; n < guests; n++) {
    const conn = `guest-conn-${n}`
    const joined = runtime.joinGuest(conn, `Amigo ${n + 1}`)
    if (!joined.ok) throw new Error('join failed')
    players.push({ id: joined.playerId, conn })
  }
  const view = (p: Player) => {
    const result = runtime.snapshotFor(p.id, p.conn)
    if (!result.ok) throw new Error('snapshot failed')
    return result.snapshot
  }
  const send = (p: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room') => {
    const snapshot = view(p)
    return runtime.processCommand({ protocolVersion: 2, roomId: 'g5e-room', playerId: p.id,
      clientSeq: snapshot.nextClientSeq, commandId: crypto.randomUUID(), scope, type, payload,
      ...(scope === 'game' ? { gameSessionId: snapshot.roomState.currentGameSessionId! } : {}) }, p.conn)
  }
  const ok = (p: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room') => {
    const result = send(p, type, payload, scope)
    expect(result.result.status).toBe('accepted')
    return result
  }
  const competition = (): RoomCompetitionV2 => view(players[0]).roomState.competition!
  function begin(gameId: 'impostor-da-palavra' | 'counter' = 'impostor-da-palavra') {
    ok(players[0], 'SELECT_GAME', { gameId })
    ok(players[0], 'CONFIGURE_GAME', gameId === 'counter'
      ? { target: 2 } : { impostorMode: 'no-word', conversationMode: 'one-word' })
    for (const p of players) ok(p, 'READY', { ready: true })
    ok(players[0], 'START_GAME')
  }
  function finishImpostor(winner: 'impostor' | 'group') {
    for (const p of players) ok(p, 'ACK_BRIEFING', null, 'game')
    ok(players[0], 'START_CLUES', null, 'game')
    for (let i = 0; i < players.length; i++) ok(players[0], 'NEXT_CLUE', null, 'game')
    ok(players[0], 'START_ACCUSATION', null, 'game')
    ok(players[0], 'ACCUSE', { playerId: winner === 'impostor' ? players[1].id : players[0].id }, 'game')
    if (winner === 'group') ok(players[0], 'SKIP_GUESS', null, 'game')
    ok(players[0], 'END_GAME')
  }
  return { players, runtime, view, send, ok, competition, begin, finishImpostor }
}
function score(state: RoomCompetitionV2, playerId: string) {
  return state.standings.find(entry => entry.playerId === playerId)!
}

describe('G5E — authoritative LAN competition for one persistent lobby', () => {
  it('starts empty and accepts no guest or early finish; rejects any forged point payload', () => {
    const sim = setup()
    expect(sim.competition()).toMatchObject({ status: 'active', completedGames: 0, winnerPlayerIds: [] })
    expect(sim.competition().standings).toHaveLength(3)
    expect(sim.send(sim.players[1], 'FINISH_SESSION').result.error).toBe('unauthorized')
    expect(sim.send(sim.players[0], 'FINISH_SESSION').result.error).toBe('invalid_phase')
    sim.begin()
    expect(sim.send(sim.players[1], 'AWARD_POINTS', { playerId: 'guest-1', points: 100 }).result.status).toBe('rejected')
    expect(sim.send(sim.players[0], 'FINISH_SESSION').result.error).toBe('invalid_phase')
    expect(sim.competition().completedGames).toBe(0)
  })

  it('credits each completed Impostor GameSession once and accumulates through the same lobby', () => {
    const sim = setup()
    sim.begin()
    sim.finishImpostor('impostor')
    expect(sim.competition().completedGames).toBe(1)
    expect(score(sim.competition(), 'host')).toMatchObject({ points: 2, wins: 1, played: 1 })
    expect(score(sim.competition(), 'guest-1').points).toBe(0)
    const snapshot = sim.view(sim.players[0])
    expect(sim.send(sim.players[0], 'END_GAME').result.error).toBe('invalid_phase')
    expect(sim.view(sim.players[0]).revision).toBe(snapshot.revision)
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    expect(sim.view(sim.players[1]).privateState).toBeNull()
    expect(sim.view(sim.players[1]).gamePublicState).toBeNull()
    expect(sim.competition().completedGames).toBe(1)
    sim.begin()
    sim.finishImpostor('group')
    expect(sim.competition().completedGames).toBe(2)
    expect(score(sim.competition(), 'host')).toMatchObject({ points: 2, played: 2, wins: 1 })
    expect(score(sim.competition(), 'guest-1')).toMatchObject({ points: 1, played: 2, wins: 1 })
    expect(score(sim.competition(), 'guest-2')).toMatchObject({ points: 1, played: 2, wins: 1 })
    const all = sim.players.map(p => sim.view(p).roomState.competition)
    expect(all[0]).toEqual(all[1])
    expect(all[1]).toEqual(all[2])
    expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot: sim.view(sim.players[0]) })).toBe(true)
  })

  it('announces a single champion or every tied champion when the host ends competition', () => {
    const sim = setup()
    sim.begin()
    sim.finishImpostor('group')
    expect(sim.send(sim.players[1], 'FINISH_SESSION').result.error).toBe('unauthorized')
    expect(sim.send(sim.players[0], 'FINISH_SESSION').result.error).toBe('invalid_phase')
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    sim.ok(sim.players[0], 'FINISH_SESSION')
    expect(sim.competition()).toMatchObject({
      status: 'finished', completedGames: 1, winnerPlayerIds: ['guest-1', 'guest-2'],
    })
    expect(sim.send(sim.players[0], 'SELECT_GAME', { gameId: 'impostor-da-palavra' }).result.error).toBe('invalid_phase')
    expect(sim.send(sim.players[1], 'READY', { ready: true }).result.error).toBe('invalid_phase')
    expect(sim.send(sim.players[0], 'FINISH_SESSION').result.error).toBe('invalid_phase')
    expect(sim.view(sim.players[0]).roomState.phase).toBe('lobby')
  })

  it('keeps standings for disconnected/leaving members; joining player starts with zero points', () => {
    const sim = setup()
    sim.begin()
    sim.finishImpostor('impostor')
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    const before = sim.competition()
    expect(sim.runtime.disconnect(sim.players[0].conn).ok).toBe(true)
    const guestView = sim.view(sim.players[1])
    expect(guestView.roomState.competition).toEqual(before)
    expect(sim.runtime.reassociate('host', 'new-host-conn').ok).toBe(true)
    sim.players[0].conn = 'new-host-conn'
    expect(sim.competition()).toEqual(before)
    expect(sim.runtime.leaveGuest(sim.players[1].id, sim.players[1].conn).ok).toBe(true)
    expect(sim.competition().standings.some(entry => entry.playerId === 'guest-1')).toBe(true)
    const added = sim.runtime.joinGuest('late-connected', 'Pessoa nova')
    expect(added.ok).toBe(true)
    if (added.ok) expect(score(added.snapshot.roomState.competition!, added.playerId)).toMatchObject({
      points: 0, wins: 0, played: 0,
    })
    expect(score(sim.competition(), 'host').points).toBe(2)
  })

  it('never awards points for synthetic probe games and cannot close a tournament without a scored game', () => {
    const sim = setup()
    sim.begin('counter')
    sim.ok(sim.players[0], 'END_GAME')
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    expect(sim.competition().completedGames).toBe(0)
    expect(sim.competition().standings.every(s => s.points === 0)).toBe(true)
    expect(sim.send(sim.players[0], 'FINISH_SESSION').result.error).toBe('invalid_phase')
  })

  it('refuses malformed scores from a future adapter without mutating Room or state', () => {
    const corrupted = defineMultiplayerGame({
      gameId: 'bad-award', minPlayers: 1, maxPlayers: 12,
      validateConfig: () => ({ ok: true as const, config: {} }),
      createInitialState: () => ({ step: 'summary' }),
      applyCommand: () => ({ accepted: false as const, error: 'invalid_phase' as const }),
      projectPublic: () => ({ step: 'summary' }),
      projectPrivate: () => null,
      awardPoints: () => ({ host: 999, forged: 1 }),
    })
    const sim = new AuthoritativeRoomRuntimeV2({ roomId: 'bad-room', hostPlayerId: 'host',
      hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter([corrupted]) })
    const send = (seq: number, type: string, payload: unknown = null) => sim.processCommand({
      protocolVersion: 2, scope: 'room', roomId: 'bad-room', playerId: 'host',
      clientSeq: seq, commandId: `bad-${seq}`, type, payload,
    }, 'host-conn')
    send(1, 'SELECT_GAME', { gameId: 'bad-award' })
    send(2, 'CONFIGURE_GAME', {})
    send(3, 'READY', { ready: true })
    expect(send(4, 'START_GAME').result.status).toBe('accepted')
    const revision = sim.getRevision()
    expect(send(5, 'END_GAME').result.error).toBe('invalid_payload')
    expect(sim.getRevision()).toBe(revision)
  })

  it('supports two winners from one team in the same round, without a client award payload', () => {
    const team = defineMultiplayerGame({
      gameId: 'team-example', minPlayers: 3, maxPlayers: 12,
      validateConfig: () => ({ ok: true as const, config: {} }),
      createInitialState: () => ({ step: 'summary' }),
      applyCommand: () => ({ accepted: false as const, error: 'invalid_phase' as const }),
      projectPublic: () => ({ step: 'summary' }),
      projectPrivate: () => null,
      awardPoints: () => ({ host: 2, 'guest-1': 2, 'guest-2': 0 }),
    })
    let counter = 0
    const runtime = new AuthoritativeRoomRuntimeV2({
      roomId: 'team-room', hostPlayerId: 'host', hostConnectionId: 'host-conn',
      adapter: new RoomLifecycleAdapter([team]), createPlayerId: () => `guest-${++counter}`,
    })
    const joinedA = runtime.joinGuest('guest-a')
    const joinedB = runtime.joinGuest('guest-b')
    expect(joinedA.ok && joinedB.ok).toBe(true)
    if (!joinedA.ok || !joinedB.ok) return
    const players: Player[] = [{ id: 'host', conn: 'host-conn' },
      { id: joinedA.playerId, conn: 'guest-a' }, { id: joinedB.playerId, conn: 'guest-b' }]
    const send = (p: Player, type: string, payload: unknown = null) => {
      const snapshot = runtime.snapshotFor(p.id, p.conn)
      if (!snapshot.ok) throw new Error('snapshot not found')
      const result = runtime.processCommand({ protocolVersion: 2, scope: 'room',
        roomId: 'team-room', playerId: p.id, clientSeq: snapshot.snapshot.nextClientSeq,
        commandId: crypto.randomUUID(), type, payload }, p.conn)
      expect(result.result.status).toBe('accepted')
    }
    send(players[0], 'SELECT_GAME', { gameId: 'team-example' })
    send(players[0], 'CONFIGURE_GAME', {})
    for (const p of players) send(p, 'READY', { ready: true })
    send(players[0], 'START_GAME')
    send(players[0], 'END_GAME')
    send(players[0], 'RETURN_TO_LOBBY')
    send(players[0], 'FINISH_SESSION')
    const snapshot = runtime.snapshotFor('host', 'host-conn')
    expect(snapshot.ok).toBe(true)
    if (!snapshot.ok) return
    const competition = snapshot.snapshot.roomState.competition!
    expect(competition.winnerPlayerIds).toEqual(['host', joinedA.playerId])
    expect(competition.standings.filter(player => player.points === 2)).toHaveLength(2)
    expect(competition.standings.find(player => player.playerId === joinedB.playerId)?.played).toBe(1)
  })

  it('keeps score projection under frame cap at maximum membership', () => {
    const sim = setup(11)
    for (const p of sim.players) {
      const snap = sim.view(p)
      expect(snap.roomState.competition?.standings).toHaveLength(12)
      expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot: snap })).toBe(true)
    }
  })
})
