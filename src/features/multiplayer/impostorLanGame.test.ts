import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import type { RoomCommandV2, RoomSnapshotV2 } from './persistentProtocol'
import { roomFrameFits } from './persistentProtocol'
import { impostorLanGame } from './impostorLanGame'
import type { ImpostorLanPublic, ImpostorLanPrivate, ImpostorLanConfig } from './impostorLanGame'

type Player = { id: string; conn: string }
type Sim = ReturnType<typeof simulator>
const game = 'impostor-da-palavra'

function simulator(guests = 2, random: () => number = () => 0.02) {
  let serial = 0
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'round-room', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter([impostorLanGame]),
    createPlayerId: () => `guest-${++serial}`, random, clock: { now: () => 10_000 },
  })
  const players: Player[] = [{ id: 'host', conn: 'host-conn' }]
  for (let i = 0; i < guests; i++) {
    const conn = `guest-conn-${i}`
    const result = runtime.joinGuest(conn)
    if (!result.ok) throw new Error('join rejected')
    players.push({ id: result.playerId, conn })
  }
  const view = ({ id, conn }: Player): RoomSnapshotV2 => {
    const response = runtime.snapshotFor(id, conn)
    if (!response.ok) throw new Error(`snapshot failed: ${response.error}`)
    return response.snapshot
  }
  const send = (actor: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room',
    sessionId = view(actor).roomState.currentGameSessionId) => {
    const current = view(actor)
    const input: RoomCommandV2 = { protocolVersion: 2, roomId: 'round-room',
      playerId: actor.id, clientSeq: current.nextClientSeq, commandId: crypto.randomUUID(),
      type, payload, scope,
      ...(scope === 'game' ? { gameSessionId: sessionId ?? 'missing' } : {}),
    }
    return runtime.processCommand(input, actor.conn)
  }
  const ok = (actor: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room') => {
    const outcome = send(actor, type, payload, scope)
    expect(outcome.result).toMatchObject({ status: 'accepted' })
    return outcome
  }
  const start = (config: ImpostorLanConfig = { impostorMode: 'no-word', conversationMode: 'one-word' }) => {
    ok(players[0], 'SELECT_GAME', { gameId: game })
    ok(players[0], 'CONFIGURE_GAME', config)
    for (const p of players) ok(p, 'READY', { ready: true })
    ok(players[0], 'START_GAME')
    return view(players[0]).roomState.currentGameSessionId!
  }
  const state = (p: Player) => ({
    public: view(p).gamePublicState?.data as ImpostorLanPublic,
    private: view(p).privateState?.data as ImpostorLanPrivate,
  })
  const reveal = () => {
    for (const p of players) ok(p, 'ACK_BRIEFING', null, 'game')
    ok(players[0], 'START_CLUES', null, 'game')
  }
  const discuss = () => {
    for (let n = 0; n < players.length; n++) ok(players[0], 'NEXT_CLUE', null, 'game')
    expect(state(players[0]).public.step).toBe('discussion')
    ok(players[0], 'START_ACCUSATION', null, 'game')
  }
  return { runtime, players, view, send, ok, start, state, reveal, discuss }
}
function impostor(sim: Sim) {
  const person = sim.players.find(p => sim.state(p).private.kind !== 'word')
  if (!person) throw new Error('expected no-word impostor')
  return person
}

