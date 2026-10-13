import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { CidadeDormeLanRound } from './CidadeDormeLanRound'

afterEach(cleanup)
function frame(step = 'reveal', mine = 'killer'): RoomSnapshotV2 {
  return { protocolVersion: 2, roomId: 'r', revision: 9, nextClientSeq: 1,
    roomState: { hostPlayerId: 'host', phase: 'playing',
      selectedGameId: 'cidade-dorme', selectedConfig: { enableDoctor:true,
        enableDetective:true,enableJester:true,revealRoleOnDeath:false },
      currentGameSessionId: 's1', lastPublicResult: null, barriers: [],
      members: ['host','guest','third','fourth'].map((id,i) => ({
        playerId: id, role: i === 0 ? 'host' as const : 'guest' as const,
        ready:true, connected:true,participation:'active' as const })) },
    gamePublicState: { gameId: 'cidade-dorme',gameSessionId:'s1',data: {
      step,round:1,seenCount:0,totalPlayers:4,
      players:['host','guest','third','fourth'].map(id=>({id,alive:true})),
      votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,
      winner:null,winReason:null,winnerPlayerId:null,finalRoles:null } },
    privateState: { gameId:'cidade-dorme',gameSessionId:'s1',data: {
      role: mine,alive:true,acknowledged:false,voted:false,canAct:true,
      ...(mine==='detective' ? {investigation:{targetId:'host',result:'suspect'}}:{}) } } }
}
const show=(snapshot=frame(), host=false, connected=true) => {
  const onAction=vi.fn(),onEnd=vi.fn()
  const props={snapshot,playerId:host?'host':'guest',isHost:host,
    busy:false,connected,onAction,onEnd}
  return {...render(<CidadeDormeLanRound {...props}/>),props,onAction,onEnd}
}
describe('G7 Cidade Dorme LAN — privacy and phases',()=>{
  it('does not show role until tap, hides on blur and lets only owner confirm',()=>{
    const s=show()
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Confirmar meu papel'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Ver meu papel'}))
    expect(screen.getByText('Assassino')).toBeInTheDocument()
    fireEvent(window,new Event('blur'))
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Ver meu papel'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar meu papel'}))
    expect(s.onAction).toHaveBeenCalledWith('ACK_ROLE',null)
  })
  it('conceals role on reconnect and phase changes; never gives killer controls to citizens',()=>{
    const {rerender,props}=show()
    fireEvent.click(screen.getByRole('button',{name:'Ver meu papel'}))
    rerender(<CidadeDormeLanRound {...props} connected={false}/>)
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    rerender(<CidadeDormeLanRound {...props} connected/>)
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    cleanup()
    show(frame('killer-turn','citizen'))
    expect(screen.queryByRole('button',{name:'Escolher vítima'})).not.toBeInTheDocument()
  })
  it('allows only acting roles to select private night actions and detective keeps result concealed',()=>{
    const s=show(frame('killer-turn','killer'))
    fireEvent.click(screen.getByRole('button',{name:'Selecionar Jogador 3'}))
    fireEvent.click(screen.getByRole('button',{name:'Escolher vítima'}))
    expect(s.onAction).toHaveBeenCalledWith('KILL',{playerId:'third'})
    cleanup()
    const detective=show(frame('morning','detective'))
    expect(screen.queryByText('Suspeito')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Ver meu papel'}))
    expect(screen.getByText('Suspeito')).toBeInTheDocument()
    expect(detective.onAction).not.toHaveBeenCalled()
  })
  it('lets host advance after acknowledging own role without waiting for another remount',()=>{
    const initial=frame('reveal','citizen')
    const host=show(initial,true)
    fireEvent.click(screen.getByRole('button',{name:'Ver meu papel'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar meu papel'}))
    const ready=frame('reveal','citizen')
    ready.gamePublicState!.data={...(ready.gamePublicState!.data as Record<string,unknown>),seenCount:4}
    ready.privateState!.data={...(ready.privateState!.data as Record<string,unknown>),acknowledged:true}
    host.rerender(<CidadeDormeLanRound {...host.props} snapshot={ready}/>)
    expect(screen.getByRole('button',{name:/Começar a noite/})).toBeEnabled()
  })
  it('lets host tally once their own vote is submitted and the others have finished',()=>{
    const initial=frame('voting','citizen')
    const host=show(initial,true)
    fireEvent.click(screen.getByRole('button',{name:'Selecionar Jogador 3'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar meu voto'}))
    const voted=frame('voting','citizen')
    voted.gamePublicState!.data={...(voted.gamePublicState!.data as Record<string,unknown>),votedCount:4}
    voted.privateState!.data={...(voted.privateState!.data as Record<string,unknown>),voted:true}
    host.rerender(<CidadeDormeLanRound {...host.props} snapshot={voted}/>)
    expect(screen.getByRole('button',{name:'Apurar votação'})).toBeEnabled()
  })
  it('hides votes until they are submitted, displays winner and allows host to conclude only summary',()=>{
    const vote=show(frame('voting','citizen'))
    fireEvent.click(screen.getByRole('button',{name:'Selecionar Jogador 3'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar meu voto'}))
    expect(vote.onAction).toHaveBeenCalledWith('CAST_VOTE',{playerId:'third'})
    cleanup()
    const done=frame('summary','citizen')
    done.gamePublicState!.data={...(done.gamePublicState!.data as Record<string,unknown>),
      winner:'city',winReason:'city-eliminated-killers'}
    const host=show(done,true)
    expect(screen.getByText('Vitória da cidade!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Finalizar partida e pontuar'}))
    expect(host.onEnd).toHaveBeenCalledOnce()
  })
})
