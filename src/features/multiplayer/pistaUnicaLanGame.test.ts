import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { pistaUnicaLanGame } from './pistaUnicaLanGame'
import type { PistaUnicaLanPublic, PistaUnicaLanPrivate } from './pistaUnicaLanGame'
import { roomFrameFits } from './persistentProtocol'

type Player = { id: string; conn: string }
function sim(guestCount = 2) {
  let n = 0
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'g6', hostPlayerId: 'host',
    hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter([pistaUnicaLanGame]),
    createPlayerId: () => `guest-${++n}`, random: () => 0, clock: { now: () => 1000 } })
  const players: Player[] = [{ id: 'host', conn: 'host-conn' }]
  for (let i = 0; i < guestCount; i++) {
    const conn = `conn-${i}`
    const join = runtime.joinGuest(conn)
    if (!join.ok) throw Error('join failed')
    players.push({ id: join.playerId, conn })
  }
  const view = (p: Player) => {
    const result = runtime.snapshotFor(p.id, p.conn)
    if (!result.ok) throw Error('bad snapshot')
    return result.snapshot
  }
  const send = (p: Player, type: string, payload: unknown = null,
    scope: 'room' | 'game' = 'room', oldId?: string) => {
    const snapshot = view(p)
    return runtime.processCommand({ protocolVersion: 2, roomId: 'g6', scope,
      playerId: p.id, clientSeq: snapshot.nextClientSeq, commandId: crypto.randomUUID(),
      type, payload, ...(scope === 'game'
        ? { gameSessionId: oldId ?? snapshot.roomState.currentGameSessionId! } : {}) }, p.conn)
  }
  const ok = (p: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'room') => {
    const result = send(p, type, payload, scope)
    expect(result.result.status, type).toBe('accepted')
    return result
  }
  const pub = () => view(players[0]).gamePublicState!.data as PistaUnicaLanPublic
  const priv = (p: Player) => view(p).privateState!.data as PistaUnicaLanPrivate
  const guesser = () => players.find(p => p.id === pub().guesserId)!
  const writers = () => players.filter(p => p.id !== pub().guesserId)
  const begin = (categories = ['words']) => {
    ok(players[0], 'SELECT_GAME', { gameId: 'pista-unica' })
    ok(players[0], 'CONFIGURE_GAME', { categories })
    players.forEach(p => ok(p, 'READY', { ready: true }))
    ok(players[0], 'START_GAME')
  }
  const clues = (values: string[]) => writers().forEach((p, i) => ok(p, 'SUBMIT_CLUE', { text: values[i] }, 'game'))
  return { runtime, players, view, send, ok, pub, priv, guesser, writers, begin, clues }
}

