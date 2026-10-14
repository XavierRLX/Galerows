import { describe, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from './persistentRoom'
import { impostorLanGame } from './impostorLanGame'
import type { ImpostorLanPublic, ImpostorLanPrivate } from './impostorLanGame'
import type { RoomCommandV2 } from './persistentProtocol'

function room(guests=2) {
  let n=0
  const runtime=new AuthoritativeRoomRuntimeV2({
    roomId:'user-room', hostPlayerId:'host',hostConnectionId:'host-conn',
    createPlayerId:()=>`guest-${++n}`,adapter:new RoomLifecycleAdapter([impostorLanGame]),
    random:()=>0,clock:{now:()=>10000},
  })
  const players=[{id:'host',conn:'host-conn'}]
  for(let i=0;i<guests;i++){
    const conn=`conn-${i}`, result=runtime.joinGuest(conn)
    if(!result.ok)throw Error(result.error)
    players.push({id:result.playerId,conn})
  }
  const view=(p=players[0])=>{
    const result=runtime.snapshotFor(p.id,p.conn)
    if(!result.ok)throw Error(result.error)
    return result.snapshot
  }
  const send=(player:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='room')=>{
    const snap=view(player)
    const input:RoomCommandV2={roomId:'user-room',protocolVersion:2,
      scope,playerId:player.id,commandId:crypto.randomUUID(),clientSeq:snap.nextClientSeq,
      type,payload,...(scope==='game'?{gameSessionId:snap.roomState.currentGameSessionId!}:{})}
    return runtime.processCommand(input,player.conn).result
  }
  const ok=(p:typeof players[number],type:string,payload:unknown=null,scope:'room'|'game'='room')=>{
    const result=send(p,type,payload,scope)
    expect(result.status).toBe('accepted')
  }
  const pub=()=>view().gamePublicState!.data as ImpostorLanPublic
  const priv=(p:typeof players[number])=>view(p).privateState!.data as ImpostorLanPrivate
  const start=(extra:Record<string,unknown>={})=>{
    ok(players[0],'SELECT_GAME',{gameId:'impostor-da-palavra'})
    ok(players[0],'CONFIGURE_GAME',{impostorMode:'no-word',conversationMode:'guided-questions',
      flow:'individual-vote',timerSeconds:0,...extra})
    for(const p of players)ok(p,'READY',{ready:true})
    ok(players[0],'START_GAME')
  }
  const openVotes=()=>{
    for(const p of players)ok(p,'ACK_BRIEFING',null,'game')
    ok(players[0],'START_VOTING',null,'game')
  }
  return {runtime,players,view,send,ok,pub,priv,start,openVotes}
}

describe('approved lobby and impostor improvements',()=>{
  it('allows only the owner to change their persistent Room display name and updates score labels',()=>{
    const r=room()
    expect(r.send(r.players[1],'SET_DISPLAY_NAME',{playerId:'host',name:'Fraude'}).error).toBe('invalid_payload')
    expect(r.send(r.players[1],'SET_DISPLAY_NAME',{name:'   '}).error).toBe('invalid_payload')
    expect(r.send(r.players[1],'SET_DISPLAY_NAME',{name:'x'.repeat(41)}).error).toBe('invalid_payload')
    r.ok(r.players[0],'SET_DISPLAY_NAME',{name:'Renan'})
    r.ok(r.players[1],'SET_DISPLAY_NAME',{name:'Bia'})
    expect(r.view().roomState.members.map(m=>m.displayName)).toEqual(['Renan','Bia',undefined])
    expect(r.view().roomState.competition?.standings.map(s=>s.displayName).slice(0,2)).toEqual(['Renan','Bia'])
  })

  it('shares one guided question, lets only host change it, and permits starting-player redraw',()=>{
    const r=room()
    r.start()
    const a=r.players.map(p=>r.priv(p).question)
    expect(new Set(a).size).toBe(1)
    expect(r.pub().question).toBe(a[0])
    expect(r.send(r.players[1],'NEXT_QUESTION',null,'game').error).toBe('unauthorized')
    r.ok(r.players[0],'NEXT_QUESTION',null,'game')
    expect(r.pub().question).not.toBe(a[0])
    expect(r.players.every(p=>r.priv(p).question===r.pub().question)).toBe(true)
    expect(r.send(r.players[1],'DRAW_FIRST_SPEAKER',null,'game').error).toBe('unauthorized')
    r.ok(r.players[0],'DRAW_FIRST_SPEAKER',null,'game')
    expect(r.pub().firstSpeaker).toBeTruthy()
    r.openVotes()
    expect(r.send(r.players[0],'NEXT_QUESTION',null,'game').error).toBe('invalid_phase')
  })

  it('awards 2 to each correct voter with majority and replays directly with prior settings and scores',()=>{
    const r=room(3)
    r.start({scoringMode:'individual'})
    const imp=r.players.find(p=>r.priv(p).kind==='impostor')!
    r.openVotes()
    for(const p of r.players)r.ok(p,'VOTE',{playerId:p.id===imp.id?r.players[1].id:imp.id},'game')
    expect(r.pub().step).toBe('final-guess')
    expect(r.pub().result).toBeNull()
    r.ok(imp,'GUESS_WORD',{word:'uma palavra impossível'},'game')
    expect(r.pub().step).toBe('summary')
    const awards=r.pub().result!.points
    for(const p of r.players)expect(awards[p.id]).toBe(p.id===imp.id?0:2)
    r.ok(r.players[0],'END_GAME')
    const old=r.view().roomState.currentGameSessionId
    r.ok(r.players[0],'REPLAY_GAME')
    const fresh=r.view()
    expect(fresh.roomState.currentGameSessionId).not.toBe(old)
    expect(fresh.roomState.members).toHaveLength(4)
    expect(fresh.roomState.competition?.completedGames).toBe(1)
    expect(r.pub().step).toBe('reveal')
  })
})
