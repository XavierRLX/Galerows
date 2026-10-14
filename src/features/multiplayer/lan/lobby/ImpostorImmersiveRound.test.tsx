import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { ImpostorLanPublic, ImpostorLanPrivate } from '../../impostorLanGame'
import { LobbyRoomView, type LobbyRoomViewProps } from './LobbyRoomView'

afterEach(cleanup)

function snapshot(step: ImpostorLanPublic['step'] = 'reveal'): RoomSnapshotV2 {
  const ids = ['host', 'guest', 'third']
  const phase = step === 'summary' ? 'playing' : 'playing'
  return {
    protocolVersion: 2, roomId: 'lan-room', revision: 5, nextClientSeq: 2,
    roomState: { hostPlayerId: 'host', phase, selectedGameId: 'impostor-da-palavra',
      selectedConfig: { impostorMode:'no-word',conversationMode:'one-word',flow:'individual-vote',timerSeconds:0 },
      currentGameSessionId: 'lan-room:game-1', lastPublicResult: null, barriers: [],
      members: ids.map(id=>({playerId:id, displayName:id==='host'?'Host':id==='guest'?'Alice':'Beto',
        role: id==='host'?'host' as const:'guest' as const, ready:true,connected:true,participation:'active' as const})) },
    gamePublicState: {gameId:'impostor-da-palavra',gameSessionId:'lan-room:game-1',
      data: {flow:'individual-vote',step,mode:'no-word',conversationMode:'one-word',
        startedAt: Date.now()-4500, timerSeconds:0, timerStartedAt:null,
        seenCount:3,totalPlayers:3,speakingOrder:ids,currentSpeaker:null,
        accusedId:null,winner:step==='summary'?'group':null,
        reason:step==='summary'?'caught':null, voteCount:1,voteRound:1,runoffCandidates:null,
        result:step==='summary'?{impostorId:'third',word:'Abacaxi',guessedWord:null,
          points:{host:1,guest:1,third:0}}:null } satisfies ImpostorLanPublic },
    privateState: {gameId:'impostor-da-palavra', gameSessionId:'lan-room:game-1',
      data: (step==='reveal' ? {kind:'word',word:'Abacaxi',wasSeen:false,hasVoted:false}
        : {kind:'impostor',wasSeen:true,hasVoted:false}) satisfies ImpostorLanPrivate},
  }
}

function view(frame = snapshot(), role:'host'|'guest'='host') {
  const callbacks = { onSelect:vi.fn(),onConfigure:vi.fn(),onReady:vi.fn(),onStart:vi.fn(),
    onGameAction:vi.fn(),onGameCommand:vi.fn(),onEnd:vi.fn(),onBackToLobby:vi.fn(),
    onReconnect:vi.fn(),onLeave:vi.fn(),onClose:vi.fn(),onRefreshInvite:vi.fn() }
  const props: LobbyRoomViewProps = {snapshot:frame,role,playerId:role==='host'?'host':'guest',
    connected:true,busy:false,status:'Conectado',...callbacks}
  return {...render(<LobbyRoomView {...props}/>),callbacks,props}
}

describe('Impostor LAN real immersion, replacing lobby during a GameSession',()=>{
  it('goes straight to the secret card with no duplicate lobby or prominent game heading',()=>{
    const {callbacks} = view()
    expect(screen.getByTestId('impostor-immersive')).toBeInTheDocument()
    expect(screen.queryByTestId('pl03-lobby')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading',{name:'Sala da galera'})).not.toBeInTheDocument()
    expect(screen.queryByText('Operação Infiltrado.')).not.toBeInTheDocument()
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    expect(callbacks.onGameCommand).toHaveBeenCalledWith('ACK_BRIEFING',null)
    fireEvent.click(screen.getByRole('button',{name:'Ocultar informação'}))
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    expect(screen.getByText('Todos visualizaram!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Abrir votação para todos/}))
    expect(callbacks.onGameCommand).toHaveBeenCalledWith('START_VOTING',null)
  })

  it('lets each guest confirm their own vote, and then shows only a waiting state',()=>{
    const guest=snapshot('voting')
    const {rerender,callbacks,props}=view(guest,'guest')
    expect(screen.getByTestId('impostor-immersive')).toBeInTheDocument()
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Beto/}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar voto em Beto'}))
    expect(callbacks.onGameCommand).toHaveBeenCalledWith('VOTE',{playerId:'third'})
    const after={...guest,privateState:{...guest.privateState!,data:{
      kind:'impostor',wasSeen:true,hasVoted:true } satisfies ImpostorLanPrivate }}
    rerender(<LobbyRoomView {...props} snapshot={after}/>)
    expect(screen.getByText('Voto confirmado.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Confirmar voto em Beto'})).not.toBeInTheDocument()
    expect(screen.getByText('1 de 3 votos registrados')).toBeInTheDocument()
  })

  it('hides the secret immediately when network connection drops',()=>{
    const {callbacks,props,rerender}=view()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    rerender(<LobbyRoomView {...props} connected={false}/>)
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    expect(screen.getByText(/Conexão interrompida/)).toBeInTheDocument()
    expect(callbacks.onGameCommand).toHaveBeenCalledTimes(1)
  })

  it('shows results directly after votes; host records points and sends everyone back to the same lobby',()=>{
    const result=snapshot('summary')
    const {callbacks,props,rerender}=view(result)
    expect(screen.getByRole('heading',{name:'Vitória da galera!'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Registrar pontuação/}))
    expect(callbacks.onEnd).toHaveBeenCalledTimes(1)
    rerender(<LobbyRoomView {...props} snapshot={{...result,roomState:{...result.roomState,
      phase:'results',lastPublicResult:{gameSessionId:'lan-room:game-1',gameId:'impostor-da-palavra',status:'completed'}}}}/>)
    fireEvent.click(screen.getByRole('button',{name:/Voltar com todos ao lobby/}))
    expect(callbacks.onBackToLobby).toHaveBeenCalledTimes(1)
  })

  it('never shows alternate-word mode explicitly marking the impostor',()=>{
    const frame=snapshot()
    frame.privateState!.data = {kind:'word',word:'Manga',wasSeen:true,hasVoted:false}
    const {container}=view(frame,'guest')
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Manga')).toBeInTheDocument()
    expect(container.textContent).not.toContain('VOCÊ É O IMPOSTOR')
  })
  it('preserves the offline guest emergency exit instead of trapping players inside a game',()=>{
    const {callbacks,props,rerender}=view(snapshot(), 'guest')
    rerender(<LobbyRoomView {...props} connected={false}/>)
    fireEvent.click(screen.getByRole('button',{name:'Sair da sala'}))
    expect(screen.getByText(/a saída será somente local/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Fechar neste aparelho'}))
    expect(callbacks.onLeave).toHaveBeenCalledOnce()
    expect(callbacks.onClose).not.toHaveBeenCalled()
  })

  it('does not silently terminate the room on Android back while exit confirmation is open',()=>{
    const {callbacks}=view()
    fireEvent.click(screen.getByRole('button',{name:'Encerrar sala'}))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const back=new Event('galerows:back',{cancelable:true})
    fireEvent(window,back)
    expect(back.defaultPrevented).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callbacks.onClose).not.toHaveBeenCalled()
  })

})
