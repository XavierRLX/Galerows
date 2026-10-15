import { describe, expect, it } from 'vitest'
import { cidadeDormeLanGame, type CidadeDormeLanPublic, type CidadeDormeLanPrivate } from './cidadeDormeLanGame'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'

const config={enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,
  conductionMode:'automatic' as const,killersCount:1}
function session(overrides:Partial<typeof config>={}){
  let time=1700000000000, next=0
  const runtime=new AuthoritativeRoomRuntimeV2({roomId:'night-stage',hostPlayerId:'host',hostConnectionId:'conn-host',
    adapter:new RoomLifecycleAdapter([cidadeDormeLanGame]),createPlayerId:()=>`g${++next}`,
    clock:{now:()=>time},random:()=>.99999})
  const players=[{id:'host',connection:'conn-host'}]
  for(let i=0;i<4;i++){
    const c='conn-'+i, joined=runtime.joinGuest(c)
    if(!joined.ok)throw Error(joined.error)
    players.push({id:joined.playerId,connection:c})
  }
  const snapshot=(p=players[0])=>{
    const x=runtime.snapshotFor(p.id,p.connection);if(!x.ok)throw Error(x.error);return x.snapshot
  }
  const send=(p:typeof players[number],type:string,payload:unknown=null,scope:'game'|'room'='game')=>{
    const s=snapshot(p)
    return runtime.processCommand({protocolVersion:2,roomId:'night-stage',scope,playerId:p.id,
      commandId:crypto.randomUUID(),clientSeq:s.nextClientSeq,type,payload,
      ...(scope==='game'?{gameSessionId:s.roomState.currentGameSessionId!}:{})},p.connection).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'game'|'room'='game')=>{
    const r=send(p,type,payload,scope);expect(r.status,JSON.stringify(r)).toBe('accepted')}
  const advance=(ms:number)=>{time+=ms}
  const pub=()=>snapshot().gamePublicState?.data as CidadeDormeLanPublic
  const priv=(p:typeof players[number])=>snapshot(p).privateState?.data as CidadeDormeLanPrivate
  const role=(name:string)=>players.find(p=>priv(p)?.role===name)!
  const start=()=>{
    ok(players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    ok(players[0],'CONFIGURE_GAME',{...config,...overrides},'room')
    players.forEach(p=>ok(p,'READY',{ready:true},'room'))
    ok(players[0],'START_GAME',null,'room')
  }
  return {players,send,ok,advance,pub,priv,role,start,snapshot}
}
describe('CITY-ORCHESTRATION-01 — authoritative phase events',()=>{
  it('timestamps phase creation and advances exactly once per real phase transition',()=>{
    const s=session();s.start()
    const reveal=s.pub()
    expect(reveal).toMatchObject({step:'reveal',phaseRevision:1,phaseStartedAt:1700000000000})
    expect(reveal.phaseEventId).toMatch(/reveal/)
    s.advance(2000)
    s.players.forEach(p=>s.ok(p,'ACK_ROLE'))
    expect(s.pub().phaseEventId).toBe(reveal.phaseEventId)
    expect(s.pub().phaseStartedAt).toBe(reveal.phaseStartedAt)
    s.advance(3000);s.ok(s.players[0],'START_NIGHT')
    const night=s.pub()
    expect(night).toMatchObject({step:'killer-turn',phaseRevision:2,phaseStartedAt:1700000005000})
    expect(night.phaseEventId).not.toBe(reveal.phaseEventId)
    expect(s.send(s.players[1],'START_NIGHT').error).toBe('unauthorized')
    expect(s.pub().phaseEventId).toBe(night.phaseEventId)
    expect(s.snapshot(s.players[3]).gamePublicState?.data).toMatchObject({
      phaseEventId:night.phaseEventId,phaseRevision:night.phaseRevision,phaseStartedAt:night.phaseStartedAt,
    })
  })
  it('moves through all authorized night roles with phase markers and no secret public data',()=>{
    const s=session();s.start()
    s.players.forEach(p=>s.ok(p,'ACK_ROLE'));s.ok(s.players[0],'START_NIGHT')
    const steps=['killer-turn']
    const killer=s.role('killer'),doctor=s.role('doctor'),detective=s.role('detective')
    const citizen=s.role('citizen')
    let lastRevision=s.pub().phaseRevision
    for(const [p,type,target] of [[killer,'KILL',citizen.id],[doctor,'PROTECT',citizen.id],
      [detective,'INVESTIGATE',killer.id]] as const){
      s.advance(1500);s.ok(p,type,{playerId:target})
      const next=s.pub()
      steps.push(next.step)
      expect(next.phaseRevision).toBe(++lastRevision)
      expect(next.phaseStartedAt).toBeGreaterThan(1700000000000)
      expect(JSON.stringify(next)).not.toContain('"murderOrder"')
      expect(JSON.stringify(next)).not.toContain('"killerTarget"')
    }
    expect(steps).toEqual(['killer-turn','doctor-turn','detective-turn','morning'])
    s.advance(1800);s.ok(s.players[0],'START_DISCUSSION')
    expect(s.pub().phaseRevision).toBe(++lastRevision)
    s.ok(s.players[0],'START_VOTE')
    const voting=s.pub();expect(voting.phaseRevision).toBe(lastRevision+1)
    s.ok(s.players[1],'CAST_VOTE',{playerId:killer.id})
    expect(s.pub().phaseRevision).toBe(voting.phaseRevision)
    expect(s.pub().phaseEventId).toBe(voting.phaseEventId)
  })
  it('preserves same canonical event after reconnect and does not replay outdated phase',()=>{
    const s=session();s.start()
    const rolePhase=s.pub()
    const r=s.snapshot(s.players[2])
    expect(r.gamePublicState?.data).toMatchObject({phaseEventId:rolePhase.phaseEventId})
    s.players.forEach(p=>s.ok(p,'ACK_ROLE'));s.ok(s.players[0],'START_NIGHT')
    const now=s.pub()
    const reread=s.snapshot(s.players[2])
    expect(reread.gamePublicState?.data).toMatchObject({phaseEventId:now.phaseEventId})
    expect(now.phaseEventId).not.toBe(rolePhase.phaseEventId)
    expect(now.phaseRevision).toBeGreaterThan(rolePhase.phaseRevision)
  })
  it('skips disabled night actors without fabricating extra events or announcing private targets',()=>{
    const s=session({enableDoctor:false,enableDetective:false});s.start()
    s.players.forEach(p=>s.ok(p,'ACK_ROLE'));s.ok(s.players[0],'START_NIGHT')
    const step=s.pub()
    expect(step.step).toBe('killer-turn')
    const killer=s.role('killer')
    const citizen=s.role('citizen')
    s.advance(900)
    s.ok(killer,'KILL',{playerId:citizen.id})
    expect(s.pub()).toMatchObject({step:'morning',phaseRevision:step.phaseRevision+1,
      phaseStartedAt:1700000000900})
    expect(s.pub().phaseEventId).toContain('morning')
    expect(JSON.stringify(s.pub())).not.toContain('killerTarget')
  })
  it('pausing and resuming never re-announces the phase, even as Room state changes',()=>{
    const s=session()
    s.ok(s.players[0],'SELECT_GAME',{gameId:'cidade-dorme'},'room')
    s.ok(s.players[0],'CONFIGURE_GAME',{...config,conductionMode:'mayor'},'room')
    s.players.slice(1).forEach(p=>s.ok(p,'READY',{ready:true},'room'))
    s.ok(s.players[0],'START_GAME',null,'room')
    const original=s.pub()
    s.advance(2500);s.ok(s.players[0],'PAUSE_CITY')
    expect(s.pub()).toMatchObject({phaseEventId:original.phaseEventId,phaseStartedAt:original.phaseStartedAt,paused:true})
    s.advance(1500);s.ok(s.players[0],'RESUME_CITY')
    expect(s.pub()).toMatchObject({phaseEventId:original.phaseEventId,phaseStartedAt:original.phaseStartedAt,paused:false})
  })
})
