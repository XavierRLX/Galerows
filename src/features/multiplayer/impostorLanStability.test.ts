import { describe, expect, it } from 'vitest'
import { impostorLanGame, type ImpostorLanPrivate, type ImpostorLanPublic } from './impostorLanGame'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import type { RoomCommandV2 } from './persistentProtocol'

type Player = { id: string; conn: string }
const config = { impostorMode: 'no-word' as const, conversationMode: 'one-word' as const,
  flow: 'individual-vote' as const, timerSeconds: 120 as const }

function setup(guests = 2) {
  let n = 0
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'stability-room', hostPlayerId: 'host', hostConnectionId: 'host-connection',
    adapter: new RoomLifecycleAdapter([impostorLanGame]),
    createPlayerId: () => `friend-${++n}`, random: () => 0.01, clock: { now: () => 4200 },
  })
  const players: Player[] = [{ id: 'host', conn: 'host-connection' }]
  for (let i = 0; i < guests; i++) {
    const conn = `connection-${i}`
    const joined = runtime.joinGuest(conn, `Amigo ${i + 1}`)
    if (!joined.ok) throw new Error('Cannot join')
    players.push({ id: joined.playerId, conn })
  }
  const view = (player: Player) => {
    const response = runtime.snapshotFor(player.id, player.conn)
    if (!response.ok) throw new Error(`Cannot snapshot ${player.id}: ${response.error}`)
    return response.snapshot
  }
  const send = (player: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room',
    sessionId = view(player).roomState.currentGameSessionId) => {
    const before = view(player)
    const command: RoomCommandV2 = {
      roomId: before.roomId, protocolVersion: 2,
      playerId: player.id, clientSeq: before.nextClientSeq,
      commandId: crypto.randomUUID(), type, payload, scope,
      ...(scope === 'game' ? { gameSessionId: sessionId ?? 'missing' } : {}),
    }
    return runtime.processCommand(command, player.conn)
  }
  const accepted = (player: Player, type: string, payload: unknown = null,
    scope: 'room' | 'game' = 'room') => {
    const result = send(player, type, payload, scope)
    expect(result.result).toMatchObject({ status: 'accepted' })
    return result
  }
  const publicState = () => view(players[0]).gamePublicState?.data as ImpostorLanPublic
  const privateState = (player: Player) => view(player).privateState?.data as ImpostorLanPrivate
  const begin = () => {
    accepted(players[0], 'SELECT_GAME', { gameId: 'impostor-da-palavra' })
    accepted(players[0], 'CONFIGURE_GAME', config)
    for (const p of players) accepted(p, 'READY', { ready: true })
    accepted(players[0], 'START_GAME')
    return view(players[0]).roomState.currentGameSessionId!
  }
  const openVoting = () => {
    for (const p of players) accepted(p, 'ACK_BRIEFING', null, 'game')
    accepted(players[0], 'START_VOTING', null, 'game')
  }
  const cast = (p: Player, targetId: string) => accepted(p, 'VOTE', { playerId: targetId }, 'game')
  const finish = () => {
    accepted(players[0], 'END_GAME')
    accepted(players[0], 'RETURN_TO_LOBBY')
  }
  return { runtime, players, view, send, accepted, publicState, privateState, begin, openVoting, cast, finish }
}

