import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { cidadeDormeLanGame, type CidadeDormeLanPublic, type CidadeDormeLanPrivate } from './cidadeDormeLanGame'
import { roomFrameFits } from './persistentProtocol'

type Player = { id: string; conn: string }
const defaults = { enableDoctor: true, enableDetective: true, enableJester: true, revealRoleOnDeath: false }
function sim(guests = 5, config = defaults, random: () => number = () => 0.999999) {
  let n = 0
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'g7', hostPlayerId: 'host',
    hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter([cidadeDormeLanGame]),
    createPlayerId: () => `guest-${++n}`, random, clock: { now: () => 1000 } })
  const players: Player[] = [{ id: 'host', conn: 'host-conn' }]
  for (let i = 0; i < guests; i++) {
    const conn = `conn-${i}`
    const joined = runtime.joinGuest(conn)
    if (!joined.ok) throw Error('join failed')
    players.push({ id: joined.playerId, conn })
  }
  const view = (p: Player) => {
    const result = runtime.snapshotFor(p.id, p.conn)
    if (!result.ok) throw Error('snapshot failed')
    return result.snapshot
  }
  const send = (p: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'game',
    oldId?: string) => {
    const snap = view(p)
    return runtime.processCommand({ protocolVersion: 2, scope, roomId: 'g7', playerId: p.id,
      clientSeq: snap.nextClientSeq, commandId: crypto.randomUUID(), type, payload,
      ...(scope === 'game' ? { gameSessionId: oldId ?? snap.roomState.currentGameSessionId! } : {}) }, p.conn)
  }
  const ok = (p: Player, type: string, payload: unknown = null, scope: 'room' | 'game' = 'game') => {
    const outcome = send(p, type, payload, scope)
    expect(outcome.result.status, `${type}: ${JSON.stringify(outcome.result)}`).toBe('accepted')
    return outcome
  }
  const pub = () => view(players[0]).gamePublicState!.data as CidadeDormeLanPublic
  const priv = (p: Player) => view(p).privateState!.data as CidadeDormeLanPrivate
  const role = (r: CidadeDormeLanPrivate['role']) => players.find(p => priv(p)?.role === r)!
  const begin = () => {
    ok(players[0], 'SELECT_GAME', { gameId: 'cidade-dorme' }, 'room')
    ok(players[0], 'CONFIGURE_GAME', config, 'room')
    players.forEach(p => ok(p, 'READY', { ready: true }, 'room'))
    ok(players[0], 'START_GAME', null, 'room')
  }
  const night = () => {
    players.forEach(p => ok(p, 'ACK_ROLE'))
    ok(players[0], 'START_NIGHT')
  }
  const vote = (targetId: string) => {
    ok(players[0], 'START_DISCUSSION')
    ok(players[0], 'START_VOTE')
    players.filter(p => pub().players.find(x => x.id === p.id)?.alive)
      .forEach(p => ok(p, 'CAST_VOTE', { playerId: targetId }))
    ok(players[0], 'RESOLVE_VOTE')
  }
  return { runtime, players, view, send, ok, pub, priv, role, begin, night, vote }
}
describe('G7 Cidade Dorme LAN — roles, private actions and team competition', () => {
  it('validates 4–12 capacity and rejects malformed role configurations', () => {
    const a = sim(2)
    a.ok(a.players[0], 'SELECT_GAME', { gameId: 'cidade-dorme' }, 'room')
    for (const config of [{}, { enableDoctor: true }, { ...defaults, enableJester: 'yes' },
      { ...defaults, revealRoleOnDeath: false, unexpected: 1 }]) {
      expect(a.send(a.players[0], 'CONFIGURE_GAME', config, 'room').result.error).toBe('invalid_config')
    }
    a.ok(a.players[0], 'CONFIGURE_GAME', defaults, 'room')
    a.players.forEach(p => a.ok(p, 'READY', { ready: true }, 'room'))
    expect(a.send(a.players[0], 'START_GAME', null, 'room').result.error).toBe('invalid_player_count')
    const full = sim(11)
    full.begin()
    expect(full.pub().players).toHaveLength(12)
    expect(full.pub().step).toBe('reveal')
  })

  it('keeps every role and killer identity secret in public projections including host snapshot', () => {
    const s = sim()
    s.begin()
    expect(s.pub()).toMatchObject({ step: 'reveal', round: 1, seenCount: 0 })
    expect(s.players.map(p => s.priv(p).role).sort()).toEqual(
      ['citizen', 'citizen', 'detective', 'doctor', 'jester', 'killer'])
    for (const p of s.players) {
      const snap = s.view(p)
      expect(JSON.stringify(snap.gamePublicState)).not.toMatch(/roleKey|killerId|roles|detectiveResult|protectedPlayerId/)
      expect(s.priv(p).role).toBeTruthy()
      if (s.priv(p).role !== 'killer') expect(s.priv(p).killerTeammates).toBeUndefined()
      expect(roomFrameFits({kind:'snapshotV2',protocolVersion:2,snapshot:snap})).toBe(true)
    }
    expect(s.send(s.players[1], 'START_NIGHT').result.error).toBe('unauthorized')
    expect(s.send(s.players[0], 'START_NIGHT').result.error).toBe('invalid_phase')
  })

  it('requires role acknowledgement then accepts only authenticated living night roles', () => {
    const s = sim()
    s.begin(); s.night()
    expect(s.pub().step).toBe('killer-turn')
    const killer = s.role('killer')
    const doctor = s.role('doctor')
    const detective = s.role('detective')
    const citizen = s.role('citizen')
    expect(s.send(citizen, 'KILL', { playerId: doctor.id }).result.error).toBe('unauthorized')
    expect(s.send(doctor, 'PROTECT', { playerId: doctor.id }).result.error).toBe('invalid_phase')
    expect(s.send(killer, 'KILL', { playerId: killer.id }).result.error).toBe('invalid_payload')
    s.ok(killer, 'KILL', { playerId: citizen.id })
    expect(s.pub().step).toBe('doctor-turn')
    expect(JSON.stringify(s.view(doctor).gamePublicState)).not.toContain(citizen.id+'-target')
    expect(s.send(killer, 'PROTECT', { playerId: citizen.id }).result.error).toBe('unauthorized')
    expect(s.send(doctor, 'PROTECT', { playerId: doctor.id }).result.error).toBe('invalid_payload')
    s.ok(doctor, 'PROTECT', { playerId: citizen.id })
    expect(s.pub().step).toBe('detective-turn')
    s.ok(detective, 'INVESTIGATE', { playerId: killer.id })
    expect(s.pub().step).toBe('morning')
    expect(s.priv(detective).investigation).toMatchObject({ targetId: killer.id, result: 'suspect' })
    for (const p of s.players.filter(x => x.id !== detective.id)) {
      expect(JSON.stringify(s.priv(p))).not.toContain('suspect')
    }
    expect(JSON.stringify(s.pub())).not.toContain('suspect')
    expect(s.pub().nightResult?.eliminatedId).toBeNull()
  })

  it('keeps individual votes hidden and rewards all city teammates after last killer is voted out', () => {
    const s = sim()
    s.begin(); s.night()
    s.ok(s.role('killer'), 'KILL', { playerId: s.role('citizen').id })
    s.ok(s.role('doctor'), 'PROTECT', { playerId: s.role('citizen').id })
    s.ok(s.role('detective'), 'INVESTIGATE', { playerId: s.role('killer').id })
    s.ok(s.players[0], 'START_DISCUSSION')
    s.ok(s.players[0], 'START_VOTE')
    expect(s.send(s.role('doctor'), 'RESOLVE_VOTE').result.error).toBe('unauthorized')
    expect(s.send(s.players[0], 'RESOLVE_VOTE').result.error).toBe('not_ready')
    const target = s.role('killer').id
    const voters = s.players.filter(p => s.pub().players.find(x => x.id === p.id)?.alive)
    s.ok(voters[0], 'CAST_VOTE', { playerId: target })
    expect(JSON.stringify(s.pub())).not.toContain('"votes"')
    expect(s.pub().votedCount).toBe(1)
    expect(s.send(voters[0], 'CAST_VOTE', { playerId: target }).result.error).toBe('invalid_phase')
    voters.slice(1).forEach(p => s.ok(p, 'CAST_VOTE', { playerId: target }))
    s.ok(s.players[0], 'RESOLVE_VOTE')
    expect(s.pub()).toMatchObject({ step: 'summary', winner: 'city', winReason: 'city-eliminated-killers' })
    expect(s.send(s.players[0], 'END_GAME', null, 'room').result.status).toBe('accepted')
    const score = s.view(s.players[0]).roomState.competition!
    expect(score.completedGames).toBe(1)
    for (const p of s.players) {
      expect(score.standings.find(x => x.playerId === p.id)?.points).toBe(
        p.id === target || s.priv(p).role === 'jester' ? 0 : 2)
    }
  })

  it('awards only the jester 2 points if the neutral player is voted out', () => {
    const s = sim()
    s.begin(); s.night()
    const citizen = s.role('citizen')
    s.ok(s.role('killer'),'KILL',{playerId:citizen.id})
    s.ok(s.role('doctor'),'PROTECT',{playerId:citizen.id})
    s.ok(s.role('detective'),'INVESTIGATE',{playerId:s.role('killer').id})
    s.vote(s.role('jester').id)
    expect(s.pub()).toMatchObject({ step: 'summary', winner: 'jester',
      winReason: 'jester-voted-out' })
    s.ok(s.players[0], 'END_GAME', null, 'room')
    const scored = s.view(s.players[0]).roomState.competition!
    expect(scored.standings.filter(p => p.points === 2).map(p => p.playerId)).toEqual([s.role('jester').id])
  })

  it('supports killer parity, skips disabled roles and carries team points between Room games', () => {
    const s = sim(3, { enableDoctor:false, enableDetective:false, enableJester:false, revealRoleOnDeath:false })
    s.begin(); s.night()
    expect(s.pub().step).toBe('killer-turn')
    const target = s.role('citizen')
    s.ok(s.role('killer'), 'KILL', { playerId: target.id })
    expect(s.pub().step).toBe('morning')
    expect(s.pub().nightResult?.eliminatedId).toBe(target.id)
    s.vote(s.players.find(p => p.id !== s.role('killer').id && p.id !== target.id)!.id)
    expect(s.pub().winner).toBe('killers')
    s.ok(s.players[0], 'END_GAME', null, 'room')
    const points = s.view(s.players[0]).roomState.competition!
    expect(points.standings.find(p => p.playerId === s.role('killer').id)?.points).toBe(2)
    s.ok(s.players[0], 'RETURN_TO_LOBBY', null, 'room')
    expect(s.view(s.players[0]).roomState.competition?.completedGames).toBe(1)
  })

  it('handles tie votes without elimination and continues same GameSession into next night', () => {
    const s = sim(3, { enableDoctor:false, enableDetective:false, enableJester:false, revealRoleOnDeath:false })
    s.begin(); s.night()
    const alive = s.players
    s.ok(s.role('killer'), 'KILL', { playerId: alive[3].id })
    s.ok(s.players[0], 'START_DISCUSSION')
    s.ok(s.players[0], 'START_VOTE')
    const voters = s.players.filter(p => s.pub().players.find(x => x.id === p.id)?.alive)
    voters.forEach((p, index) => s.ok(p, 'CAST_VOTE', { playerId: voters[index].id }))
    s.ok(s.players[0], 'RESOLVE_VOTE')
    expect(s.pub()).toMatchObject({ step: 'vote-result', voteResult: { kind: 'tie' } })
    const old = s.view(s.players[0]).roomState.currentGameSessionId
    s.ok(s.players[0], 'NEXT_NIGHT')
    expect(s.pub()).toMatchObject({ step: 'killer-turn', round: 2 })
    expect(s.view(s.players[0]).roomState.currentGameSessionId).toBe(old)
  })

  it('keeps multiple killers in one team while only the elected living killer can attack',()=>{
    const s=sim(11)
    s.begin()
    const killers=s.players.filter(p=>s.priv(p).role==='killer')
    expect(killers).toHaveLength(3)
    expect(s.priv(killers[0]).killerTeammates).toHaveLength(2)
    s.night()
    const citizen=s.role('citizen')
    expect(s.send(killers[1],'KILL',{playerId:citizen.id}).result.error).toBe('unauthorized')
    const before=s.pub()
    expect(before.step).toBe('killer-turn')
    expect(before.players.every(p=>!('revealedRole' in p))).toBe(true)
    s.ok(killers[0],'KILL',{playerId:citizen.id})
    expect(s.pub().step).toBe('doctor-turn')
  })

  it('respects reveal-role-on-death setting without leaking any living roles',()=>{
    for (const revealRoleOnDeath of [false,true]){
      const s=sim(3,{enableDoctor:false,enableDetective:false,enableJester:false,revealRoleOnDeath})
      s.begin();s.night()
      const citizen=s.role('citizen')
      s.ok(s.role('killer'),'KILL',{playerId:citizen.id})
      const eliminated=s.pub().players.find(x=>x.id===citizen.id)!
      expect(eliminated.alive).toBe(false)
      expect(eliminated.revealedRole).toBe(revealRoleOnDeath?'citizen':undefined)
      for(const person of s.pub().players.filter(p=>p.alive)){
        expect(person.revealedRole).toBeUndefined()
      }
    }
  })

  it('blocks outsider/late participants, early END_GAME and oversize 12-member snapshots', () => {
    const s = sim(11)
    s.begin()
    expect(s.send(s.players[0], 'END_GAME', null, 'room').result.error).toBe('invalid_phase')
    const join = s.runtime.joinGuest('late')
    expect(join.ok).toBe(false)
    for (const p of s.players) expect(roomFrameFits({kind:'snapshotV2',
      protocolVersion:2,snapshot:s.view(p)})).toBe(true)
  })
})
