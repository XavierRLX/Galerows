import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LobbyRoomView } from './LobbyRoomView'
import type { RoomSnapshotV2 } from '../../persistentProtocol'

afterEach(cleanup)
function lobby(phase: 'lobby' | 'results'='lobby'): RoomSnapshotV2 {
  return { protocolVersion:2,roomId:'visual-room',revision:2,nextClientSeq:1,
    privateState:null,gamePublicState:null,
    roomState:{hostPlayerId:'host',phase,
      selectedGameId:'impostor-da-palavra',
      selectedConfig:{impostorMode:'no-word',conversationMode:'one-word',flow:'individual-vote'},
      currentGameSessionId:phase==='results'?'visual-room:game-1':null,
      lastPublicResult:null,barriers:[],competition:{
        status:'active',completedGames:1,
        standings:[{playerId:'host',displayName:'Renan',points:2,wins:1,played:1},
          {playerId:'guest',displayName:'Bia',points:1,wins:1,played:1}],winnerPlayerIds:[],
      },members:[
        {playerId:'host',role:'host',connected:true,ready:false,participation:'active',displayName:'Renan'},
        {playerId:'guest',role:'guest',connected:true,ready:false,participation:'active',displayName:'Bia'},
      ]}
  }
}
const handlers=()=>({
  onSelect:vi.fn(),onConfigure:vi.fn(),onReady:vi.fn(),onStart:vi.fn(),
  onGameAction:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),
  onReplay:vi.fn(),onRename:vi.fn(),onReconnect:vi.fn(),onLeave:vi.fn(),
  onClose:vi.fn(),onRefreshInvite:vi.fn(),
})
describe('compact lobby approvals',()=>{
  it('keeps member list and scoreboard collapsed by default and closes when tapping outside',()=>{
    const props=handlers()
    const {container}=render(<LobbyRoomView snapshot={lobby()} role="host" playerId="host"
      busy={false} connected status="Conectado" {...props}/>)
    expect(screen.queryByRole('dialog', {name:'Placar da sala'})).toBeNull()
    expect(screen.queryByRole('dialog', {name:'Jogadores'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:/Jogadores · 2/}))
    expect(screen.getByRole('dialog', {name:'Jogadores'})).toBeInTheDocument()
    expect(screen.getByText(/Bia/)).toBeInTheDocument()
    const overlay=container.querySelector('.pl03-lobby-overlay')!
    fireEvent.pointerDown(overlay)
    expect(screen.queryByRole('dialog', {name:'Jogadores'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:/Placar/}))
    expect(screen.getByRole('dialog', {name:'Placar da sala'})).toBeInTheDocument()
  })
  it('lets only the local member edit their own name and submit it to host authority',()=>{
    const props=handlers()
    render(<LobbyRoomView snapshot={lobby()} role="host" playerId="host"
      busy={false} connected status="Conectado" {...props}/>)
    fireEvent.click(screen.getByRole('button', {name:'Editar meu nome'}))
    const field=screen.getByLabelText('Seu nome nas próximas partidas')
    fireEvent.change(field,{target:{value:'Renan Xavier'}})
    fireEvent.click(screen.getByRole('button', {name:'Salvar nome'}))
    expect(props.onRename).toHaveBeenCalledWith('Renan Xavier')
  })
  it('offers replay and lobby separately in game results',()=>{
    const props=handlers()
    render(<LobbyRoomView snapshot={lobby('results')} role="host" playerId="host"
      busy={false} connected status="Conectado" {...props}/>)
    fireEvent.click(screen.getByRole('button',{name:'Jogar novamente'}))
    expect(props.onReplay).toHaveBeenCalledOnce()
    expect(props.onBackToLobby).not.toHaveBeenCalled()
  })
})
