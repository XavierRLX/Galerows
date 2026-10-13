import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { impostorLanGame, type ImpostorLanPublic } from './impostorLanGame'
import { pistaUnicaLanGame, type PistaUnicaLanPublic, type PistaUnicaLanPrivate } from './pistaUnicaLanGame'
import { cidadeDormeLanGame, type CidadeDormeLanPublic, type CidadeDormeLanPrivate } from './cidadeDormeLanGame'
import { roomFrameFits } from './persistentProtocol'
import type { RoomSnapshotV2 } from './persistentProtocol'

type Client = { id: string; connection: string }
function simulatedRoom() {
  let count = 0
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'mvp3', hostPlayerId: 'host', hostConnectionId: 'conn-host',
    adapter: new RoomLifecycleAdapter([impostorLanGame, pistaUnicaLanGame, cidadeDormeLanGame]),
    random: () => 0.999999, createPlayerId: () => `guest-${++count}`,
  })
  const clients: Client[] = [{ id: 'host', connection: 'conn-host' }]
  for (let n = 0; n < 3; n++) {
    const joined = runtime.joinGuest(`conn-${n}`, `Amigo ${n + 1}`)
    if (!joined.ok) throw new Error('join failed')
    clients.push({ id: joined.playerId, connection: `conn-${n}` })
  }
  const snapshot = (client: Client): RoomSnapshotV2 => {
    const found = runtime.snapshotFor(client.id, client.connection)
    if (!found.ok) throw new Error('not admitted')
    return found.snapshot
  }
  const send = (client: Client, type: string, payload: unknown = null,
    scope: 'game' | 'room' = 'game', staleSession?: string) => {
    const current = snapshot(client)
    return runtime.processCommand({
      protocolVersion: 2, scope, roomId: 'mvp3', playerId: client.id, type, payload,
      commandId: crypto.randomUUID(), clientSeq: current.nextClientSeq,
      ...(scope === 'game' ? { gameSessionId: staleSession ?? current.roomState.currentGameSessionId! } : {}),
    }, client.connection)
  }
  const ok = (client: Client, type: string, payload: unknown = null, scope: 'game' | 'room' = 'game') => {
    const result = send(client, type, payload, scope)
    expect(result.result.status, `${type}: ${JSON.stringify(result.result)}`).toBe('accepted')
    return result
  }
  const begin = (gameId: string, config: unknown) => {
    ok(clients[0], 'SELECT_GAME', { gameId }, 'room')
    ok(clients[0], 'CONFIGURE_GAME', config, 'room')
    for (const client of clients) ok(client, 'READY', { ready: true }, 'room')
    ok(clients[0], 'START_GAME', null, 'room')
    expect(snapshot(clients[0]).roomState.currentGameSessionId).toBeTruthy()
    for (const client of clients) expect(roomFrameFits({ kind: 'snapshotV2',
      protocolVersion: 2, snapshot: snapshot(client) })).toBe(true)
    return snapshot(clients[0]).roomState.currentGameSessionId!
  }
  const finish = () => {
    ok(clients[0], 'END_GAME', null, 'room')
    const prior = snapshot(clients[0]).roomState.currentGameSessionId!
    expect(send(clients[0], 'END_GAME', null, 'room').result.error).toBe('invalid_phase')
    ok(clients[0], 'RETURN_TO_LOBBY', null, 'room')
    for (const client of clients) {
      const current = snapshot(client)
      expect(current.privateState).toBeNull()
      expect(current.gamePublicState).toBeNull()
      expect(current.roomState.phase).toBe('lobby')
      expect(current.roomState.currentGameSessionId).toBeNull()
    }
    return prior
  }
  return { clients, runtime, snapshot, send, ok, begin, finish }
}

