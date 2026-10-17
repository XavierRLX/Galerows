import { describe, expect, it } from 'vitest'
import { cidadeDormeLanGame, type CidadeDormeLanPublic, type CidadeDormeLanPrivate } from './cidadeDormeLanGame'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { createDefaultCidadeDormeSettings } from '../cidade-dorme/cidadeDorme.setup'
const config={enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,
  conductionMode:'automatic' as const,killersCount:1}
function game(overrides:Record<string,unknown>={}){
  let now=1700000000000,n=0
  const runtime=new AuthoritativeRoomRuntimeV2({roomId:'auto',hostPlayerId:'host',hostConnectionId:'hc',
    adapter:new RoomLifecycleAdapter([cidadeDormeLanGame]),createPlayerId:()=>String(++n),
    random:()=>.999999,clock:{now:()=>now}})
  const players=[{id:'host',conn:'hc'}]
  for(let i=0;i<5;i++){const c='c'+i;const j=runtime.joinGuest(c);if(!j.ok)throw Error(j.error);players.push({id:j.playerId,conn:c})}
  const snapshot=(p=players[0])=>{const r=runtime.snapshotFor(p.id,p.conn);if(!r.ok)throw Error(r.error);return r.snapshot}
  const send=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const s=snapshot(p);return runtime.processCommand({protocolVersion:2,roomId:'auto',playerId:p.id,
      scope,commandId:crypto.randomUUID(),clientSeq:s.nextClientSeq,type,payload,
      ...(scope==='game'?{gameSessionId:s.roomState.currentGameSessionId!}:{})},p.conn).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const r=send(p,type,payload,scope);expect(r.status,JSON.stringify(r)).toBe('accepted');return r}
  const pub=()=>snapshot().gamePublicState?.data as CidadeDormeLanPublic
  const priv=(p:typeof players[number])=>snapshot(p).privateState?.data as CidadeDormeLanPrivate
  const role=(r:string)=>players.find(p=>priv(p).role===r)!
  const host=players[0]
  const advance=(ms:number)=>{now+=ms}
  const start=()=>{
    ok(host,'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    ok(host,'CONFIGURE_GAME',{...config,...overrides},'room')
    players.forEach(p=>ok(p,'READY',{ready:true},'room'))
    ok(host,'START_GAME',null,'room')
  }
  const unlock=()=>{advance(9000);ok(host,'OPEN_PHASE')}
  const night=()=>{players.forEach(p=>ok(p,'ACK_ROLE'));advance(7000);ok(host,'START_NIGHT');unlock()}
  return {runtime,players,snapshot,send,ok,pub,priv,role,host,advance,start,unlock,night}
}
describe('CITY-AUTOPILOT-01 server authority and narration barriers',()=>{
  it('requires host narration completion for killer, doctor, detective and voting actions',()=>{
    const s=game();s.start()
    s.players.forEach(p=>s.ok(p,'ACK_ROLE'))
    expect(s.send(s.host,'START_NIGHT').error).toBe('not_ready')
    s.advance(7000);s.ok(s.host,'START_NIGHT')
    const killer=s.role('killer'),citizen=s.role('citizen')
    expect(s.pub().phaseReady).toBe(false)
    expect(s.send(killer,'KILL',{playerId:citizen.id}).error).toBe('not_ready')
    expect(s.send(citizen,'OPEN_PHASE').error).toBe('unauthorized')
    expect(s.send(s.host,'OPEN_PHASE').error).toBe('not_ready')
    s.unlock()
    expect(s.pub().phaseReady).toBe(true)
    s.ok(killer,'KILL',{playerId:citizen.id})
    expect(s.pub().step).toBe('doctor-turn')
    expect(s.send(s.role('doctor'),'PROTECT',{playerId:citizen.id}).error).toBe('not_ready')
    s.unlock();s.ok(s.role('doctor'),'PROTECT',{playerId:citizen.id})
    expect(s.pub().step).toBe('detective-turn')
    expect(s.send(s.role('detective'),'INVESTIGATE',{playerId:killer.id}).error).toBe('not_ready')
  })
  it('shows detective the private verdict in a dedicated phase until acknowledged, never exposing it to others',()=>{
    const s=game();s.start();s.night()
    const killer=s.role('killer'),citizen=s.role('citizen'),doctor=s.role('doctor'),detective=s.role('detective')
    s.ok(killer,'KILL',{playerId:citizen.id});s.unlock()
    s.ok(doctor,'PROTECT',{playerId:citizen.id});s.unlock()
    s.ok(detective,'INVESTIGATE',{playerId:killer.id})
    expect(s.pub().step).toBe('detective-result')
    expect(s.priv(detective).investigation).toEqual({targetId:killer.id,result:'suspect'})
    expect(s.send(s.host,'ACK_INVESTIGATION').error).toBe('unauthorized')
    expect(s.send(detective,'ACK_INVESTIGATION').error).toBe('not_ready')
    for(const p of s.players.filter(p=>p.id!==detective.id))
      expect(JSON.stringify(s.snapshot(p))).not.toContain('"suspect"')
    s.advance(8500);expect(s.send(detective,'ACK_INVESTIGATION').error).toBe('not_ready')
    s.ok(s.host,'OPEN_PHASE');s.ok(detective,'ACK_INVESTIGATION')
    expect(s.pub().step).toBe('morning')
    expect(s.pub().nightResult?.eliminatedId).toBeNull()
  })
  it('announces death or survival publicly while preserving private attempts until final game history',()=>{
    const s=game();s.start();s.night()
    const killer=s.role('killer'),citizen=s.role('citizen'),doctor=s.role('doctor'),detective=s.role('detective')
    s.ok(killer,'KILL',{playerId:citizen.id});s.unlock()
    s.ok(doctor,'PROTECT',{playerId:citizen.id});s.unlock()
    s.ok(detective,'INVESTIGATE',{playerId:killer.id});s.advance(8500);expect(s.send(detective,'ACK_INVESTIGATION').error).toBe('not_ready')
    s.ok(s.host,'OPEN_PHASE');s.ok(detective,'ACK_INVESTIGATION')
    expect(s.pub().nightResult?.eliminatedId).toBeNull()
    expect(s.pub().history).toBeNull()
    expect(JSON.stringify(s.pub())).not.toContain('"killerTargetId"')
    s.advance(9000);s.ok(s.host,'START_DISCUSSION')
    s.advance(37000);s.ok(s.host,'START_VOTE')
    s.unlock()
    const alive=s.players.filter(p=>s.pub().players.some(x=>x.id===p.id&&x.alive))
    alive.forEach((p,i)=>s.ok(p,'CAST_VOTE',{playerId:alive[i%2].id}))
    s.advance(8000);s.ok(s.host,'RESOLVE_VOTE')
    expect(s.pub().voteResult?.kind).toBe('tie')
    s.advance(9500);s.ok(s.host,'NEXT_NIGHT')
    expect(s.pub().round).toBe(2)
  })
  it('does not allow host to skip public morning or vote result when a winner is decided',()=>{
    const s=game({enableDoctor:false,enableDetective:false});s.start();s.night()
    const killer=s.role('killer')
    s.ok(killer,'KILL',{playerId:s.role('citizen').id})
    expect(s.pub().step).toBe('morning')
    expect(s.pub().nightResult?.eliminatedId).not.toBeNull()
    s.advance(9000);s.ok(s.host,'START_DISCUSSION')
    s.advance(37000);s.ok(s.host,'START_VOTE');s.unlock()
    s.players.filter(p=>s.pub().players.some(x=>x.id===p.id&&x.alive))
      .forEach(p=>s.ok(p,'CAST_VOTE',{playerId:killer.id}))
    s.advance(8000);s.ok(s.host,'RESOLVE_VOTE')
    expect(s.pub().step).toBe('vote-result')
    s.advance(9500);s.ok(s.host,'NEXT_NIGHT')
    expect(s.pub().step).toBe('summary')
    expect(s.pub().history).toEqual(expect.arrayContaining([expect.objectContaining({
      round:1,night:expect.objectContaining({killerTargetId:expect.any(String),
        doctorTargetId:null,savedByDoctor:false}),
      vote:expect.objectContaining({kind:'eliminated',votes:expect.any(Array)})
    })]))
    const recap=JSON.stringify(s.pub().history)
    expect(recap).toContain(killer.id)
  })
  it('keeps the game winner confidential until the narrated conclusion screen',()=>{
    const s=game({enableDoctor:false,enableDetective:false});s.start();s.night()
    const killer=s.role('killer')
    s.ok(killer,'KILL',{playerId:s.role('citizen').id})
    s.advance(9000);s.ok(s.host,'START_DISCUSSION')
    s.advance(37000);s.ok(s.host,'START_VOTE');s.unlock()
    s.players.filter(p=>s.pub().players.some(x=>x.id===p.id&&x.alive))
      .forEach(p=>s.ok(p,'CAST_VOTE',{playerId:killer.id}))
    s.advance(8000);s.ok(s.host,'RESOLVE_VOTE')
    expect(s.pub().step).toBe('vote-result')
    expect(s.pub().winner).toBeNull()
    expect(s.pub().history).toBeNull()
    s.advance(9500);s.ok(s.host,'NEXT_NIGHT')
    expect(s.pub().step).toBe('summary')
    expect(s.pub().winner).toBe('city')
  })
  it('requires explicit configuration to protect the same person in consecutive nights',()=>{
    const v=cidadeDormeLanGame.validateConfig({...config,doctorCanRepeatProtection:true})
    expect(v.ok).toBe(true)
    const defaults=createDefaultCidadeDormeSettings(6)
    expect(defaults.doctorCanRepeatProtection).toBe(false)
  })

  it('keeps the doctor turn after that role is eliminated, but never permits fictitious protection',()=>{
    const s=game();s.start();s.night()
    const killer=s.role('killer'),doctor=s.role('doctor'),detective=s.role('detective')
    const citizen=s.role('citizen')
    s.ok(killer,'KILL',{playerId:doctor.id})
    s.unlock()
    // A live role is not simulated even if the host calls the generic recovery command.
    s.advance(6000)
    const pending=s.pub().phaseEventId
    expect(s.send(s.host,'SIMULATE_NIGHT_ROLE').status).toBe('accepted')
    expect(s.pub().phaseEventId).toBe(pending)
    s.ok(doctor,'PROTECT',{playerId:citizen.id})
    s.unlock();s.ok(detective,'INVESTIGATE',{playerId:killer.id})
    s.advance(9000);s.ok(s.host,'OPEN_PHASE');s.ok(detective,'ACK_INVESTIGATION')
    expect(s.pub().nightResult?.eliminatedId).toBe(doctor.id)
    s.advance(9000);s.ok(s.host,'START_DISCUSSION')
    s.advance(37000);s.ok(s.host,'START_VOTE');s.unlock()
    const voters=s.players.filter(p=>s.pub().players.some(x=>x.id===p.id&&x.alive))
    voters.forEach((p,i)=>s.ok(p,'CAST_VOTE',{playerId:voters[i%3].id}))
    s.advance(8000);s.ok(s.host,'RESOLVE_VOTE')
    expect(s.pub().voteResult?.kind).toBe('tie')
    s.advance(9500);s.ok(s.host,'NEXT_NIGHT')
    expect(s.pub().round).toBe(2)
    s.unlock()
    s.ok(killer,'KILL',{playerId:citizen.id})
    expect(s.pub().step).toBe('doctor-turn')
    const before=s.pub()
    expect(before.phaseReady).toBe(false)
    expect(before.players.find(p=>p.id===doctor.id)?.revealedRole).toBeUndefined()
    expect(s.send(doctor,'PROTECT',{playerId:citizen.id}).error).toBe('not_ready')
    expect(s.send(s.host,'SIMULATE_NIGHT_ROLE').error).toBe('not_ready')
    s.unlock()
    expect(s.send(doctor,'PROTECT',{playerId:citizen.id}).error).toBe('unauthorized')
    expect(s.send(citizen,'SIMULATE_NIGHT_ROLE').error).toBe('unauthorized')
    expect(s.send(s.host,'SIMULATE_NIGHT_ROLE',{playerId:citizen.id}).error).toBe('invalid_payload')
    expect(s.send(s.host,'SIMULATE_NIGHT_ROLE').error).toBe('not_ready')
    s.advance(5500)
    s.ok(s.host,'SIMULATE_NIGHT_ROLE')
    expect(s.pub().step).toBe('detective-turn')
    expect(s.pub().history).toBeNull()
    expect(JSON.stringify(s.pub())).not.toContain('protectedTarget')
    expect(JSON.stringify(s.snapshot(citizen))).not.toContain('roleKey')
  })
  it('keeps BOTH detective phases after elimination without producing a fabricated investigation',()=>{
    const s=game({doctorCanRepeatProtection:true});s.start();s.night()
    const killer=s.role('killer'),doctor=s.role('doctor'),detective=s.role('detective')
    const citizen=s.role('citizen')
    s.ok(killer,'KILL',{playerId:detective.id})
    s.unlock();s.ok(doctor,'PROTECT',{playerId:citizen.id})
    s.unlock();s.ok(detective,'INVESTIGATE',{playerId:killer.id})
    s.advance(9000);s.ok(s.host,'OPEN_PHASE');s.ok(detective,'ACK_INVESTIGATION')
    expect(s.pub().nightResult?.eliminatedId).toBe(detective.id)
    s.advance(9000);s.ok(s.host,'START_DISCUSSION')
    s.advance(37000);s.ok(s.host,'START_VOTE');s.unlock()
    const voters=s.players.filter(p=>s.pub().players.some(x=>x.id===p.id&&x.alive))
    voters.forEach((p,i)=>s.ok(p,'CAST_VOTE',{playerId:voters[i%3].id}))
    s.advance(8000);s.ok(s.host,'RESOLVE_VOTE');s.advance(9500);s.ok(s.host,'NEXT_NIGHT')
    s.unlock();s.ok(killer,'KILL',{playerId:citizen.id})
    s.unlock();s.ok(doctor,'PROTECT',{playerId:citizen.id})
    expect(s.pub().step).toBe('detective-turn')
    expect(s.priv(detective).canAct).toBe(false)
    s.unlock()
    s.advance(5500);s.ok(s.host,'SIMULATE_NIGHT_ROLE')
    expect(s.pub().step).toBe('detective-result')
    expect(s.priv(detective).investigation).toBeUndefined()
    for(const player of s.players){
      const x=s.snapshot(player)
      expect(JSON.stringify(x)).not.toContain('"suspect"')
      expect(JSON.stringify(x)).not.toContain('"detectiveTarget"')
    }
    s.unlock();s.advance(5500)
    s.ok(s.host,'SIMULATE_NIGHT_ROLE')
    expect(s.pub().step).toBe('morning')
    // The still-living doctor protected this citizen; simulated investigation
    // must not alter the real, server-authoritative night outcome.
    expect(s.pub().nightResult?.eliminatedId).toBeNull()
  })

})
