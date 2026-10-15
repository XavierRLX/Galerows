import {describe,it,expect} from 'vitest'
import {cidadeDormeLanGame,type CidadeDormeRoundHistory,type CidadeDormeLanPublic} from './cidadeDormeLanGame'
import {roomFrameFits,type RoomSnapshotV2} from './persistentProtocol'

const players=Array.from({length:12},(_,i)=>'guest-'+(i+1))
const entry=(round:number):CidadeDormeRoundHistory=>({
 round,night:{killerId:'guest-12',killerTargetId:'guest-11',doctorId:'guest-10',doctorTargetId:'guest-9',
 detectiveId:'guest-8',detectiveTargetId:'guest-7',detectiveResult:'suspect',savedByDoctor:true,eliminatedId:null},
 vote:{kind:'tie',eliminatedId:null,
 votes:players.map((voterId,i)=>({voterId,targetId:players[(i+1)%12]}))}
})
describe('CITY-AUTOPILOT recap and LAN message budget',()=>{
 it('cannot make a 12-member Room unable to finish after repeated ties',()=>{
   const config={enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,
      conductionMode:'automatic' as const,killersCount:1}
   const state=cidadeDormeLanGame.createInitialState(config,players,{
     clock:{now:()=>1},random:()=>0.99999
   } as Parameters<typeof cidadeDormeLanGame.createInitialState>[2]) as {
     step:string; history:CidadeDormeRoundHistory[]
   }
   state.step='summary'
   state.history=Array.from({length:40},(_,i)=>entry(i+1))
   const data=cidadeDormeLanGame.projectPublic(state) as CidadeDormeLanPublic
   const snapshot:RoomSnapshotV2={
     protocolVersion:2,roomId:'room-long',revision:99999,nextClientSeq:250,
     roomState:{phase:'results',hostPlayerId:'guest-1',selectedGameId:'cidade-dorme',
       selectedConfig:config,currentGameSessionId:'game-long',lastPublicResult:null,barriers:[],
       members:players.map((playerId,i)=>({playerId,role:i===0?'host':'guest',connected:true,
         ready:true,participation:'active',displayName:'Jogador '+(i+1)}))},
     gamePublicState:{gameSessionId:'game-long',gameId:'cidade-dorme',data},
     privateState:{gameSessionId:'game-long',gameId:'cidade-dorme',
       data:{role:'citizen',alive:true,acknowledged:true,voted:true,canAct:false}}
   }
   expect(roomFrameFits({kind:'snapshotV2',protocolVersion:2,snapshot})).toBe(true)
   expect(data.historyOmittedRounds).toBeGreaterThan(0)
   expect(data.history?.at(-1)?.round).toBe(40)
 })
})
