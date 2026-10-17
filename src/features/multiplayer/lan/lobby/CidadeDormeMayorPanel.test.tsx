import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { CidadeDormeMayorPanel } from './CidadeDormeMayorPanel'

const gameId='cidade-dorme'
function frame(step='reveal', secret=false): RoomSnapshotV2 {
  return {protocolVersion:2,roomId:'town',revision:4,nextClientSeq:2,
    roomState:{phase:'playing',hostPlayerId:'mayor',selectedGameId:gameId,
      selectedConfig:{enableDoctor:true,enableDetective:true,enableJester:true,revealRoleOnDeath:false,conductionMode:'mayor'},
      currentGameSessionId:'city-session-1',lastPublicResult:null,barriers:[],
      members:[{playerId:'mayor',role:'host',connected:true,ready:false,participation:'waiting'},
      ...['alice','bob','cara','dave'].map(playerId=>({playerId,role:'guest' as const,
        connected:true,ready:true,participation:'active' as const}))]},
    gamePublicState:{gameId,gameSessionId:'city-session-1',data:{
      step,round:1,seenCount:4,totalPlayers:4,
      players:['alice','bob','cara','dave'].map(id=>({id,alive:true})),
      votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,winner:null,
      winReason:null,winnerPlayerId:null,finalRoles:null}},
    privateState:secret?{gameId,gameSessionId:'city-session-1',data:{
      kind:'mayor-consultation',roles:[
        {playerId:'alice',role:'killer',alive:true},{playerId:'bob',role:'detective',alive:true},
        {playerId:'cara',role:'doctor',alive:true},{playerId:'dave',role:'jester',alive:true}],
      successionOrder:['alice'],actions:{killerTarget:'bob'}}}:null}
}
afterEach(cleanup)
const actions=()=>({onGameCommand:vi.fn(),onRoomCommand:vi.fn(),onEnd:vi.fn()})
describe('CITY-MAYOR-02 — confidential orchestration panel',()=>{
  it('shows the common public narration as subtitles while retaining human-only voice',()=>{
    render(<CidadeDormeMayorPanel snapshot={frame('killer-turn')} connected busy={false} {...actions()}/>)
    expect(screen.getByText(/A cidade adormece\. Todos fechem os olhos/)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Ativar narração no anfitrião'})).not.toBeInTheDocument()
  })
  it('lets the moderator preserve a night role slot when no living actor can respond',()=>{
    const callbacks=actions()
    const {rerender}=render(<CidadeDormeMayorPanel snapshot={frame('doctor-turn')}
      connected busy={false} {...callbacks}/>)
    const button=screen.getByRole('button',{name:'Continuar após turno sem ação'})
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(callbacks.onGameCommand).toHaveBeenCalledWith('SIMULATE_NIGHT_ROLE',null)
    rerender(<CidadeDormeMayorPanel snapshot={frame('detective-turn')}
      connected busy={false} {...callbacks}/>)
    expect(screen.getByRole('button',{name:'Continuar após turno sem ação'})).toBeInTheDocument()
    rerender(<CidadeDormeMayorPanel snapshot={frame('morning')}
      connected busy={false} {...callbacks}/>)
    expect(screen.queryByRole('button',{name:'Continuar após turno sem ação'})).toBeNull()
  })
  it('lets the human mayor advance the Watchman decoy and result without revealing whether the role is alive', () => {
    const callbacks = actions()
    const { rerender } = render(<CidadeDormeMayorPanel snapshot={frame('watchman-turn')}
      connected busy={false} {...callbacks} />)
    const action = screen.getByRole('button', { name: 'Continuar após turno sem ação' })
    fireEvent.click(action)
    expect(callbacks.onGameCommand).toHaveBeenCalledWith('SIMULATE_NIGHT_ROLE', null)
    rerender(<CidadeDormeMayorPanel snapshot={frame('watchman-result')}
      connected busy={false} {...callbacks} />)
    expect(screen.getByRole('button', { name: 'Continuar após turno sem ação' })).toBeInTheDocument()
    expect(screen.queryByText(/vigia eliminado/i)).not.toBeInTheDocument()
  })
  it('shows phase and progress by default without any sensitive role or target',()=>{
    render(<CidadeDormeMayorPanel snapshot={frame()} connected busy={false} {...actions()}/>)
    expect(screen.getByRole('heading',{name:'Prefeito da cidade'})).toBeInTheDocument()
    expect(screen.getByText(/4 de 4 jogadores visualizaram/i)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/Começar a noite/i})).toBeEnabled()
    expect(screen.queryByText(/Assassino/)).not.toBeInTheDocument()
    expect(screen.queryByText(/alice.*killer/)).not.toBeInTheDocument()
  })
  it('requires an explicit privacy confirmation to request the secret map, then allows closing',()=>{
    const a=actions()
    const {rerender}=render(<CidadeDormeMayorPanel snapshot={frame()} connected busy={false} {...a}/>)
    fireEvent.click(screen.getByRole('button',{name:'Consultar papéis e ações'}))
    expect(screen.getByRole('dialog',{name:'Confirmar consulta confidencial'})).toBeInTheDocument()
    expect(a.onRoomCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Estou em um local privado'}))
    expect(a.onRoomCommand).toHaveBeenCalledWith('OPEN_MAYOR_SECRETS',null)
    rerender(<CidadeDormeMayorPanel snapshot={frame('reveal',true)} connected busy={false} {...a}/>)
    expect(screen.getByText('Assassino')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText(/Alvo da noite/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Fechar consulta'}))
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    expect(a.onRoomCommand).toHaveBeenCalledWith('CLOSE_MAYOR_SECRETS',null)
  })
  it('immediately conceals the private map on app blur or visibility loss',()=>{
    const a=actions()
    const {rerender}=render(<CidadeDormeMayorPanel snapshot={frame()} connected busy={false} {...a}/>)
    fireEvent.click(screen.getByRole('button',{name:'Consultar papéis e ações'}))
    fireEvent.click(screen.getByRole('button',{name:'Estou em um local privado'}))
    rerender(<CidadeDormeMayorPanel snapshot={frame('reveal',true)} connected busy={false} {...a}/>)
    expect(screen.getByText('Assassino')).toBeInTheDocument()
    fireEvent(window,new Event('blur'))
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    expect(a.onRoomCommand).toHaveBeenCalledWith('CLOSE_MAYOR_SECRETS',null)
  })
  it('offers a readable phase script for human repetition, without pretending to play audio',()=>{
    render(<CidadeDormeMayorPanel snapshot={frame('killer-turn')} connected busy={false} {...actions()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Repetir instrução'}))
    expect(screen.getByRole('dialog',{name:'Roteiro da fase'})).toHaveTextContent(/Assassino, acorde/)
    fireEvent.click(screen.getByRole('button',{name:'Voltar ao painel'}))
    expect(screen.queryByRole('dialog',{name:'Roteiro da fase'})).not.toBeInTheDocument()
  })
  it('suspends phase actions while paused and exposes only Resume to the mayor',()=>{
    const a=actions()
    const paused=frame('discussion')
    paused.gamePublicState={...paused.gamePublicState!,data:{...(paused.gamePublicState?.data as object),paused:true}}
    render(<CidadeDormeMayorPanel snapshot={paused} connected busy={false} {...a}/>)
    expect(screen.getByRole('button',{name:'Abrir votação'})).toBeDisabled()
    expect(screen.getByText(/Partida pausada/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Retomar partida'}))
    expect(a.onGameCommand).toHaveBeenCalledWith('RESUME_CITY',null)
  })
  it('keeps the human mayor inside the game result with replay and explicit lobby return',()=>{
    const result=frame('summary')
    result.roomState.phase='results'
    const cb={...actions(),onReplay:vi.fn(),onBackToLobby:vi.fn()}
    render(<CidadeDormeMayorPanel snapshot={result} connected busy={false} {...cb}/>)
    expect(screen.queryByRole('button',{name:'Finalizar e pontuar'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Jogar novamente'}))
    expect(cb.onReplay).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button',{name:'Voltar ao lobby'}))
    expect(cb.onBackToLobby).toHaveBeenCalledOnce()
  })
  it('conveys valid phase controls and never offers players secret commands',()=>{
    const a=actions()
    render(<CidadeDormeMayorPanel snapshot={frame('discussion')} connected busy={false} {...a}/>)
    fireEvent.click(screen.getByRole('button',{name:'Abrir votação'}))
    expect(a.onGameCommand).toHaveBeenCalledWith('START_VOTE',null)
    expect(screen.queryByRole('button',{name:/Matar|Investigar|Proteger|Votar/})).not.toBeInTheDocument()
  })
})
