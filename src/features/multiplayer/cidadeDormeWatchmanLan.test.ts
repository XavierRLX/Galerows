import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { cidadeDormeLanGame, type CidadeDormeLanConfig, type CidadeDormeLanPrivate, type CidadeDormeLanPublic } from './cidadeDormeLanGame'

function createRoom(count=8, configOverrides: Partial<CidadeDormeLanConfig>={}) {
  let seq = 0
  let now = 100000
  const clock = { now: () => now }
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId:'city-watch', hostPlayerId:'host', hostConnectionId:'host-conn',
    adapter:new RoomLifecycleAdapter([cidadeDormeLanGame]),
    createPlayerId:()=> 'guest-'+(++seq), random:()=>0.999999, clock,
  })
  const players=[{id:'host',conn:'host-conn'}]
  for(let n=1;n<count;n++){
    const conn='conn-'+n;const j=runtime.joinGuest(conn)
    if(!j.ok) throw Error(j.error)
    players.push({id:j.playerId,conn})
  }
  const view=(p=players[0])=>{
    const result=runtime.snapshotFor(p.id,p.conn)
    if(!result.ok)throw Error(result.error)
    return result.snapshot
  }
  const send=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const s=view(p)
    return runtime.processCommand({protocolVersion:2,scope,roomId:'city-watch',playerId:p.id,
      clientSeq:s.nextClientSeq,commandId:crypto.randomUUID(),type,payload,
      ...(scope==='game'?{gameSessionId:s.roomState.currentGameSessionId!}:{})},p.conn).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const r=send(p,type,payload,scope)
    expect(r.status,JSON.stringify(r)).toBe('accepted')
  }
  const pub=()=>view().gamePublicState!.data as CidadeDormeLanPublic
  const priv=(p:typeof players[number])=>view(p).privateState!.data as CidadeDormeLanPrivate
  const role=(r:CidadeDormeLanPrivate['role'])=>players.find(p=>priv(p).role===r)!
  const start=()=>{
    ok(players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    ok(players[0],'CONFIGURE_GAME',{
      enableDoctor:true,enableDetective:true,enableJester:false,
      enableWatchman:true,enableSleepwalker:true,jesterCount:0,
      killersCount:count>=11?3:2,revealRoleOnDeath:false,...configOverrides,
    },'room')
    players.forEach(p=>ok(p,'READY',{ready:true},'room'))
    ok(players[0],'START_GAME',null,'room')
    players.forEach(p=>ok(p,'ACK_ROLE'))
    ok(players[0],'START_NIGHT')
  }
  const advance = (milliseconds:number) => { now += milliseconds }
  return {players,view,send,ok,pub,priv,role,start,advance}
}