describe('G6 — Pista Única LAN with private targets and authoritative rounds', () => {
  it('enforces category config and 3 to 12 players', () => {
    const a = sim(1)
    a.ok(a.players[0], 'SELECT_GAME', { gameId: 'pista-unica' })
    for (const cats of [[], ['unknown'], ['words', 'words'], ['words', 'bad'], 'words']) {
      expect(a.send(a.players[0], 'CONFIGURE_GAME', { categories: cats }).result.error).toBe('invalid_config')
    }
    a.ok(a.players[0], 'CONFIGURE_GAME', { categories: ['movies'] })
    a.players.forEach(p => a.ok(p, 'READY', { ready: true }))
    expect(a.send(a.players[0], 'START_GAME').result.error).toBe('invalid_player_count')
    const many = sim(11)
    many.begin(['movies', 'series'])
    expect(many.pub().totalRounds).toBe(12)
  })

  it('keeps target invisible to guesser, host when guessing, and public snapshots before answer', () => {
    const s = sim()
    s.begin()
    expect(s.pub()).toMatchObject({ step: 'writing', round: 1, totalRounds: 3, submittedCount: 0, clues: [] })
    expect(s.priv(s.guesser()).target).toBeUndefined()
    const target = s.priv(s.writers()[0]).target!
    expect(target).toBeTruthy()
    expect(s.priv(s.writers()[1]).target).toBe(target)
    for (const p of s.players) {
      const snap = s.view(p)
      expect(JSON.stringify({roomState:snap.roomState,gamePublicState:snap.gamePublicState})).not.toContain(target)
      if (p.id === s.guesser().id) expect(JSON.stringify(snap.privateState)).not.toContain(target)
    }
    s.ok(s.writers()[0], 'SUBMIT_CLUE', { text: 'comida' }, 'game')
    expect(JSON.stringify(s.view(s.guesser()))).not.toContain('comida')
    expect(s.pub().submittedCount).toBe(1)
  })

  it('rejects guesses from writer and duplicate submission; eliminates repeated clues by normalized spelling', () => {
    const s = sim(3)
    s.begin()
    const [a,b,c] = s.writers()
    expect(s.send(s.guesser(), 'SUBMIT_CLUE', {text:'hi'}, 'game').result.error).toBe('unauthorized')
    expect(s.send(a, 'SUBMIT_CLUE', {text:'  '}, 'game').result.error).toBe('invalid_payload')
    s.ok(a,'SUBMIT_CLUE',{text:'Maçã'},'game')
    expect(s.send(a,'SUBMIT_CLUE',{text:'banana'},'game').result.status).toBe('rejected')
    s.ok(b,'SUBMIT_CLUE',{text:'maca'},'game')
    expect(s.pub().clues).toEqual([])
    s.ok(c,'SUBMIT_CLUE',{text:'Fruta'},'game')
    expect(s.pub()).toMatchObject({step:'guessing',clues:['Maçã','Fruta'],excludedCount:1})
    expect(s.send(a,'SUBMIT_GUESS',{text:'apple'},'game').result.error).toBe('unauthorized')
  })

  it('checks guess from guesser on host and rotates to next player without leaking new target', () => {
    const s = sim()
    s.begin()
    const target = s.priv(s.writers()[0]).target!
    expect(s.send(s.guesser(),'SUBMIT_GUESS',{text:target},'game').result.error).toBe('invalid_phase')
    s.clues(['uma','duas'])
    const answer = target.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    s.ok(s.guesser(),'SUBMIT_GUESS',{text:answer},'game')
    expect(s.pub()).toMatchObject({step:'round-result',lastResult:{correct:true,target,guessedText:answer}})
    const before = s.view(s.players[0]).revision
    expect(s.send(s.guesser(),'SUBMIT_GUESS',{text:answer},'game').result.error).toBe('invalid_phase')
    expect(s.view(s.players[0]).revision).toBe(before)
    expect(s.send(s.players[1],'NEXT_ROUND',null,'game').result.error).toBe('unauthorized')
    s.ok(s.players[0],'NEXT_ROUND',null,'game')
    expect(s.pub()).toMatchObject({step:'writing',round:2,submittedCount:0,clues:[]})
    expect(s.pub().guesserId).not.toBe(s.players[0].id)
    expect(JSON.stringify(s.view(s.players[0]).gamePublicState)).not.toContain(s.priv(s.writers()[0]).target!)
  })

  it('plays every round and accumulates one point per correct guess in G5E, only on END_GAME', () => {
    const s = sim()
    s.begin()
    const first = s.view(s.players[0]).roomState.currentGameSessionId
    for (let round = 0; round < 3; round++) {
      const actor = s.guesser()
      const target = s.priv(s.writers()[0]).target!
      s.clues(['um','dois'])
      s.ok(actor,'SUBMIT_GUESS',{text:round===1?'uma resposta errada':target},'game')
      expect(s.pub().lastResult?.correct).toBe(round !== 1)
      s.ok(s.players[0],'NEXT_ROUND',null,'game')
    }
    expect(s.pub()).toMatchObject({step:'summary',scores:{host:1,'guest-1':0,'guest-2':1}})
    expect(s.send(s.players[0],'NEXT_ROUND',null,'game').result.error).toBe('invalid_phase')
    s.ok(s.players[0],'END_GAME')
    expect(s.view(s.players[0]).roomState.competition?.standings.map(p=>p.points)).toEqual([1,0,1])
    expect(s.send(s.players[0],'END_GAME').result.error).toBe('invalid_phase')
    s.ok(s.players[0],'RETURN_TO_LOBBY')
    expect(s.view(s.players[1]).privateState).toBeNull()
    s.begin(['movies'])
    expect(s.view(s.players[0]).roomState.currentGameSessionId).not.toBe(first)
    expect(s.view(s.players[0]).roomState.competition?.standings.map(p=>p.points)).toEqual([1,0,1])
  })

  it('rejects early ending, late entrants and malformed clue input', () => {
    const s = sim()
    s.begin()
    expect(s.send(s.players[0],'END_GAME').result.error).toBe('invalid_phase')
    const late = s.runtime.joinGuest('later')
    expect(late.ok).toBe(true)
    if (!late.ok) return
    expect(late.snapshot.privateState).toBeNull()
    const later = {id:late.playerId,conn:'later'}
    expect(s.send(later,'SUBMIT_CLUE',{text:'forged'},'game').result.error).toBe('not_participant')
    const writer = s.writers()[0]
    for (const value of ['', ' '.repeat(20), 'x'.repeat(49), 123]) {
      expect(s.send(writer,'SUBMIT_CLUE',{text:value},'game').result.status).toBe('rejected')
    }
    expect(s.pub().submittedCount).toBe(0)
  })

  it('stays below the 16KiB projection cap with 12 participants and eleven clues', () => {
    const s = sim(11)
    s.begin(['words','movies','series'])
    s.writers().forEach((p,i)=>s.ok(p,'SUBMIT_CLUE',{text:`Pista ${i}`},'game'))
    for (const p of s.players) {
      expect(roomFrameFits({kind:'snapshotV2',protocolVersion:2,snapshot:s.view(p)})).toBe(true)
      expect(s.pub().clues).toHaveLength(11)
    }
  })
})
