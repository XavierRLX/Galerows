import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { cidadeDormeLanGame, type CidadeDormeLanPrivate, type CidadeDormeLanPublic } from './cidadeDormeLanGame'

const rules = { enableDoctor: false, enableDetective: false, enableJester: false, revealRoleOnDeath: false }
type Member = { id: string; connection: string }
function room(count: number) {
  let counter = 0
  let now = 1000
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'city-mayor-01', hostPlayerId: 'mayor', hostConnectionId: 'mayor-conn',
    adapter: new RoomLifecycleAdapter([cidadeDormeLanGame]),
    createPlayerId: () => 'g' + (++counter), random: () => .999999,
    clock: { now: () => now },
  })
  const mayor: Member = { id: 'mayor', connection: 'mayor-conn' }
  const players: Member[] = []
  function join() {
    const conn = 'conn-' + (counter + 1)
    const admitted = runtime.joinGuest(conn)
    if (!admitted.ok) return { error: admitted.error }
    const player: Member = { id: admitted.playerId, connection: conn }
    players.push(player)
    return { player }
  }
  for (let i = 0; i < count; i++) expect(join()).toHaveProperty('player')
  function view(member: Member = mayor) {
    const result = runtime.snapshotFor(member.id, member.connection)
    if (!result.ok) throw new Error(result.error)
    return result.snapshot
  }
  function send(member: Member, type: string, payload: unknown = null, scope: 'game' | 'room' = 'game') {
    const snapshot = view(member)
    return runtime.processCommand({
      protocolVersion: 2, roomId: snapshot.roomId, scope, playerId: member.id,
      commandId: crypto.randomUUID(), clientSeq: snapshot.nextClientSeq, type, payload,
      ...(scope === 'game' ? { gameSessionId: snapshot.roomState.currentGameSessionId! } : {}),
    }, member.connection).result
  }
  function ok(member: Member, type: string, payload: unknown = null, scope: 'game' | 'room' = 'game') {
    const result = send(member, type, payload, scope)
    expect(result.status, JSON.stringify(result)).toBe('accepted')
  }
  function setup(mode: 'mayor' | 'automatic' = 'mayor') {
    ok(mayor, 'SELECT_GAME', { gameId: 'cidade-dorme' }, 'room')
    ok(mayor, 'CONFIGURE_GAME', { ...rules, conductionMode: mode }, 'room')
  }
  function start() {
    players.forEach(p => ok(p, 'READY', { ready: true }, 'room'))
    ok(mayor, 'START_GAME', null, 'room')
  }
  return { runtime, mayor, players, view, send, ok, setup, start, join,
    advanceClock: (ms:number)=>{now+=ms} }
}

