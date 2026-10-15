import { describe, expect, it } from 'vitest'
import { cidadeDormeLanGame, type CidadeDormeLanPrivate, type CidadeDormeLanPublic } from './cidadeDormeLanGame'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { createDefaultCidadeDormeSettings } from '../cidade-dorme/cidadeDorme.setup'

const legacy={enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false}
const full={...legacy,killersCount:2,doctorCanSelfProtect:true,
  doctorSelfProtectLimit:2 as const,doctorCanRepeatProtection:true,conductionMode:'automatic' as const}
function room(count=6,config:Record<string,unknown>=full) {
  let counter=0
  const runtime=new AuthoritativeRoomRuntimeV2({roomId:'city-settings',hostPlayerId:'host',hostConnectionId:'host-conn',
    adapter:new RoomLifecycleAdapter([cidadeDormeLanGame]),createPlayerId:()=>`g${++counter}`,
    random:()=>.99999,clock:{now:()=>1000}})
  const players=[{id:'host',conn:'host-conn'}]
  for(let i=1;i<count;i++){
    const c='c'+i
    const result=runtime.joinGuest(c)
    if(!result.ok)throw Error(result.error)
    players.push({id:result.playerId,conn:c})
  }
  const snap=(p=players[0])=>{const x=runtime.snapshotFor(p.id,p.conn);if(!x.ok)throw Error(x.error);return x.snapshot}
  const send=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const s=snap(p)
    return runtime.processCommand({protocolVersion:2,scope,roomId:s.roomId,playerId:p.id,
      clientSeq:s.nextClientSeq,commandId:crypto.randomUUID(),type,payload,
      ...(scope==='game'?{gameSessionId:s.roomState.currentGameSessionId!}:{})},p.conn).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='game')=>{
    const x=send(p,type,payload,scope)
    expect(x.status,JSON.stringify(x)).toBe('accepted')
  }
  const pub=()=>snap().gamePublicState?.data as CidadeDormeLanPublic
  const priv=(p:typeof players[number])=>snap(p).privateState?.data as CidadeDormeLanPrivate
  const role=(name:string)=>players.find(p=>priv(p).role===name)!
  const begin=()=>{ok(players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    ok(players[0],'CONFIGURE_GAME',config,'room')
    players.forEach(p=>ok(p,'READY',{ready:true},'room'))
    ok(players[0],'START_GAME',null,'room')}
  const night=()=>{players.forEach(p=>ok(p,'ACK_ROLE'));ok(players[0],'START_NIGHT')}
  const tieVote=()=>{ok(players[0],'START_DISCUSSION');ok(players[0],'START_VOTE')
    players.filter(p=>pub().players.some(x=>x.id===p.id&&x.alive)).forEach(p=>ok(p,'CAST_VOTE',{playerId:p.id}))
    ok(players[0],'RESOLVE_VOTE')
    expect(pub().step).toBe('vote-result');ok(players[0],'NEXT_NIGHT')}
  return {players,snap,send,ok,pub,priv,role,begin,night,tieVote}
}

