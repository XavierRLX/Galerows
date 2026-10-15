import { describe,expect,it } from 'vitest'
import { decideCityAutopilot } from './cidadeAutopilot'
import type { CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
function scene(step:CidadeDormeLanStep,overrides:Partial<CidadeDormeLanPublic>={}):CidadeDormeLanPublic{
 return {step,round:1,phaseRevision:4,phaseEventId:'city:4:1:'+step,phaseStartedAt:1700000000000,
  phaseReady:false,seenCount:4,totalPlayers:4,players:['a','b','c','d'].map(id=>({id,alive:true})),
  votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,winner:null,winReason:null,
  winnerPlayerId:null,finalRoles:null,...overrides}
}
function decision(step:CidadeDormeLanStep,elapsed:number,overrides:Partial<CidadeDormeLanPublic>={},
  role:'host'|'guest'='host',connected=true){
 return decideCityAutopilot({game:scene(step,overrides),now:1700000000000+elapsed,
   host:role==='host',connected,playing:true,busy:false})
}
describe('CITY-AUTOPILOT-01 phase planner',()=>{
 it('never controls a guest, disconnected, busy or manual mayor participant',()=>{
   expect(decision('voting',30000,{votedCount:4,phaseReady:true},'guest')).toBeNull()
   expect(decision('voting',30000,{votedCount:4,phaseReady:true},'host',false)).toBeNull()
 })
 it('announces instructions before host unlocks night actions and secret voting',()=>{
   expect(decision('killer-turn',1500)).toBeNull()
   expect(decision('killer-turn',8500)).toBe('OPEN_PHASE')
   expect(decideCityAutopilot({game:scene('killer-turn'),now:1700000010000,
     host:true,connected:true,playing:true,busy:false,audioDone:false})).toBeNull()
   expect(decision('doctor-turn',8500)).toBe('OPEN_PHASE')
   expect(decision('detective-turn',8500)).toBe('OPEN_PHASE')
   expect(decision('voting',8500)).toBe('OPEN_PHASE')
   expect(decision('killer-turn',8500,{phaseReady:true})).toBeNull()
 })
 it('automatically moves through intro, public announcements, discussion and secret ballots',()=>{
   expect(decision('reveal',6000,{seenCount:3})).toBeNull()
   expect(decision('reveal',6000)).toBe('START_NIGHT')
   expect(decision('morning',5000)).toBeNull()
   expect(decision('morning',9000)).toBe('START_DISCUSSION')
   expect(decision('discussion',12000)).toBeNull()
   expect(decision('discussion',37000)).toBe('START_VOTE')
   expect(decision('voting',10000,{phaseReady:true,votedCount:3})).toBeNull()
   expect(decision('voting',10000,{phaseReady:true,votedCount:4})).toBe('RESOLVE_VOTE')
   expect(decision('vote-result',9600,{voteResult:{kind:'tie'}})).toBe('NEXT_NIGHT')
 })
 it('keeps detective clue pending until private ACK, never skipping result',()=>{
   expect(decision('detective-result',8000)).toBeNull()
   expect(decision('detective-result',9500)).toBe('OPEN_PHASE')
   expect(decision('detective-result',9500,{phaseReady:true})).toBeNull()
   expect(decision('summary',9000)).toBe('END_GAME')
 })

 it('keeps an apparently normal timed turn for configured roles even when no player acts',()=>{
   expect(decision('doctor-turn',14500,{phaseReady:true})).toBe('SIMULATE_NIGHT_ROLE')
   expect(decision('detective-turn',14500,{phaseReady:true})).toBe('SIMULATE_NIGHT_ROLE')
   expect(decision('detective-result',14500,{phaseReady:true})).toBe('SIMULATE_NIGHT_ROLE')
   expect(decision('doctor-turn',11000,{phaseReady:true})).toBeNull()
   expect(decision('doctor-turn',14500,{phaseReady:false})).toBe('OPEN_PHASE')
   expect(decideCityAutopilot({game:scene('doctor-turn',{phaseReady:true}),
     now:1700000016000,host:true,connected:true,playing:true,busy:false,audioDone:false})).toBeNull()
 })

})
