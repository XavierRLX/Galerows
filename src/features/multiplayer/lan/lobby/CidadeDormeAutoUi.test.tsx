import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {vi,afterEach,describe,it,expect} from 'vitest'
import { CidadeDormeImmersiveRound } from './CidadeDormeImmersiveRound'
import {armCityAutomaticNarrator,resetCityAutomaticNarratorForTests} from './cidadeAutomaticAudio'
import type {RoomSnapshotV2} from '../../persistentProtocol'
function frame(step:string,changes:Record<string,unknown>={},role='citizen'):RoomSnapshotV2{
 const start=1700000000000
 return {protocolVersion:2,roomId:'r',revision:1,nextClientSeq:1,
 roomState:{phase:'playing',hostPlayerId:'host',selectedGameId:'cidade-dorme',currentGameSessionId:'game01',
 selectedConfig:{enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,conductionMode:'automatic'},
 lastPublicResult:null,barriers:[],members:['host','a','b','c'].map((id,i)=>({playerId:id,role:i?'guest' as const:'host' as const,
 displayName:id,connected:true,ready:true,participation:'active' as const}))},
 gamePublicState:{gameId:'cidade-dorme',gameSessionId:'game01',data:{
 step,round:1,phaseRevision:1,phaseStartedAt:start,phaseEventId:'evt1',phaseReady:true,
 seenCount:4,totalPlayers:4,players:['host','a','b','c'].map(id=>({id,alive:true})),
 votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,history:null,winReason:null,winner:null,
 winnerPlayerId:null,finalRoles:null,...changes}},
 privateState:{gameId:'cidade-dorme',gameSessionId:'game01',data:{role,alive:true,acknowledged:true,voted:false,
 canAct:step==='detective-result'?false:true,investigation:{targetId:'a',result:'suspect'}}}}
}
const callbacks=()=>({onAction:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),onReconnect:vi.fn(),
 onLeave:vi.fn(),onClose:vi.fn(),busy:false,connected:true,error:''})
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
describe('Cidade Dorme automatic post-lobby orchestration',()=>{
 it('never auto-resolves ballots before the host narrator finishes, nor on a guest',()=>{
  vi.useFakeTimers();vi.setSystemTime(1700000010000)
  const props=callbacks()
  render(<CidadeDormeImmersiveRound snapshot={frame('voting',{phaseReady:true,votedCount:4})}
    playerId='host' isHost {...props}/>)
  act(()=>{vi.advanceTimersByTime(500)})
  expect(props.onAction).not.toHaveBeenCalledWith('RESOLVE_VOTE',null)
  const guest=callbacks()
  cleanup()
  render(<CidadeDormeImmersiveRound snapshot={frame('voting',{phaseReady:true,votedCount:4})}
    playerId='a' isHost={false} {...guest}/>)
  act(()=>{vi.advanceTimersByTime(800)})
  expect(guest.onAction).not.toHaveBeenCalledWith('RESOLVE_VOTE',null)
 })
 it('playing host does not need or see manual advance buttons in automatic mode',()=>{
   const props=callbacks()
   render(<CidadeDormeImmersiveRound snapshot={frame('morning',{nightResult:{eliminatedId:null}})}
     playerId='host' isHost {...props}/>)
   expect(screen.queryByRole('button',{name:/abrir discussão/i})).not.toBeInTheDocument()
   expect(screen.getByText(/discussão começará automaticamente/i)).toBeInTheDocument()
 })
 it('does not expose actionable night targets before host completes the spoken cue',()=>{
   const props=callbacks()
   const {rerender}=render(<CidadeDormeImmersiveRound snapshot={frame('killer-turn',{phaseReady:false},'killer')}
     playerId='host' isHost {...props}/>)
   expect(screen.queryByRole('button',{name:/selecionar a/i})).not.toBeInTheDocument()
   expect(screen.queryByRole('button',{name:/escolher vítima/i})).not.toBeInTheDocument()
   rerender(<CidadeDormeImmersiveRound snapshot={frame('killer-turn',{phaseReady:true},'killer')}
     playerId='host' isHost {...props}/>)
   expect(screen.getByRole('button',{name:/selecionar a/i})).toBeInTheDocument()
 })
 it('does not offer targets to night actors before narrator authorizes their phase',()=>{
   const props=callbacks()
   render(<CidadeDormeImmersiveRound snapshot={frame('killer-turn',{phaseReady:false},'killer')}
     playerId='host' isHost {...props}/>)
   expect(screen.queryByRole('button',{name:/selecionar a$/i})).not.toBeInTheDocument()
   expect(screen.getByText(/aguarde.*narrador/i)).toBeInTheDocument()
 })
 it('detective sees private investigation result directly and confirms explicitly',()=>{
   const props=callbacks()
   const {rerender}=render(<CidadeDormeImmersiveRound snapshot={frame('detective-result',{phaseReady:false},'detective')}
    playerId='host' isHost {...props}/>)
   expect(screen.getByText(/resultado da investigação/i)).toBeInTheDocument()
   fireEvent.click(screen.getByRole('button',{name:/ver minha pista/i}))
   expect(screen.getByText(/suspeito/i)).toBeInTheDocument()
   expect(screen.getByRole('button',{name:/entendi.*dormir/i})).toBeDisabled()
   rerender(<CidadeDormeImmersiveRound snapshot={frame('detective-result',{phaseReady:true},'detective')}
     playerId='host' isHost {...props}/>)
   fireEvent.click(screen.getByRole('button',{name:/entendi.*dormir/i}))
   expect(props.onAction).toHaveBeenCalledWith('ACK_INVESTIGATION',null)
 })
 it('explains when old history rounds are omitted to keep the Room snapshot under the LAN frame limit',()=>{
   const snapshot=frame('summary',{winner:'city',historyOmittedRounds:5,
     finalRoles:['host','a','b','c'].map(id=>({id,role:'citizen'})),
     history:[{round:6,night:{killerId:'host',killerTargetId:'a',doctorId:null,
       doctorTargetId:null,detectiveId:null,detectiveTargetId:null,detectiveResult:null,
       savedByDoctor:false,eliminatedId:'a'},vote:null}]})
   render(<CidadeDormeImmersiveRound snapshot={snapshot} playerId='host' isHost {...callbacks()}/>)
   fireEvent.click(screen.getByRole('button',{name:/histórico/i}))
   expect(screen.getByText(/5 rodadas anteriores não exibidas/i)).toBeInTheDocument()
 })
 it('after game, shows per-round protected target, killer attempt, investigation and ballots',()=>{
   const props=callbacks()
   const snap=frame('summary',{winner:'city',finalRoles:['host','a','b','c'].map(id=>({id,role:'citizen'})),
    history:[{round:1,night:{killerId:'host',killerTargetId:'a',doctorId:'b',doctorTargetId:'a',
      detectiveId:'c',detectiveTargetId:'host',detectiveResult:'suspect',
      savedByDoctor:true,eliminatedId:null},
      vote:{kind:'tie',eliminatedId:null,votes:[{voterId:'a',targetId:'b'}]}}]})
   render(<CidadeDormeImmersiveRound snapshot={snap} playerId='host' isHost {...props}/>)
   fireEvent.click(screen.getByRole('button',{name:/histórico/i}))
   expect(screen.getByText(/assassino tentou/i)).toBeInTheDocument()
   expect(screen.getByText(/médico protegeu/i)).toBeInTheDocument()
   expect(screen.getByText(/empate/i)).toBeInTheDocument()
 })
})

