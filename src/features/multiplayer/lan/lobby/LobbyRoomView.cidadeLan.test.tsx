import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { LobbyRoomView } from './LobbyRoomView'
afterEach(cleanup)
const actions=()=>({onSelect:vi.fn(),onConfigure:vi.fn(),onReady:vi.fn(),onStart:vi.fn(),
  onGameAction:vi.fn(),onGameCommand:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),
  onReconnect:vi.fn(),onLeave:vi.fn(),onClose:vi.fn(),onRefreshInvite:vi.fn()})
function scene(phase:'lobby'|'configuring'|'playing',count=4):RoomSnapshotV2 {
  return {protocolVersion:2,roomId:'r',revision:1,nextClientSeq:1,
    roomState:{hostPlayerId:'host',phase,selectedGameId:phase==='lobby'?null:'cidade-dorme',
      selectedConfig:phase==='playing'?{enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false}:null,
      currentGameSessionId:phase==='playing'?'s1':null,lastPublicResult:null,barriers:[],
      members:Array.from({length:count},(_,i)=>i===0?'host':i===1?'guest':i===2?'third':i===3?'fourth':'guest-'+i).map((id,i)=>({playerId:id,role:i===0?'host' as const:'guest' as const,
        connected:true,ready:true,participation:'active' as const}))},
    gamePublicState:phase==='playing'?{gameSessionId:'s1',gameId:'cidade-dorme',data:{
      step:'reveal',round:1,seenCount:0,totalPlayers:4,
      players:['host','guest','third','fourth'].map(id=>({id,alive:true})),
      votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,
      winner:null,winReason:null,winnerPlayerId:null,finalRoles:null}}:null,
    privateState:phase==='playing'?{gameId:'cidade-dorme',gameSessionId:'s1',data:{
      role:'citizen',alive:true,acknowledged:false,voted:false,canAct:false}}:null}
}
describe('G7 Cidade Dorme persistent lobby integration',()=>{
  it('offers City in host catalog with 4-person minimum and role config instead of test controls',()=>{
    const cb=actions()
    const {rerender}=render(<LobbyRoomView snapshot={scene('lobby')} role="host" playerId="host"
      busy={false} status="Conectado" {...cb}/>)
    fireEvent.click(screen.getByRole('button',{name:'Selecionar Cidade Dorme'}))
    expect(cb.onSelect).toHaveBeenCalledWith('cidade-dorme')
    rerender(<LobbyRoomView snapshot={scene('configuring')} role="host" playerId="host"
      busy={false} status="Conectado" {...cb}/>)
    expect(screen.getByText(/4 a 12 celulares/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Salvar papéis da Cidade Dorme'}))
    expect(cb.onConfigure).toHaveBeenCalledWith({
      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,enableWatchman:false,enableSleepwalker:false,
      revealRoleOnDeath:false,conductionMode:'automatic',
      killersCount:1,doctorCanSelfProtect:true,doctorSelfProtectLimit:1,doctorCanRepeatProtection:false})
  })
  it('saves custom killer count, self-protection count and consecutive protection policy',()=>{
    const cb=actions()
    render(<LobbyRoomView snapshot={scene('configuring',7)} role="host" playerId="host"
      busy={false} status="Conectado" {...cb}/>)
    fireEvent.click(screen.getByRole('button',{name:'2 integrantes assassinos'}))
    fireEvent.click(screen.getByRole('button',{name:'Limite de autoproteção: 2'}))
    fireEvent.click(screen.getByRole('button',{name:'Médico pode repetir proteção'}))
    fireEvent.click(screen.getByRole('button',{name:'Salvar papéis da Cidade Dorme'}))
    expect(cb.onConfigure).toHaveBeenCalledWith({
      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,
      enableWatchman:true,enableSleepwalker:true,revealRoleOnDeath:false,
      conductionMode:'automatic',killersCount:2,doctorCanSelfProtect:true,
      doctorSelfProtectLimit:2,doctorCanRepeatProtection:true,
    })
  })
  it('blocks configurations with more special roles than participants, then allows correction',()=>{
    const cb=actions()
    render(<LobbyRoomView snapshot={scene('configuring')} role="host" playerId="host"
      busy={false} status="Conectado" {...cb}/>)
    fireEvent.click(screen.getByRole('button',{name:'3 integrantes assassinos'}))
    expect(screen.getByText(/composição inválida/i)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Salvar papéis da Cidade Dorme'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'1 integrantes assassinos'}))
    expect(screen.getByRole('button',{name:'Salvar papéis da Cidade Dorme'})).toBeEnabled()
  })
  it('lets the host choose mayor mode while leaving the same lobby and saving the authorized config',()=>{
    const cb=actions()
    render(<LobbyRoomView snapshot={scene('configuring')} role="host" playerId="host"
      busy={false} status="Conectado" {...cb}/>)
    fireEvent.click(screen.getByRole('button',{name:'Com prefeito — narração humana'}))
    fireEvent.click(screen.getByRole('button',{name:'Salvar papéis da Cidade Dorme'}))
    expect(cb.onConfigure).toHaveBeenCalledWith({
      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,
      enableWatchman:false,enableSleepwalker:false,revealRoleOnDeath:false,
      conductionMode:'mayor',killersCount:1,doctorCanSelfProtect:true,
      doctorSelfProtectLimit:1,doctorCanRepeatProtection:false,
    })
    expect(screen.getByText(/não recebe papel nem vota/i)).toBeInTheDocument()
  })
  it('renders the dedicated mayor screen in the Room without showing a player role',()=>{
    const cb={...actions(),onRoomCommand:vi.fn()}
    const snapshot=scene('playing')
    snapshot.roomState.selectedConfig={...snapshot.roomState.selectedConfig as object,conductionMode:'mayor'}
    snapshot.privateState=null
    render(<LobbyRoomView snapshot={snapshot} role="host" playerId="host" busy={false}
      connected status="Conectado" {...cb}/>)
    expect(screen.getByRole('region',{name:'Painel do Prefeito'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Ver meu papel'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Consultar papéis e ações'})).toBeInTheDocument()
  })
  it('renders personal role screen, not synthetic probe, in game phase',()=>{
    const cb=actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest"
      busy={false} status="Conectado" {...cb}/>)
    expect(screen.getByTestId('cidade-immersive')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Meu papel'})).toBeInTheDocument()
    expect(screen.queryByText('Sala da galera')).not.toBeInTheDocument()
    expect(screen.queryByText(/Partida sintética para validar a sala/i)).not.toBeInTheDocument()
  })
})