describe('CITY-SETTINGS-01 — shared one-cell rules in persistent LAN',()=>{
  it('accepts configurable killer count and doctor rules and rejects malformed values',()=>{
    expect(cidadeDormeLanGame.validateConfig(full)).toMatchObject({ok:true,config:full})
    for(const invalid of [
      {...full,killersCount:0},{...full,killersCount:4},{...full,killersCount:1.5},
      {...full,doctorSelfProtectLimit:0},{...full,doctorSelfProtectLimit:4},
      {...full,doctorSelfProtectLimit:'always'},
      {...full,doctorCanSelfProtect:'true'},{...full,doctorCanRepeatProtection:1},
      {...full,extra:'bad'},
    ])expect(cidadeDormeLanGame.validateConfig(invalid).ok).toBe(false)
    expect(cidadeDormeLanGame.validateConfig({...full,doctorSelfProtectLimit:'unlimited'}).ok).toBe(true)
  })
  it('legacy configuration remains accepted with same recommended defaults for each player count',()=>{
    const old=cidadeDormeLanGame.validateConfig(legacy)
    expect(old.ok).toBe(true)
    for(const count of [4,8,12]){
      const c=old.ok?old.config:legacy
      const state=cidadeDormeLanGame.createInitialState(c,Array.from({length:count},(_,i)=>'p'+i),
        {random:()=>.999999,clock:{now:()=>1}})
      const types=Array.from({length:count},(_,i)=>cidadeDormeLanGame.projectPrivate(state,'p'+i) as CidadeDormeLanPrivate)
      expect(types.filter(p=>p.role==='killer'||p.role==='traitor')).toHaveLength(createDefaultCidadeDormeSettings(count).killersCount)
    }
  })
  it('uses an explicit chosen team size rather than the automatically recommended number',()=>{
    const s=room(8,{...full,killersCount:1});s.begin()
    expect(s.players.map(p=>s.priv(p).role).filter(r=>r==='killer'||r==='traitor')).toHaveLength(1)
    const other=room(6,full);other.begin()
    expect(other.players.map(p=>other.priv(p).role).filter(r=>r==='killer'||r==='traitor')).toHaveLength(2)
  })
  it('rejects incompatible role composition before game creation without corrupting the Room',()=>{
    const config={...full,killersCount:3,enableDoctor:true,enableDetective:true,enableJester:true}
    const s=room(4,config)
    s.ok(s.players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    s.ok(s.players[0],'CONFIGURE_GAME',config,'room')
    s.players.forEach(p=>s.ok(p,'READY',{ready:true},'room'))
    expect(s.send(s.players[0],'START_GAME',null,'room').error).toBe('invalid_config')
    expect(s.snap().roomState.currentGameSessionId).toBeNull()
    expect(s.snap().roomState.phase).toBe('configuring')
  })
  it('allows two consecutive doctor self protections, then refuses a third based on the configured limit',()=>{
    const s=room(6,full);s.begin();s.night()
    const killer=s.role('killer'),doctor=s.role('doctor')
    s.ok(killer,'KILL',{playerId:doctor.id})
    expect(s.priv(doctor).doctorEligibleTargetIds).toContain(doctor.id)
    expect(s.priv(killer).doctorEligibleTargetIds).toBeUndefined()
    expect(JSON.stringify(s.pub())).not.toContain('doctorEligibleTargetIds')
    s.ok(doctor,'PROTECT',{playerId:doctor.id})
    s.ok(s.role('detective'),'INVESTIGATE',{playerId:killer.id})
    expect(s.pub().nightResult?.eliminatedId).toBeNull()
    s.tieVote()
    s.ok(killer,'KILL',{playerId:doctor.id})
    s.ok(doctor,'PROTECT',{playerId:doctor.id})
    s.ok(s.role('detective'),'INVESTIGATE',{playerId:killer.id})
    s.tieVote()
    s.ok(killer,'KILL',{playerId:doctor.id})
    expect(s.priv(doctor).doctorEligibleTargetIds).not.toContain(doctor.id)
    expect(s.send(doctor,'PROTECT',{playerId:doctor.id}).error).toBe('invalid_payload')
  })
  it('refuses consecutive protection of the same person when disabled, but permits protecting another',()=>{
    const cfg={...full,doctorCanRepeatProtection:false,doctorCanSelfProtect:false}
    const s=room(6,cfg);s.begin();s.night()
    const killer=s.role('killer'),doctor=s.role('doctor'),victim=s.role('citizen')
    s.ok(killer,'KILL',{playerId:victim.id})
    s.ok(doctor,'PROTECT',{playerId:victim.id})
    s.ok(s.role('detective'),'INVESTIGATE',{playerId:killer.id})
    s.tieVote()
    s.ok(killer,'KILL',{playerId:victim.id})
    expect(s.priv(doctor).doctorEligibleTargetIds).not.toContain(victim.id)
    expect(s.send(doctor,'PROTECT',{playerId:victim.id}).error).toBe('invalid_payload')
    expect(s.send(doctor,'PROTECT',{playerId:doctor.id}).error).toBe('invalid_payload')
    const newTarget=s.players.find(p=>p.id!==victim.id&&p.id!==doctor.id&&p.id!==killer.id)!
    s.ok(doctor,'PROTECT',{playerId:newTarget.id})
  })
})