describe('CITY-EXPANDED LAN private watchman turn',()=>{
  it('runs watchman after detective and keeps target and movement strictly private',()=>{
    const r=createRoom();r.start()
    const killer=r.role('killer'),doctor=r.role('doctor'),detective=r.role('detective'),watchman=r.role('watchman'),sleepwalker=r.role('sleepwalker')
    const citizen=r.role('citizen')
    expect(r.send(watchman,'WATCH',{playerId:sleepwalker.id}).error).toBe('invalid_phase')
    r.ok(killer,'KILL',{playerId:citizen.id})
    r.ok(doctor,'PROTECT',{playerId:citizen.id})
    r.ok(detective,'INVESTIGATE',{playerId:killer.id})
    expect(r.pub().step).toBe('watchman-turn')
    expect(r.send(citizen,'WATCH',{playerId:sleepwalker.id}).error).toBe('unauthorized')
    r.ok(watchman,'WATCH',{playerId:sleepwalker.id})
    expect(r.pub().step).toBe('watchman-result')
    expect(r.priv(watchman).watchmanObservation).toEqual({targetId:sleepwalker.id,result:'passed'})
    expect(JSON.stringify(r.pub())).not.toContain(sleepwalker.id+'-watch')
    expect(JSON.stringify(r.view(citizen).privateState)).not.toContain('watchmanObservation')
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.pub().step).toBe('morning')
    expect(r.pub().nightResult?.eliminatedId).toBeNull()
  })
  it('inactive traitor stays inside and acts only after succession',()=>{
    const r=createRoom();r.start()
    const killer=r.role('killer'),doctor=r.role('doctor'),detective=r.role('detective'),watchman=r.role('watchman'),traitor=r.role('traitor')
    r.ok(killer,'KILL',{playerId:r.role('citizen').id})
    r.ok(doctor,'PROTECT',{playerId:r.role('citizen').id})
    r.ok(detective,'INVESTIGATE',{playerId:traitor.id})
    r.ok(watchman,'WATCH',{playerId:traitor.id})
    expect(r.priv(watchman).watchmanObservation?.result).toBe('stayed')
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.priv(detective).investigation?.result).toBe('innocent')
  })
  it('preserves the 7-player successor and changes both private investigations only after promotion',()=>{
    const r=createRoom(7);r.start()
    const killer=r.role('killer'),traitor=r.role('traitor'),doctor=r.role('doctor'),
      detective=r.role('detective'),watchman=r.role('watchman'),citizen=r.role('citizen')
    expect(r.priv(killer).successionOrder).toEqual([killer.id,traitor.id])
    expect(r.priv(traitor).successionOrder).toEqual([killer.id,traitor.id])
    expect(r.priv(citizen).successionOrder).toBeUndefined()
    r.ok(killer,'KILL',{playerId:citizen.id})
    r.ok(doctor,'PROTECT',{playerId:citizen.id})
    r.ok(detective,'INVESTIGATE',{playerId:traitor.id})
    r.ok(watchman,'WATCH',{playerId:traitor.id})
    expect(r.priv(watchman).watchmanObservation?.result).toBe('stayed')
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.priv(detective).investigation?.result).toBe('innocent')
    r.ok(r.players[0],'START_DISCUSSION')
    r.ok(r.players[0],'START_VOTE')
    r.players.forEach(p=>r.ok(p,'CAST_VOTE',{playerId:killer.id}))
    r.ok(r.players[0],'RESOLVE_VOTE')
    expect(r.pub().winner).toBeNull()
    r.ok(r.players[0],'NEXT_NIGHT')
    expect(r.priv(traitor).activeKiller).toBe(true)
    expect(r.send(killer,'KILL',{playerId:citizen.id}).error).toBe('unauthorized')
    r.ok(traitor,'KILL',{playerId:citizen.id})
    r.ok(doctor,'PROTECT',{playerId:doctor.id})
    r.ok(detective,'INVESTIGATE',{playerId:traitor.id})
    r.ok(watchman,'WATCH',{playerId:traitor.id})
    expect(r.priv(watchman).watchmanObservation?.result).toBe('passed')
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.priv(detective).investigation?.result).toBe('suspect')
    r.ok(r.players[0],'START_DISCUSSION')
    r.ok(r.players[0],'START_VOTE')
    r.players.filter(p=>r.pub().players.some(x=>x.id===p.id&&x.alive))
      .forEach(p=>r.ok(p,'CAST_VOTE',{playerId:traitor.id}))
    r.ok(r.players[0],'RESOLVE_VOTE')
    expect(r.pub()).toMatchObject({step:'summary',winner:'city'})
  })

  it('simulates a dead Vigia twice at 10 players without leaking an actual observation',()=>{
    const r=createRoom(10);r.start()
    const killer=r.role('killer'),doctor=r.role('doctor'),
      detective=r.role('detective'),watchman=r.role('watchman'),citizen=r.role('citizen')
    expect(r.players.filter(p=>r.priv(p).role==='traitor')).toHaveLength(1)
    r.ok(killer,'KILL',{playerId:watchman.id})
    r.ok(doctor,'PROTECT',{playerId:doctor.id})
    r.ok(detective,'INVESTIGATE',{playerId:killer.id})
    r.ok(watchman,'WATCH',{playerId:doctor.id})
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.pub().nightResult?.eliminatedId).toBe(watchman.id)
    r.ok(r.players[0],'START_DISCUSSION')
    r.ok(r.players[0],'START_VOTE')
    r.players.filter(p=>r.pub().players.some(x=>x.id===p.id&&x.alive))
      .forEach(p=>r.ok(p,'CAST_VOTE',{playerId:p.id}))
    r.ok(r.players[0],'RESOLVE_VOTE')
    expect(r.pub().voteResult?.kind).toBe('tie')
    r.ok(r.players[0],'NEXT_NIGHT')
    r.ok(killer,'KILL',{playerId:citizen.id})
    r.ok(doctor,'PROTECT',{playerId:citizen.id})
    r.ok(detective,'INVESTIGATE',{playerId:killer.id})
    expect(r.pub().step).toBe('watchman-turn')
    expect(r.send(watchman,'WATCH',{playerId:doctor.id}).error).toBe('unauthorized')
    r.advance(15000)
    r.ok(r.players[0],'SIMULATE_NIGHT_ROLE')
    expect(r.pub().step).toBe('watchman-result')
    r.advance(15000)
    r.ok(r.players[0],'SIMULATE_NIGHT_ROLE')
    expect(r.pub().step).toBe('morning')
    expect(r.priv(watchman).watchmanObservation).toBeUndefined()
    expect(JSON.stringify(r.pub())).not.toContain('watchmanTarget')
  })

  it('has two Coringas at 12; night death never wins and only the voted Coringa wins',()=>{
    const r=createRoom(12,{jesterCount:2,enableJester:true});r.start()
    expect(r.players.filter(p=>r.priv(p).role==='traitor')).toHaveLength(2)
    const jokers=r.players.filter(p=>r.priv(p).role==='jester')
    expect(jokers).toHaveLength(2)
    const killer=r.role('killer'),doctor=r.role('doctor'),detective=r.role('detective'),
      watchman=r.role('watchman')
    r.ok(killer,'KILL',{playerId:jokers[0].id})
    r.ok(doctor,'PROTECT',{playerId:doctor.id})
    r.ok(detective,'INVESTIGATE',{playerId:killer.id})
    r.ok(watchman,'WATCH',{playerId:jokers[1].id})
    r.ok(watchman,'ACK_WATCHMAN_RESULT')
    expect(r.pub().nightResult?.eliminatedId).toBe(jokers[0].id)
    expect(r.pub().winner).toBeNull()
    r.ok(r.players[0],'START_DISCUSSION')
    r.ok(r.players[0],'START_VOTE')
    r.players.filter(p=>r.pub().players.some(x=>x.id===p.id&&x.alive))
      .forEach(p=>r.ok(p,'CAST_VOTE',{playerId:jokers[1].id}))
    r.ok(r.players[0],'RESOLVE_VOTE')
    expect(r.pub()).toMatchObject({
      step:'summary',winner:'jester',winnerPlayerId:jokers[1].id,
      winReason:'jester-voted-out',
    })
    expect(r.pub().winnerPlayerId).not.toBe(jokers[0].id)
  })

})