describe('Impostor LAN stability: actual Room lifecycle', () => {
  it('restores an already confirmed vote after disconnect without duplicating it or exposing any secret', () => {
    const sim = setup()
    sim.begin()
    sim.openVoting()
    const guest = sim.players[1]
    sim.cast(guest, sim.players[0].id)
    const before = sim.view(guest)
    expect(sim.privateState(guest)).toMatchObject({ hasVoted: true })
    expect(sim.runtime.disconnect(guest.conn)).toMatchObject({ ok: true })
    expect(sim.runtime.snapshotFor(guest.id, guest.conn)).toMatchObject({
      ok: false, error: 'unauthorized',
    })
    const newConnection = 'reconnected-guest'
    expect(sim.runtime.reassociate(guest.id, newConnection)).toMatchObject({ ok: true })
    const originalConnection = guest.conn
    guest.conn = newConnection
    const restored = sim.view(guest)
    expect(restored.roomState.currentGameSessionId).toBe(before.roomState.currentGameSessionId)
    expect(restored.privateState).toEqual(before.privateState)
    expect(JSON.stringify(restored.privateState)).not.toContain('word')
    expect(sim.privateState(guest).hasVoted).toBe(true)
    const revision = sim.runtime.getRevision()
    expect(sim.send(guest, 'VOTE', { playerId: sim.players[2].id }, 'game').result.status).toBe('accepted')
    expect(sim.runtime.getRevision()).toBe(revision)
    expect(sim.publicState()).toMatchObject({ step: 'voting', voteCount: 1 })
    expect(sim.runtime.snapshotFor(guest.id, originalConnection)).toMatchObject({
      ok: false, error: 'unauthorized',
    })
    sim.cast(sim.players[0], sim.players[0].id)
    sim.cast(sim.players[2], sim.players[0].id)
    expect(sim.publicState()).toMatchObject({ step: 'summary', winner: 'group', voteCount: 3 })
    sim.accepted(sim.players[0], 'END_GAME')
    expect(sim.view(guest).roomState.competition?.completedGames).toBe(1)
    expect(sim.send(sim.players[0], 'END_GAME').result.error).toBe('invalid_phase')
    expect(sim.view(guest).roomState.competition?.completedGames).toBe(1)
  })

  it('keeps an unconfirmed vote pending until the same member reconnects', () => {
    const sim = setup()
    sim.begin()
    sim.openVoting()
    const missing = sim.players[2]
    expect(sim.runtime.disconnect(missing.conn)).toMatchObject({ ok: true })
    sim.cast(sim.players[0], 'host')
    sim.cast(sim.players[1], 'host')
    expect(sim.publicState()).toMatchObject({ step: 'voting', voteCount: 2, result: null })
    expect(sim.runtime.reassociate(missing.id, 'fresh-voter-connection')).toMatchObject({ ok: true })
    missing.conn = 'fresh-voter-connection'
    expect(sim.privateState(missing)).toMatchObject({ hasVoted: false, wasSeen: true })
    expect(sim.view(missing).gamePublicState?.gameSessionId).toBe(sim.view(sim.players[0]).roomState.currentGameSessionId)
    sim.cast(missing, 'host')
    expect(sim.publicState()).toMatchObject({ step: 'summary', winner: 'group' })
  })

  it('completes a 4-player runoff, scores once, and starts a fresh GameSession in the original Room', () => {
    const sim = setup(3)
    const first = sim.begin()
    sim.openVoting()
    sim.cast(sim.players[0], sim.players[0].id)
    sim.cast(sim.players[1], sim.players[0].id)
    sim.cast(sim.players[2], sim.players[1].id)
    sim.cast(sim.players[3], sim.players[1].id)
    expect(sim.publicState()).toMatchObject({
      step: 'voting', voteRound: 2, voteCount: 0, runoffCandidates: ['host', 'friend-1'],
    })
    for (const p of sim.players) {
      const projected = sim.view(p)
      expect(projected.privateState?.data).toMatchObject({ hasVoted: false })
      expect(JSON.stringify(projected.gamePublicState?.data)).not.toContain('"votes"')
    }
    expect(sim.send(sim.players[0], 'VOTE', { playerId: sim.players[2].id }, 'game').result.error)
      .toBe('invalid_phase')
    for (const p of sim.players) sim.cast(p, 'host')
    expect(sim.publicState()).toMatchObject({ step: 'summary', winner: 'group', reason: 'caught' })
    sim.finish()
    const scored = sim.view(sim.players[0]).roomState.competition!
    expect(scored.completedGames).toBe(1)
    expect(scored.standings.find(row => row.playerId === 'host')?.points).toBe(0)
    for (const p of sim.players) {
      const snapshot = sim.view(p)
      expect(snapshot.roomId).toBe('stability-room')
      expect(snapshot.roomState.members).toHaveLength(4)
      expect(snapshot.roomState.members.every(member => !member.ready)).toBe(true)
      expect(snapshot.privateState).toBeNull()
      expect(snapshot.gamePublicState).toBeNull()
    }
    const second = sim.begin()
    expect(second).not.toBe(first)
    for (const p of sim.players) {
      expect(sim.view(p).privateState?.gameSessionId).toBe(second)
      expect(sim.privateState(p).wasSeen).toBe(false)
    }
    expect(sim.send(sim.players[1], 'ACK_BRIEFING', null, 'game', first).result.error).toBe('stale_game_session')
    sim.openVoting()
    for (const p of sim.players) sim.cast(p, sim.players[1].id)
    expect(sim.publicState()).toMatchObject({ step: 'summary', winner: 'impostor', reason: 'not-found' })
    sim.finish()
    const updated = sim.view(sim.players[0]).roomState.competition!
    expect(updated.completedGames).toBe(2)
    expect(updated.standings.find(row => row.playerId === 'host')?.points).toBe(2)
    expect(updated.standings.find(row => row.playerId === 'friend-1')?.points).toBe(1)
  })
})