describe('G5B genuine multiplayer Room authority — Impostor da Palavra', () => {
  it.each([
    ['no-word', 'one-word'], ['hint', 'one-word'], ['alternate-word', 'one-word'],
    ['no-word', 'guided-questions'], ['hint', 'guided-questions'], ['alternate-word', 'guided-questions'],
  ] as const)('isolates 3 participants in mode %s with conversation %s', (impostorMode, conversationMode) => {
    const sim = simulator()
    sim.start({ impostorMode, conversationMode })
    const views = sim.players.map(p => sim.view(p))
    const contents = sim.players.map(p => sim.state(p).private)
    expect(contents).toHaveLength(3)
    expect(contents.filter(value => value.kind !== 'word')).toHaveLength(impostorMode === 'alternate-word' ? 0 : 1)
    const ordinary = contents.filter(value => value.kind === 'word')
    const commonWord = ordinary.find(value => ordinary.filter(other => other.word === value.word).length >= 2)!.word
    expect(commonWord).toBeTruthy()
    const normalCount = ordinary.filter(value => value.word === commonWord).length
    expect(normalCount).toBe(2)
    if (impostorMode === 'alternate-word') {
      expect(new Set(contents.map(c => c.word)).size).toBe(2)
      expect(contents.some(c => c.word !== commonWord)).toBe(true)
    }
    for (const c of contents) {
      expect(c.wasSeen).toBe(false)
      expect(Boolean(c.question)).toBe(conversationMode === 'guided-questions')
    }
    const publicData = sim.state(sim.players[0]).public
    expect(publicData).toMatchObject({ step: 'reveal', seenCount: 0, totalPlayers: 3, result: null,
      accusedId: null, winner: null })
    expect(new Set(publicData.speakingOrder).size).toBe(3)
    for (const view of views) {
      expect(view.gamePublicState?.data).toEqual(views[0].gamePublicState?.data)
      expect(view.privateState?.gameId).toBe(game)
      expect(view.privateState?.gameSessionId).toBe(view.roomState.currentGameSessionId)
      const shared = JSON.stringify({ roomState: view.roomState, gamePublicState: view.gamePublicState })
      for (const c of contents) {
        if (c.word) expect(shared).not.toContain(c.word)
        if (c.hint) expect(shared).not.toContain(c.hint)
      }
      expect(shared).not.toContain('impostorId')
      expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot: view })).toBe(true)
      for (const foreign of views) {
        if (foreign === view) continue
        const privateForeign = foreign.privateState?.data as ImpostorLanPrivate
        if (privateForeign.word && privateForeign.word !== (view.privateState?.data as ImpostorLanPrivate).word) {
          expect(JSON.stringify(view.privateState)).not.toContain(privateForeign.word)
        }
      }
    }
  })

  it('enforces 3-player minimum, validated configs and unanimity of readiness', () => {
    const sim = simulator(1)
    expect(sim.send(sim.players[0], 'SELECT_GAME', { gameId: game }).result.status).toBe('accepted')
    expect(sim.send(sim.players[0], 'CONFIGURE_GAME', { impostorMode: 'no-word' }).result.error).toBe('invalid_config')
    sim.ok(sim.players[0], 'CONFIGURE_GAME', { impostorMode: 'no-word', conversationMode: 'one-word' })
    sim.ok(sim.players[0], 'READY', { ready: true })
    expect(sim.send(sim.players[0], 'START_GAME').result.error).toBe('not_ready')
    sim.ok(sim.players[1], 'READY', { ready: true })
    expect(sim.send(sim.players[0], 'START_GAME').result.error).toBe('invalid_player_count')
    expect(sim.view(sim.players[0]).roomState.phase).toBe('configuring')
  })

  it('permits only host to moderate, and only the impostor to guess, without changing revision on rejection', () => {
    const sim = simulator()
    sim.start()
    const guest = sim.players[1]
    const startRevision = sim.runtime.getRevision()
    expect(sim.send(guest, 'START_CLUES', null, 'game').result.error).toBe('unauthorized')
    expect(sim.runtime.getRevision()).toBe(startRevision)
    expect(sim.send(sim.players[0], 'START_CLUES', null, 'game').result.error).toBe('invalid_phase')
    expect(sim.send(guest, 'END_GAME').result.error).toBe('unauthorized')
    expect(sim.send(guest, 'ACCUSE', { playerId: 'host' }, 'game').result.error).toBe('unauthorized')
    sim.reveal()
    expect(sim.send(guest, 'NEXT_CLUE', null, 'game').result.error).toBe('unauthorized')
    sim.discuss()
    const badAccused = sim.players.find(p => p.id !== impostor(sim).id)!
    const beforeBad = sim.runtime.getRevision()
    expect(sim.send(guest, 'ACCUSE', { playerId: badAccused.id }, 'game').result.error).toBe('unauthorized')
    expect(sim.runtime.getRevision()).toBe(beforeBad)
    sim.ok(sim.players[0], 'ACCUSE', { playerId: impostor(sim).id }, 'game')
    expect(sim.state(sim.players[0]).public.step).toBe('final-guess')
    expect(sim.send(badAccused, 'GUESS_WORD', { word: 'whatever' }, 'game').result.status).toBe('rejected')
    expect(sim.send(sim.players[0], 'END_GAME').result.error).toBe('invalid_phase')
  })

  it('gives the impostor a single chance to steal the real word, including accent/case normalization', () => {
    const sim = simulator()
    sim.start()
    const imp = impostor(sim)
    const correct = sim.state(sim.players.find(p => p.id !== imp.id)!).private.word!
    sim.reveal()
    sim.discuss()
    sim.ok(sim.players[0], 'ACCUSE', { playerId: imp.id }, 'game')
    const response = sim.ok(imp, 'GUESS_WORD', { word: correct.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }, 'game')
    expect(response.result.status).toBe('accepted')
    expect(sim.state(sim.players[0]).public).toMatchObject({
      step: 'summary', winner: 'impostor', reason: 'stolen-word',
      result: { word: correct, impostorId: imp.id },
    })
    expect(sim.state(sim.players[0]).public.result!.points[imp.id]).toBe(2)
    expect(sim.send(imp, 'GUESS_WORD', { word: correct }, 'game').result.status).toBe('rejected')
    sim.ok(sim.players[0], 'END_GAME')
    expect(sim.view(sim.players[0]).roomState.phase).toBe('results')
  })

  it('awards group for wrong guess and impostor for incorrect accusation; supports host skip', () => {
    for (const scenario of ['wrong-guess', 'wrong-accusation', 'skip'] as const) {
      const sim = simulator()
      sim.start()
      sim.reveal()
      sim.discuss()
      const imp = impostor(sim)
      const notImp = sim.players.find(p => p.id !== imp.id)!
      sim.ok(sim.players[0], 'ACCUSE', { playerId: scenario === 'wrong-accusation' ? notImp.id : imp.id }, 'game')
      if (scenario === 'wrong-guess') sim.ok(imp, 'GUESS_WORD', { word: 'palavra errada inventada' }, 'game')
      if (scenario === 'skip') sim.ok(sim.players[0], 'SKIP_GUESS', null, 'game')
      const pub = sim.state(sim.players[0]).public
      expect(pub.step).toBe('summary')
      expect(pub.winner).toBe(scenario === 'wrong-accusation' ? 'impostor' : 'group')
      expect(pub.result!.points[imp.id]).toBe(scenario === 'wrong-accusation' ? 2 : 0)
      expect(pub.result!.points[notImp.id]).toBe(scenario === 'wrong-accusation' ? 0 : 1)
    }
  })

  it('preserves a Room across results/lobby and clears prior session secrets for new rounds', () => {
    const sim = simulator()
    const first = sim.start()
    sim.reveal()
    sim.discuss()
    const imp = impostor(sim)
    const other = sim.players.find(p => p.id !== imp.id)!
    sim.ok(sim.players[0], 'ACCUSE', { playerId: other.id }, 'game')
    sim.ok(sim.players[0], 'END_GAME')
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    for (const p of sim.players) {
      const snap = sim.view(p)
      expect(snap.roomId).toBe('round-room')
      expect(snap.roomState.currentGameSessionId).toBeNull()
      expect(snap.privateState).toBeNull()
      expect(snap.gamePublicState).toBeNull()
      expect(snap.roomState.members).toHaveLength(3)
    }
    const second = sim.start({ impostorMode: 'hint', conversationMode: 'guided-questions' })
    expect(second).not.toBe(first)
    expect(sim.view(sim.players[0]).roomState.currentGameSessionId).toBe(second)
    expect(sim.state(sim.players[0]).public).toMatchObject({ step: 'reveal', seenCount: 0, result: null })
    for (const p of sim.players) {
      expect(sim.view(p).privateState?.gameSessionId).toBe(second)
    }
    expect(sim.send(sim.players[1], 'ACK_BRIEFING', null, 'game', first).result.error).toBe('stale_game_session')
  })

  it('resumes the same private card for its original member without advancing an incomplete barrier', () => {
    const sim = simulator()
    sim.start({ impostorMode: 'hint', conversationMode: 'guided-questions' })
    for (const p of sim.players) sim.ok(p, 'ACK_BRIEFING', null, 'game')
    const leaving = sim.players[1]
    const before = sim.view(leaving).privateState
    expect(sim.runtime.disconnect(leaving.conn).ok).toBe(true)
    expect(sim.send(sim.players[0], 'START_CLUES', null, 'game').result.error).toBe('not_ready')
    expect(sim.runtime.snapshotFor(leaving.id, leaving.conn)).toMatchObject({
      ok: false, error: 'unauthorized',
    })
    const rejoined = { id: leaving.id, conn: 'rejoined-secure-conn' }
    const resumed = sim.runtime.reassociate(rejoined.id, rejoined.conn)
    expect(resumed.ok).toBe(true)
    expect(sim.view(rejoined).privateState).toEqual(before)
    expect(sim.view(rejoined).roomState.members.find(m => m.playerId === rejoined.id)?.connected).toBe(true)
    expect(sim.send(sim.players[0], 'START_CLUES', null, 'game').result.status).toBe('accepted')
    expect(sim.state(sim.players[0]).public.step).toBe('clues')
  })

  it('does not give a late joiner a word and rejects an out-of-session game command', () => {
    const sim = simulator()
    sim.start()
    const late = sim.runtime.joinGuest('late-conn')
    expect(late).toMatchObject({ ok: true, snapshot: { privateState: null } })
    if (!late.ok) return
    const guest: Player = { id: late.playerId, conn: 'late-conn' }
    expect(sim.view(guest).roomState.members.find(m => m.playerId === guest.id)?.participation).toBe('waiting')
    expect(sim.send(guest, 'ACK_BRIEFING', null, 'game').result.error).toBe('not_participant')
    expect(sim.view(guest).privateState).toBeNull()
  })

  it('holds the reveal barrier if a player disconnects after reading their word', () => {
    const sim = simulator()
    sim.start()
    for (const p of sim.players) sim.ok(p, 'ACK_BRIEFING', null, 'game')
    const disconnected = sim.runtime.disconnect(sim.players[2].conn)
    expect(disconnected.ok).toBe(true)
    const before = sim.runtime.getRevision()
    expect(sim.send(sim.players[0], 'START_CLUES', null, 'game').result.error).toBe('not_ready')
    expect(sim.runtime.getRevision()).toBe(before)
    expect(sim.state(sim.players[0]).public.step).toBe('reveal')
  })

  it('keeps frame size under protocol cap for 12 players with guided questions', () => {
    const sim = simulator(11)
    sim.start({ impostorMode: 'hint', conversationMode: 'guided-questions' })
    for (const p of sim.players) {
      const snapshot = sim.view(p)
      expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot })).toBe(true)
      expect(snapshot.privateState?.gameSessionId).toBe(snapshot.roomState.currentGameSessionId)
    }
  })
})

