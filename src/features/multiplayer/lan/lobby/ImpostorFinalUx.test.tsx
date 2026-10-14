import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { ImpostorLanPublic, ImpostorLanPrivate } from '../../impostorLanGame'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(() => { cleanup(); vi.useRealTimers() })

function frame(step: ImpostorLanPublic['step'] | 'lobby' = 'reveal', connected = true): RoomSnapshotV2 {
  return {
    protocolVersion:2, roomId:'test-room-246810', revision:1, nextClientSeq:1,
    roomState:{hostPlayerId:'host',phase:step==='reveal'?'playing':step==='summary'?'results':'lobby',
      selectedGameId:'impostor-da-palavra', selectedConfig:{impostorMode:'alternate-word',conversationMode:'guided-questions',flow:'individual-vote'},
      currentGameSessionId:step==='reveal'||step==='summary'?'test-room:game-1':null,
      lastPublicResult:null,barriers:[],members:[
        {playerId:'host',role:'host',displayName:'Téo',ready:true,connected,participation:'active'},
        {playerId:'guest',role:'guest',displayName:'Lia',ready:true,connected,participation:'active'},
        {playerId:'third',role:'guest',displayName:'Rui',ready:true,connected,participation:'active'},
      ]},
    gamePublicState:step==='reveal'||step==='summary'?{
      gameId:'impostor-da-palavra',gameSessionId:'test-room:game-1',
      data:{step,flow:'individual-vote',mode:'alternate-word',conversationMode:'guided-questions',
        startedAt:Date.now()-12000,scoringMode:'individual',seenCount:3,totalPlayers:3,speakingOrder:['host','guest','third'],
        currentSpeaker:null, accusedId:'guest',winner:step==='summary'?'group':null,
        reason:step==='summary'?'caught':null,
        result:step==='summary'?{word:'Abacaxi',impostorId:'guest',guessedWord:'Abacaxi',
          impostorGuessedCorrectly:true,points:{host:2,guest:1,third:2}}:null,
      } satisfies ImpostorLanPublic}:null,
    privateState:step==='reveal'?{gameId:'impostor-da-palavra',gameSessionId:'test-room:game-1',
      data:{kind:'word',word:'Abacaxi',wasSeen:false} satisfies ImpostorLanPrivate}:null,
  }
}
const actions=()=>({onSelect:vi.fn(),onConfigure:vi.fn(),onReady:vi.fn(),onStart:vi.fn(),
  onGameAction:vi.fn(),onGameCommand:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),
  onReconnect:vi.fn(),onLeave:vi.fn(),onClose:vi.fn(),onRefreshInvite:vi.fn()})

describe('Impostor final UX approval',()=>{
  it('hides a revealed private word 5 seconds later and lets the player look again',()=>{
    const props=actions()
    render(<LobbyRoomView snapshot={frame('reveal')} role="host" playerId="host" connected
      busy={false} status="Conectado" {...props}/>)
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    act(()=>vi.advanceTimersByTime(4999))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    act(()=>vi.advanceTimersByTime(1))
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
  })
  it('shows the correct impostor-word bonus independently of the group victory',()=>{
    render(<LobbyRoomView snapshot={frame('summary')} role="host" playerId="host"
      connected busy={false} status="Conectado" {...actions()}/>)
    expect(screen.getByText(/impostor acertou a palavra/i)).toBeInTheDocument()
    expect(screen.getByText(/\+1 ponto extra/i)).toBeInTheDocument()
    expect(screen.getByText('Vitória da galera!')).toBeInTheDocument()
  })
  it('shows room code and live connection indicator in the header, not in a second feedback block',()=>{
    render(<LobbyRoomView snapshot={frame('lobby')} role="host" playerId="host"
      connected busy={false} status="Conectado" {...actions()}/>)
    const header=screen.getByRole('banner')
    expect(header).toHaveTextContent('Sala 246810')
    expect(header).toHaveTextContent('Conectado')
    expect(header.querySelector('.pl03-connection-light')).toHaveClass('is-connected')
    expect(screen.queryByText('Preparando a rodada')).not.toBeInTheDocument()
  })
  it('shows the red disconnected state in the same compact header',()=>{
    render(<LobbyRoomView snapshot={frame('lobby',false)} role="guest" playerId="guest"
      connected={false} busy={false} status="Sem conexão" {...actions()}/>)
    expect(screen.getByRole('banner')).toHaveTextContent('Sem conexão')
    expect(screen.getByRole('banner').querySelector('.pl03-connection-light')).toHaveClass('is-disconnected')
  })
  it('opens detailed guidance for everyone, including what Palavra alternativa means, without leaving the lobby',()=>{
    const props=actions()
    render(<LobbyRoomView snapshot={frame('lobby')} role="guest" playerId="guest"
      connected busy={false} status="Conectado" {...props}/>)
    fireEvent.click(screen.getByRole('button',{name:'Como jogar Impostor da Palavra'}))
    const guide=screen.getByRole('dialog',{name:'Como jogar Impostor da Palavra'})
    expect(guide).toHaveTextContent('Palavra alternativa')
    expect(guide).toHaveTextContent(/não sabe que é o impostor/i)
    expect(guide).toHaveTextContent(/Uma palavra por pessoa/)
    expect(guide).toHaveTextContent(/Perguntas guiadas/)
    expect(guide).toHaveTextContent(/Por acertos/)
    fireEvent.click(screen.getByRole('button',{name:'Fechar explicação'}))
    expect(screen.queryByRole('dialog',{name:'Como jogar Impostor da Palavra'})).toBeNull()
    expect(props.onBackToLobby).not.toHaveBeenCalled()
  })
})