describe('MVP G8 — three distinct LAN games, one Room and one champion', () => {
  it('keeps membership, secrecy and scores through Impostor → Pista Única → Cidade Dorme', () => {
    const s = simulatedRoom()
    const ids = s.clients.map(client => client.id)
    const initialPlayers = s.snapshot(s.clients[0]).roomState.members.map(m => m.playerId)
    expect(initialPlayers).toEqual(ids)
    const first = s.begin('impostor-da-palavra', {
      impostorMode: 'no-word', conversationMode: 'one-word',
    })
    for (const p of s.clients) s.ok(p, 'ACK_BRIEFING')
    s.ok(s.clients[0], 'START_CLUES')
    for (let i = 0; i < s.clients.length; i++) s.ok(s.clients[0], 'NEXT_CLUE')
    s.ok(s.clients[0], 'START_ACCUSATION')
    // Random 0.999999 selects last client for impostor.
    s.ok(s.clients[0], 'ACCUSE', { playerId: s.clients[3].id })
    s.ok(s.clients[0], 'SKIP_GUESS')
    expect((s.snapshot(s.clients[0]).gamePublicState!.data as ImpostorLanPublic).winner).toBe('group')
    s.finish()
    expect(s.snapshot(s.clients[0]).roomState.competition?.completedGames).toBe(1)

    const second = s.begin('pista-unica', { categories: ['words'] })
    expect(second).not.toBe(first)
    expect(s.send(s.clients[1], 'ACK_BRIEFING', null, 'game', first).result.error)
      .toBe('stale_game_session')
    for (let round = 0; round < 4; round++) {
      const game = s.snapshot(s.clients[0]).gamePublicState!.data as PistaUnicaLanPublic
      expect(game.step).toBe('writing')
      const guesser = s.clients.find(p => p.id === game.guesserId)!
      const writers = s.clients.filter(p => p.id !== guesser.id)
      const word = (s.snapshot(writers[0]).privateState!.data as PistaUnicaLanPrivate).target!
      expect(JSON.stringify(s.snapshot(guesser).privateState)).not.toContain(word)
      writers.forEach((p, index) => s.ok(p, 'SUBMIT_CLUE', { text: `Pista ${round} ${index}` }))
      expect((s.snapshot(s.clients[0]).gamePublicState!.data as PistaUnicaLanPublic).step).toBe('guessing')
      s.ok(guesser, 'SUBMIT_GUESS', { text: word })
      s.ok(s.clients[0], 'NEXT_ROUND')
    }
    expect((s.snapshot(s.clients[0]).gamePublicState!.data as PistaUnicaLanPublic).step).toBe('summary')
    s.finish()
    expect(s.snapshot(s.clients[0]).roomState.competition?.completedGames).toBe(2)

    const third = s.begin('cidade-dorme', {
      enableDoctor: false, enableDetective: false,
      enableJester: false, revealRoleOnDeath: false,
    })
    expect(third).not.toBe(second)
    expect(s.send(s.clients[1], 'SUBMIT_CLUE', { text: 'cheat' }, 'game', second).result.error)
      .toBe('stale_game_session')
    const roles = s.clients.map(client => ({
      client, role: (s.snapshot(client).privateState!.data as CidadeDormeLanPrivate).role,
    }))
    const killer = roles.find(entry => entry.role === 'killer')!.client
    const firstCitizen = roles.find(entry => entry.role === 'citizen')!.client
    for (const p of s.clients) s.ok(p, 'ACK_ROLE')
    s.ok(s.clients[0], 'START_NIGHT')
    s.ok(killer, 'KILL', { playerId: firstCitizen.id })
    const afterNight = s.snapshot(s.clients[0]).gamePublicState!.data as CidadeDormeLanPublic
    expect(afterNight.step).toBe('morning')
    expect(afterNight.nightResult?.eliminatedId).toBe(firstCitizen.id)
    expect(JSON.stringify(afterNight)).not.toContain('roleKey')
    s.ok(s.clients[0], 'START_DISCUSSION')
    s.ok(s.clients[0], 'START_VOTE')
    for (const p of s.clients.filter(p => p.id !== firstCitizen.id)) {
      s.ok(p, 'CAST_VOTE', { playerId: killer.id })
    }
    s.ok(s.clients[0], 'RESOLVE_VOTE')
    expect((s.snapshot(s.clients[0]).gamePublicState!.data as CidadeDormeLanPublic).winner).toBe('city')
    s.finish()

    const snapshots = s.clients.map(p => s.snapshot(p))
    const scores = snapshots[0].roomState.competition!
    expect(scores.completedGames).toBe(3)
    for (const item of snapshots) {
      expect(item.roomState.members.map(member => member.playerId)).toEqual(initialPlayers)
      expect(item.roomState.competition).toEqual(scores)
      expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot: item })).toBe(true)
    }
    expect(scores.standings.map(entry => entry.played)).toEqual([3, 3, 3, 3])
    expect(scores.standings.map(entry => entry.points).reduce((a, b) => a + b, 0)).toBe(13)
    expect(s.send(s.clients[1], 'FINISH_SESSION', null, 'room').result.error).toBe('unauthorized')
    s.ok(s.clients[0], 'FINISH_SESSION', null, 'room')
    expect(s.snapshot(s.clients[0]).roomState.competition?.status).toBe('finished')
    expect(s.send(s.clients[0], 'SELECT_GAME', { gameId: 'impostor-da-palavra' }, 'room')
      .result.error).toBe('invalid_phase')
  })

  it('does not award new points when the current game is unfinished or host sends fake points', () => {
    const s = simulatedRoom()
    s.begin('cidade-dorme', { enableDoctor: false, enableDetective: false,
      enableJester: false, revealRoleOnDeath: false })
    const before = s.snapshot(s.clients[0])
    expect(s.send(s.clients[0], 'END_GAME', null, 'room').result.error).toBe('invalid_phase')
    expect(s.send(s.clients[0], 'AWARD_POINTS', { points: 99 }, 'room').result.status).toBe('rejected')
    expect(s.snapshot(s.clients[0]).revision).toBe(before.revision)
    expect(s.snapshot(s.clients[0]).roomState.competition?.completedGames).toBe(0)
  })
})
