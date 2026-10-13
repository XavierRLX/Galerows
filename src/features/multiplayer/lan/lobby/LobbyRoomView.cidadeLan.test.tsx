import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { LobbyRoomView } from './LobbyRoomView'
afterEach(cleanup)
const actions=()=>({onSelect:vi.fn(),onConfigure:vi.fn(),onReady:vi.fn(),onStart:vi.fn(),
  onGameAction:vi.fn(),onGameCommand:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),
  onReconnect:vi.fn(),onLeave:vi.fn(),onClose:vi.fn(),onRefreshInvite:vi.fn()})
function scene(phase:'lobby'|'configuring'|'playing'):RoomSnapshotV2 {
  return {protocolVersion:2,roomId:'r',revision:1,nextClientSeq:1,
    roomState:{hostPlayerId:'host',phase,selectedGameId:phase==='lobby'?null:'cidade-dorme',
      selectedConfig:phase==='playing'?{enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false}:null,
      currentGameSessionId:phase==='playing'?'s1':null,lastPublicResult:null,barriers:[],
      members:['host','guest','third','fourth'].map((id,i)=>({playerId:id,role:i===0?'host' as const:'guest' as const,
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
      enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false})
  })
  it('renders personal role screen, not synthetic probe, in game phase',()=>{
    const cb=actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest"
      busy={false} status="Conectado" {...cb}/>)
    expect(screen.getByRole('button',{name:'Ver meu papel'})).toBeInTheDocument()
    expect(screen.queryByText(/Partida sintética para validar a sala/i)).not.toBeInTheDocument()
  })
})