describe('Impostor immersive LAN individual voting — trusted Room authority', () => {
  const config: ImpostorLanConfig = {
    impostorMode: 'no-word', conversationMode: 'one-word', flow: 'individual-vote', timerSeconds: 120,
  }
  function readyForVoting(guests = 2) {
    const sim = simulator(guests)
    sim.start(config)
    for (const player of sim.players) sim.ok(player, 'ACK_BRIEFING', null, 'game')
    sim.ok(sim.players[0], 'START_VOTING', null, 'game')
    return sim
  }
  it('starts right on identity with a host timestamp and keeps each card private', () => {
    const sim = simulator()
    sim.start(config)
    expect(sim.state(sim.players[0]).public).toMatchObject({
      flow: 'individual-vote', step: 'reveal', seenCount: 0, startedAt: 10000, timerSeconds: 120,
      voteCount: 0, voteRound: 1,
    })
    expect(sim.send(sim.players[1], 'START_VOTING', null, 'game').result.error).toBe('unauthorized')
    for (const player of sim.players) sim.ok(player, 'ACK_BRIEFING', null, 'game')
    const before = sim.runtime.getRevision()
    sim.ok(sim.players[1], 'ACK_BRIEFING', null, 'game')
    expect(sim.runtime.getRevision()).toBe(before)
    expect(sim.send(sim.players[1], 'START_TIMER', null, 'game').result.error).toBe('invalid_phase')
    sim.ok(sim.players[0], 'START_TIMER', null, 'game')
    expect(sim.state(sim.players[1]).public.timerStartedAt).toBe(10000)
    expect(sim.send(sim.players[0], 'START_TIMER', null, 'game').result.status).toBe('rejected')
    sim.ok(sim.players[0], 'START_VOTING', null, 'game')
    expect(sim.state(sim.players[0]).private.word).toBeUndefined()
    expect(sim.state(sim.players[0]).public.result).toBeNull()
  })

  it('collects separate immutable votes with no interim tally, then computes result', () => {
    const sim = readyForVoting()
    const imp = impostor(sim)
    for (const [n, player] of sim.players.entries()) {
      sim.ok(player, 'VOTE', { playerId: imp.id }, 'game')
      const pub = sim.state(player).public
      if (n < 2) {
        expect(pub).toMatchObject({ step: 'voting', voteCount: n + 1, result: null, accusedId: null })
        expect(JSON.stringify(pub)).not.toContain('impostorId')
        expect(JSON.stringify(pub)).not.toContain('votes')
        expect(sim.state(player).private.hasVoted).toBe(true)
        expect(sim.state(sim.players[(n + 1) % 3]).private.hasVoted).toBe(false)
        const rev = sim.runtime.getRevision()
        expect(sim.send(player, 'VOTE', { playerId: 'host' }, 'game').result.status).toBe('accepted')
        expect(sim.runtime.getRevision()).toBe(rev)
      }
    }
    expect(sim.state(sim.players[0]).public).toMatchObject({ step: 'summary', winner: 'group',
      result: { impostorId: imp.id } })
    sim.ok(sim.players[0], 'END_GAME')
    expect(sim.view(sim.players[0]).roomState.phase).toBe('results')
    sim.ok(sim.players[0], 'RETURN_TO_LOBBY')
    expect(sim.view(sim.players[0]).roomState.phase).toBe('lobby')
  })

  it('runs one private runoff for a tie, and finishes inconclusive second tie deterministically', () => {
    const sim = readyForVoting()
    for (const [i, player] of sim.players.entries()) {
      sim.ok(player, 'VOTE', { playerId: sim.players[i].id }, 'game')
    }
    expect(sim.state(sim.players[0]).public).toMatchObject({ step: 'voting', voteRound: 2, voteCount: 0 })
    const candidates = sim.state(sim.players[0]).public.runoffCandidates!
    expect(candidates).toHaveLength(3)
    for (const [i, player] of sim.players.entries()) {
      sim.ok(player, 'VOTE', { playerId: candidates[i] }, 'game')
    }
    expect(sim.state(sim.players[0]).public).toMatchObject({
      step: 'summary', winner: 'impostor', reason: 'tied-vote',
    })
  })

  it('requires all original participants and never accepts a guest moderator or late entrant vote', () => {
    const sim = simulator()
    sim.start(config)
    for (const player of sim.players) sim.ok(player, 'ACK_BRIEFING', null, 'game')
    const revision = sim.runtime.getRevision()
    expect(sim.send(sim.players[1], 'START_VOTING', null, 'game').result.error).toBe('unauthorized')
    expect(sim.runtime.getRevision()).toBe(revision)
    sim.runtime.disconnect(sim.players[2].conn)
    expect(sim.send(sim.players[0], 'START_VOTING', null, 'game').result.error).toBe('not_ready')
    const rejoined = { id: sim.players[2].id, conn: 'secure-rejoined' }
    expect(sim.runtime.reassociate(rejoined.id, rejoined.conn).ok).toBe(true)
    sim.ok(sim.players[0], 'START_VOTING', null, 'game')
    const late = sim.runtime.joinGuest('newcomer')
    expect(late.ok).toBe(true)
    if (!late.ok) return
    const newPlayer = { id: late.playerId, conn: 'newcomer' }
    expect(sim.send(newPlayer, 'VOTE', { playerId: sim.players[0].id }, 'game').result.error).toBe('not_participant')
    expect(sim.send(sim.players[0], 'VOTE', { playerId: 'outsider' }, 'game').result.error).toBe('invalid_phase')
  })

  it('keeps 12-player projections below protocol frame size including runoff', () => {
    const sim = readyForVoting(11)
    for (const player of sim.players) {
      expect(roomFrameFits({ kind: 'snapshotV2', protocolVersion: 2, snapshot: sim.view(player) })).toBe(true)
    }
  })
})
