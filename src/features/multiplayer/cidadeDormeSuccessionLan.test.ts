import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { cidadeDormeLanGame } from './cidadeDormeLanGame'
import type { CidadeDormeLanPublic, CidadeDormeLanPrivate } from './cidadeDormeLanGame'
const defaults={enableDoctor:false,enableDetective:false,enableJester:false,revealRoleOnDeath:false}
function room(n=12,config=defaults){
  let id=0
  const runtime=new AuthoritativeRoomRuntimeV2({roomId:'CITY-TEST',hostPlayerId:'host',hostConnectionId:'conn-host',
    adapter:new RoomLifecycleAdapter([cidadeDormeLanGame]),createPlayerId:()=> 'guest-'+(++id),
    random:()=>.99999,clock:{now:()=>100}})
  const players=[{id:'host',conn:'conn-host'}]
  for(let i=1;i<n;i++){const conn='conn-'+i,j=runtime.joinGuest(conn);if(!j.ok)throw Error(j.error);players.push({id:j.playerId,conn})}
  const view=(p=players[0])=>{const s=runtime.snapshotFor(p.id,p.conn);if(!s.ok)throw Error(s.error);return s.snapshot}
  const send=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const snapshot=view(p)
    return runtime.processCommand({protocolVersion:2,roomId:'CITY-TEST',scope,playerId:p.id,clientSeq:snapshot.nextClientSeq,
      commandId:crypto.randomUUID(),type,payload,...(scope==='game'?{gameSessionId:snapshot.roomState.currentGameSessionId!}:{})},p.conn).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{const r=send(p,type,payload,scope);expect(r.status,JSON.stringify(r)).toBe('accepted')}
  const pub=()=>view().gamePublicState?.data as CidadeDormeLanPublic
  const priv=(p:typeof players[number])=>view(p).privateState?.data as CidadeDormeLanPrivate
  const start=()=>{
    ok(players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    ok(players[0],'CONFIGURE_GAME',config,'room')
    players.forEach(p=>ok(p,'READY',{ready:true},'room'))
    ok(players[0],'START_GAME',null,'room')
  }
  const night=()=>{players.forEach(p=>ok(p,'ACK_ROLE'));ok(players[0],'START_NIGHT')}
  const vote=(id:string)=>{
    ok(players[0],'START_DISCUSSION')
    ok(players[0],'START_VOTE')
    players.filter(p=>pub().players.some(member=>member.id===p.id&&member.alive)).forEach(p=>ok(p,'CAST_VOTE',{playerId:id}))
    ok(players[0],'RESOLVE_VOTE')
  }
  return {players,view,send,ok,pub,priv,start,night,vote}
}
describe('Cidade Dorme multiplayer — real traitor succession and secret projections',()=>{
  it('reveals the entire killer team and the fixed succession order only to team members',()=>{
    const r=room();r.start()
    const team=r.players.filter(p=>['killer','traitor'].includes(r.priv(p).role))
    const strangers=r.players.filter(p=>!team.includes(p))
    expect(team.map(p=>r.priv(p).role)).toEqual(['killer','traitor','traitor'])
    for(const p of team){
      expect(r.priv(p).killerTeammates).toHaveLength(2)
      expect(r.priv(p).successionOrder).toEqual(team.map(q=>q.id))
    }
    for(const p of strangers){
      expect(r.priv(p).killerTeammates).toBeUndefined()
      expect(r.priv(p).successionOrder).toBeUndefined()
      expect(JSON.stringify(r.view(p))).not.toContain('"successionOrder"')
    }
    expect(JSON.stringify(r.pub())).not.toContain('successionOrder')
  })
  it('rejects dormant traitors and friendly fire and transfers KILL only to next living traitor after voting',()=>{
    const r=room();r.start()
    const killer=r.players.find(p=>r.priv(p).role==='killer')!
    const traitors=r.players.filter(p=>r.priv(p).role==='traitor')
    const civilians=r.players.filter(p=>r.priv(p).role==='citizen')
    r.night()
    expect(r.send(traitors[0],'KILL',{playerId:civilians[0].id}).error).toBe('unauthorized')
    expect(r.send(killer,'KILL',{playerId:traitors[0].id}).error).toBe('invalid_payload')
    r.ok(killer,'KILL',{playerId:civilians[0].id})
    r.vote(killer.id)
    expect(r.pub().winner).toBeNull()
    r.ok(r.players[0],'NEXT_NIGHT')
    expect(r.send(traitors[1],'KILL',{playerId:civilians[1].id}).error).toBe('unauthorized')
    expect(r.send(killer,'KILL',{playerId:civilians[1].id}).error).toBe('unauthorized')
    r.ok(traitors[0],'KILL',{playerId:civilians[1].id})
    r.vote(traitors[0].id)
    r.ok(r.players[0],'NEXT_NIGHT')
    r.ok(traitors[1],'KILL',{playerId:civilians[2].id})
    expect(r.pub().step).toBe('morning')
  })
  it('only the active successor returns suspect to detective; inactive second remains innocent',()=>{
    const r=room(12,{...defaults,enableDetective:true});r.start()
    const killer=r.players.find(p=>r.priv(p).role==='killer')!
    const traitors=r.players.filter(p=>r.priv(p).role==='traitor')
    const detective=r.players.find(p=>r.priv(p).role==='detective')!
    const civilians=r.players.filter(p=>r.priv(p).role==='citizen')
    r.night()
    r.ok(killer,'KILL',{playerId:civilians[0].id})
    r.ok(detective,'INVESTIGATE',{playerId:traitors[0].id})
    expect(r.priv(detective).investigation?.result).toBe('innocent')
    r.vote(killer.id)
    r.ok(r.players[0],'NEXT_NIGHT')
    r.ok(traitors[0],'KILL',{playerId:civilians[1].id})
    r.ok(detective,'INVESTIGATE',{playerId:traitors[0].id})
    expect(r.priv(detective).investigation?.result).toBe('suspect')
    r.vote(traitors[0].id)
    r.ok(r.players[0],'NEXT_NIGHT')
    r.ok(traitors[1],'KILL',{playerId:civilians[2].id})
    r.ok(detective,'INVESTIGATE',{playerId:traitors[1].id})
    expect(r.priv(detective).investigation?.result).toBe('suspect')
  })
})