describe('CITY-MAYOR-01 — authoritative dedicated moderator', () => {
  it('starts with 4 playing guests; mayor does not require READY, receive role or count in the game', () => {
    const s = room(4)
    s.setup()
    s.start()
    const mayorView = s.view(s.mayor)
    expect(mayorView.roomState.phase).toBe('playing')
    expect(mayorView.roomState.members).toHaveLength(5)
    expect(mayorView.roomState.members.find(m => m.playerId === 'mayor')?.participation).toBe('waiting')
    expect(mayorView.gamePublicState?.data).toMatchObject({ totalPlayers: 4, seenCount: 0 })
    expect(mayorView.privateState).toBeNull()
    for (const p of s.players) {
      expect((s.view(p).privateState?.data as CidadeDormeLanPrivate).role).toBeTruthy()
      expect(JSON.stringify(s.view(p).privateState?.data)).not.toContain('mayor')
    }
    expect(s.send(s.mayor, 'ACK_ROLE').error).toBe('not_participant')
    expect(s.send(s.mayor, 'CAST_VOTE', { playerId: s.players[0].id }).error).toBe('not_participant')
    expect(s.send(s.mayor, 'KILL', { playerId: s.players[0].id }).error).toBe('not_participant')
  })

  it('permits the mayor to orchestrate only approved phases, never select private targets or vote', () => {
    const s = room(4); s.setup(); s.start()
    s.players.forEach(p => s.ok(p, 'ACK_ROLE'))
    expect(s.send(s.players[0], 'START_NIGHT').error).toBe('unauthorized')
    s.ok(s.mayor, 'START_NIGHT')
    const killer = s.players.find(p => (s.view(p).privateState?.data as CidadeDormeLanPrivate).role === 'killer')!
    const others = s.players.filter(p => p.id !== killer.id)
    expect(s.send(s.mayor, 'KILL', { playerId: others[0].id }).error).toBe('not_participant')
    s.ok(killer, 'KILL', { playerId: others[0].id })
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).step).toBe('morning')
    expect(s.send(s.players[1], 'START_DISCUSSION').error).toBe('unauthorized')
    s.ok(s.mayor, 'START_DISCUSSION')
    s.ok(s.mayor, 'START_VOTE')
    expect(s.send(s.mayor, 'CAST_VOTE', { playerId: others[0].id }).error).toBe('not_participant')
    expect(s.send(s.mayor, 'RESOLVE_VOTE').error).toBe('not_ready')
    s.players.filter(p => (s.view().gamePublicState?.data as CidadeDormeLanPublic).players.some(v => v.id === p.id && v.alive))
      .forEach(p => s.ok(p, 'CAST_VOTE', { playerId: killer.id }))
    s.ok(s.mayor, 'RESOLVE_VOTE')
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).winner).toBe('city')
    s.ok(s.mayor, 'END_GAME', null, 'room')
    expect(s.view(s.mayor).roomState.competition?.standings.find(x => x.playerId === 'mayor')?.played).toBe(0)
    s.ok(s.mayor, 'REPLAY_GAME', null, 'room')
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).totalPlayers).toBe(4)
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).step).toBe('reveal')
    expect(s.view(s.mayor).privateState).toBeNull()
  })

  it('rejects starting with fewer than four actual players, even if mayor is connected and ready', () => {
    const s = room(3); s.setup()
    s.players.forEach(p => s.ok(p, 'READY', { ready: true }, 'room'))
    expect(s.send(s.mayor, 'READY', { ready: true }, 'room').error).toBe('not_participant')
    expect(s.send(s.mayor, 'START_GAME', null, 'room').error).toBe('invalid_player_count')
  })

  it('does not alter the automatic format: host receives a private role and counts as player', () => {
    const s = room(3); s.setup('automatic')
    s.players.forEach(p => s.ok(p, 'READY', { ready: true }, 'room'))
    expect(s.send(s.mayor, 'START_GAME', null, 'room').error).toBe('not_ready')
    s.ok(s.mayor, 'READY', { ready: true }, 'room')
    s.ok(s.mayor, 'START_GAME', null, 'room')
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).totalPlayers).toBe(4)
    expect(s.view(s.mayor).privateState).not.toBeNull()
  })

  it('exposes a confidential role and action map only while the dedicated mayor explicitly opens it', () => {
    const s=room(4); s.setup(); s.start()
    const before=s.view(s.mayor)
    expect(before.privateState).toBeNull()
    expect(JSON.stringify(before.gamePublicState)).not.toContain('murderOrder')
    expect(s.send(s.players[0],'OPEN_MAYOR_SECRETS',null,'room').error).toBe('unauthorized')
    expect(s.send(s.mayor,'OPEN_MAYOR_SECRETS',{bad:true},'room').error).toBe('invalid_payload')
    s.ok(s.mayor,'OPEN_MAYOR_SECRETS',null,'room')
    const secret=s.view(s.mayor).privateState
    expect(secret?.gameId).toBe('cidade-dorme')
    expect(secret?.data).toMatchObject({kind:'mayor-consultation'})
    const roles=(secret?.data as {roles:{playerId:string,role:string}[]}).roles
    expect(roles).toHaveLength(4)
    expect(roles.some(p=>p.role==='killer')).toBe(true)
    for(const p of s.players) {
      expect(JSON.stringify(s.view(p).privateState)).not.toContain('mayor-consultation')
      expect(JSON.stringify(s.view(p).gamePublicState)).not.toContain('mayor-consultation')
    }
    s.ok(s.mayor,'CLOSE_MAYOR_SECRETS',null,'room')
    expect(s.view(s.mayor).privateState).toBeNull()
  })

  it('denies moderator consultation in automatic mode and outside a running City game',()=>{
    const lobby=room(4); lobby.setup()
    expect(lobby.send(lobby.mayor,'OPEN_MAYOR_SECRETS',null,'room').error).toBe('invalid_phase')
    const automatic=room(3);automatic.setup('automatic')
    automatic.players.forEach(p=>automatic.ok(p,'READY',{ready:true},'room'))
    automatic.ok(automatic.mayor,'READY',{ready:true},'room')
    automatic.ok(automatic.mayor,'START_GAME',null,'room')
    expect(automatic.send(automatic.mayor,'OPEN_MAYOR_SECRETS',null,'room').error).toBe('unauthorized')
  })

  it('clears consultation authorization on disconnect, even after the same host reassociates',()=>{
    const s=room(4);s.setup();s.start()
    s.ok(s.mayor,'OPEN_MAYOR_SECRETS',null,'room')
    expect(s.view(s.mayor).privateState).not.toBeNull()
    const before=s.view(s.mayor)
    expect(before.roomState.phase).toBe('playing')
    const runtime=s.runtime
    expect(runtime.disconnect(s.mayor.connection).ok).toBe(true)
    expect(runtime.reassociate(s.mayor.id,'mayor-reconnected').ok).toBe(true)
    const resumed=runtime.snapshotFor(s.mayor.id,'mayor-reconnected')
    expect(resumed.ok && resumed.snapshot.privateState).toBeNull()
  })

  it('only the mayor can pause and resume: players cannot act or vote during pause',()=>{
    const s=room(4);s.setup();s.start()
    s.ok(s.mayor,'PAUSE_CITY')
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).paused).toBe(true)
    expect(s.send(s.players[0],'ACK_ROLE').error).toBe('invalid_phase')
    expect(s.send(s.players[0],'RESUME_CITY').error).toBe('unauthorized')
    s.ok(s.mayor,'RESUME_CITY')
    expect((s.view(s.mayor).gamePublicState?.data as CidadeDormeLanPublic).paused).toBe(false)
    s.ok(s.players[0],'ACK_ROLE')
    const automatic=room(3);automatic.setup('automatic')
    automatic.players.forEach(p=>automatic.ok(p,'READY',{ready:true},'room'))
    automatic.ok(automatic.mayor,'READY',{ready:true},'room')
    automatic.ok(automatic.mayor,'START_GAME',null,'room')
    expect(automatic.send(automatic.mayor,'PAUSE_CITY').error).toBe('unauthorized')
  })
  it('expires a privileged consultation after 30 seconds on the server, even without CLOSE',()=>{
    const s=room(4);s.setup();s.start()
    s.ok(s.mayor,'OPEN_MAYOR_SECRETS',null,'room')
    expect(s.view(s.mayor).privateState?.data).toMatchObject({kind:'mayor-consultation'})
    s.advanceClock(30_001)
    expect(s.view(s.mayor).privateState).toBeNull()
    s.ok(s.mayor,'OPEN_MAYOR_SECRETS',null,'room')
    expect(s.view(s.mayor).privateState?.data).toMatchObject({kind:'mayor-consultation'})
    for(const p of s.players)expect(JSON.stringify(s.view(p))).not.toContain('mayor-consultation')
  })
  it('allows 12 guests plus mayor only in a configured mayor room; ordinary rooms stay capped at 12 members', () => {
    const special = room(11); special.setup()
    const twelfth = special.join()
    expect(twelfth).toHaveProperty('player')
    special.start()
    expect((special.view(special.mayor).gamePublicState?.data as CidadeDormeLanPublic).totalPlayers).toBe(12)
    expect(special.join()).toHaveProperty('error', 'room_full')
    const normal = room(11)
    expect(normal.join()).toHaveProperty('error', 'room_full')
  })
})