describe('Host audible narration and phase timing',()=>{
 it('pauses the host autopilot on blur and offers an explicit replay gesture without silently resolving votes',()=>{
   vi.useFakeTimers();vi.setSystemTime(1700000015000)
   const audioInstances:{onended:(()=>void)|null}[]=[]
   class AudioMock {
     src:string;currentTime=0;preload='';onended:(()=>void)|null=null
     constructor(src:string){this.src=src;audioInstances.push(this)}
     pause(){}
     play(){return Promise.resolve()}
   }
   vi.stubGlobal('Audio',AudioMock)
   resetCityAutomaticNarratorForTests()
   armCityAutomaticNarrator()
   const props=callbacks()
   render(<CidadeDormeImmersiveRound snapshot={frame('voting',{
       phaseReady:true,votedCount:4,phaseEventId:'voting-blur'})}
     playerId='host' isHost {...props}/>)
   fireEvent(window,new Event('blur'))
   act(()=>{vi.advanceTimersByTime(1000)})
   expect(props.onAction).not.toHaveBeenCalledWith('RESOLVE_VOTE',null)
   fireEvent.click(screen.getByRole('button',{name:'Retomar narração'}))
   act(()=>{vi.advanceTimersByTime(700)})
   expect(props.onAction).not.toHaveBeenCalledWith('RESOLVE_VOTE',null)
   act(()=>{audioInstances.at(-1)?.onended?.()})
   act(()=>{vi.advanceTimersByTime(500)})
   expect(props.onAction).toHaveBeenCalledWith('RESOLVE_VOTE',null)
   resetCityAutomaticNarratorForTests()
 })
 it('does not unlock voting before spoken cue ends, and plays the next phase on the same host device',()=>{
   vi.useFakeTimers();vi.setSystemTime(1700000015000)
   const sounds:string[]=[]
   const instances:AudioMock[]=[]
   class AudioMock {
     src:string;currentTime=0;preload='';onended:(()=>void)|null=null
     constructor(src:string){this.src=src;instances.push(this)}
     pause(){}
     play(){sounds.push(this.src);return Promise.resolve()}
   }
   vi.stubGlobal('Audio',AudioMock)
   resetCityAutomaticNarratorForTests()
   expect(armCityAutomaticNarrator()).toBe(true)
   const first=frame('reveal',{seenCount:0,phaseEventId:'reveal-evt'})
   const props=callbacks()
   const {rerender}=render(<CidadeDormeImmersiveRound snapshot={first}
     playerId='host' isHost {...props}/>)
   const voting=frame('voting',{seenCount:4,phaseEventId:'voting-evt',phaseRevision:2,
     phaseReady:true,votedCount:4})
   rerender(<CidadeDormeImmersiveRound snapshot={voting} playerId='host' isHost {...props}/>)
   expect(sounds).toEqual([expect.stringContaining('01_identidade.mp3'),expect.stringContaining('12_votacao.mp3')])
   act(()=>vi.advanceTimersByTime(500))
   expect(props.onAction).not.toHaveBeenCalledWith('RESOLVE_VOTE',null)
   act(()=>instances.at(-1)?.onended?.())
   act(()=>vi.advanceTimersByTime(500))
   expect(props.onAction).toHaveBeenCalledWith('RESOLVE_VOTE',null)
   resetCityAutomaticNarratorForTests()
 })
})
