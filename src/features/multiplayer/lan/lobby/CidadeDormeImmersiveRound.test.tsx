import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPrivate, CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const ids = ['host', 'guest', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']
function frame(step: CidadeDormeLanStep, role: CidadeDormeLanPrivate['role'] = 'citizen',
  phase: 'playing' | 'results' = 'playing', count = 4): RoomSnapshotV2 {
  const players = ids.slice(0, count)
  const data: CidadeDormeLanPublic = {
    step, round: 1, phaseRevision: 1, phaseEventId: `city:phase:1:1:${step}`, phaseStartedAt: 1000, seenCount: step === 'reveal' ? 0 : count, totalPlayers: count,
    players: players.map(id => ({ id, alive: true })), votedCount: 0, eligibleVoters: count,
    nightResult: null, voteResult: null, winner: step === 'summary' ? 'city' : null,
    winReason: step === 'summary' ? 'city-eliminated-killers' : null, winnerPlayerId: null,
    finalRoles: step === 'summary' ? players.map(id => ({ id, role: id === 'guest' ? 'killer' : 'citizen' })) : null,
  }
  return { protocolVersion: 2, roomId: 'room', revision: 1, nextClientSeq: 1,
    roomState: { hostPlayerId: 'host', phase, selectedGameId: 'cidade-dorme',
      selectedConfig: { enableDoctor: true, enableDetective: true, enableJester: false, revealRoleOnDeath: false },
      currentGameSessionId: 'session-1', lastPublicResult: null, barriers: [],
      members: players.map((id, index) => ({
        playerId: id, role: index === 0 ? 'host' as const : 'guest' as const,
        displayName: id === 'host' ? 'Lia' : id === 'guest' ? 'Ana' : `Pessoa ${index + 1}`,
        connected: true, ready: true, participation: 'active' as const,
      })) },
    gamePublicState: { gameId: 'cidade-dorme', gameSessionId: 'session-1', data },
    privateState: { gameId: 'cidade-dorme', gameSessionId: 'session-1', data: {
      role, alive: true, acknowledged: step !== 'reveal', voted: false,
      canAct: step === 'voting' || (step === 'killer-turn' && role === 'killer'),
    } satisfies CidadeDormeLanPrivate } }
}
const actions = () => ({ onSelect: vi.fn(), onConfigure: vi.fn(), onReady: vi.fn(), onStart: vi.fn(),
  onGameAction: vi.fn(), onGameCommand: vi.fn(), onRoomCommand: vi.fn(), onEnd: vi.fn(), onBackToLobby: vi.fn(),
  onReplay: vi.fn(), onReconnect: vi.fn(), onLeave: vi.fn(), onClose: vi.fn(), onRefreshInvite: vi.fn() })
function show(snapshot: RoomSnapshotV2, role: 'host' | 'guest' = 'host', connected = true) {
  const cb = actions()
  const props = { snapshot, role, playerId: role === 'host' ? 'host' : 'guest',
    busy: false, status: connected ? 'Conectado' : 'Sem conexão', connected, ...cb }
  return { ...render(<LobbyRoomView {...props} />), cb, props }
}
describe('Cidade Dorme LAN como jogo mobile', () => {
  it('entra direto em uma cena de jogo, revela o papel só após toque e confirma no celular certo', () => {
    vi.useFakeTimers()
    const { cb } = show(frame('reveal', 'killer'))
    expect(screen.getByTestId('cidade-immersive')).toBeInTheDocument()
    expect(screen.queryByText('Sala da galera')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3400))
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /revelar meu papel/i }))
    expect(screen.getByText('Assassino')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirmar meu papel/i }))
    expect(cb.onGameCommand).toHaveBeenCalledWith('ACK_ROLE', null)
  })
  it('mostra somente a ação do papel autorizado e pagina alvos sem rolagem', () => {
    show(frame('killer-turn', 'killer', 'playing', 8))
    expect(screen.getByRole('button', { name: /alvos: próximos/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /alvos: próximos/i }))
    expect(screen.getByRole('button', { name: /selecionar pessoa 7/i })).toBeInTheDocument()
    cleanup()
    show(frame('killer-turn', 'citizen'))
    expect(screen.queryByRole('button', { name: /escolher vítima/i })).not.toBeInTheDocument()
  })
  it('oculta segredo ao perder foco, ao desconectar e ao mudar de fase', () => {
    const snapshot = frame('morning', 'detective')
    snapshot.privateState!.data = { ...(snapshot.privateState!.data as object),
      investigation: { targetId: 'guest', result: 'suspect' } }
    const view = show(snapshot)
    fireEvent.click(screen.getByRole('button', { name: /meu papel/i }))
    fireEvent.click(screen.getByRole('button', { name: /revelar meu papel/i }))
    expect(screen.getByText(/ana é suspeito/i)).toBeInTheDocument()
    fireEvent(window, new Event('blur'))
    expect(screen.queryByText(/ana é suspeito/i)).not.toBeInTheDocument()
    view.rerender(<LobbyRoomView {...view.props} connected={false} />)
    expect(screen.queryByText(/ana é suspeito/i)).not.toBeInTheDocument()
    view.rerender(<LobbyRoomView {...view.props} snapshot={frame('discussion', 'detective')} />)
    expect(screen.queryByText(/ana é suspeito/i)).not.toBeInTheDocument()
  })
  it('mantém voto secreto, abre resultado paginado e oferece replay na mesma sala', () => {
    const vote = show(frame('voting', 'citizen'), 'guest')
    fireEvent.click(screen.getByRole('button', { name: /selecionar lia/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar meu voto/i }))
    expect(vote.cb.onGameCommand).toHaveBeenCalledWith('CAST_VOTE', { playerId: 'host' })
    cleanup()
    const result = show(frame('summary', 'citizen', 'results', 8))
    expect(screen.getByRole('button', { name: /papéis: próximos/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /jogar novamente/i }))
    expect(result.cb.onReplay).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /voltar.*lobby/i }))
    expect(result.cb.onBackToLobby).toHaveBeenCalledOnce()
  })
  it('libera nova tentativa quando um comando pessoal é rejeitado', () => {
    const vote = show(frame('voting', 'citizen'), 'guest')
    fireEvent.click(screen.getByRole('button', { name: /selecionar lia/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar meu voto/i }))
    expect(screen.queryByRole('button', { name: /confirmar meu voto/i })).not.toBeInTheDocument()
    vote.rerender(<LobbyRoomView {...vote.props} error="Voto não recebido" />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar meu voto/i }))
    expect(vote.cb.onGameCommand).toHaveBeenCalledTimes(2)
  })
  it('bloqueia ações sem conexão e oferece retomada ao convidado', () => {
    const view = show(frame('voting', 'citizen'), 'guest', false)
    expect(screen.getByRole('alert')).toHaveTextContent('Sua identidade está oculta')
    expect(screen.queryByRole('button', { name: /confirmar meu voto/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reconectar' }))
    expect(view.cb.onReconnect).toHaveBeenCalledOnce()
  })
})

describe('Cidade Dorme — approved game flow contracts after START_GAME', () => {
  it('dedicated mayor is routed to private moderation, not a participant role screen', () => {
    const mayor = frame('reveal')
    mayor.roomState.selectedConfig = { enableDoctor: true, enableDetective: true, enableJester: false,
      revealRoleOnDeath: false, conductionMode: 'mayor', killersCount: 1 }
    mayor.privateState = null
    const host = show(mayor)
    expect(screen.getByRole('region', { name: 'Painel do Prefeito' })).toBeInTheDocument()
    expect(screen.queryByTestId('cidade-immersive')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar papéis e ações' })).toBeInTheDocument()
    cleanup()
    show(mayor, 'guest')
    expect(screen.getByTestId('cidade-immersive')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Painel do Prefeito' })).not.toBeInTheDocument()
    expect(host.cb.onGameCommand).not.toHaveBeenCalled()
  })
  it('promoted Traidor can perform assassin action while role remains Traidor; teammate not targetable', () => {
    const snapshot = frame('killer-turn', 'traitor', 'playing', 8)
    snapshot.privateState!.data = {
      role: 'traitor', acknowledged: true, alive: true, voted: false, canAct: true,
      activeKiller: true, killerTeammates: ['guest'], successionOrder: ['guest', 'host'],
    }
    const view = show(snapshot)
    expect(screen.getByRole('button', { name: /selecionar pessoa 3/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /selecionar ana/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /selecionar pessoa 3/i }))
    fireEvent.click(screen.getByRole('button', { name: /escolher vítima/i }))
    expect(view.cb.onGameCommand).toHaveBeenCalledWith('KILL', { playerId: 'third' })
  })
  it('doctor can self protect when the private server target list explicitly authorizes it', () => {
    const snapshot = frame('doctor-turn', 'doctor')
    snapshot.privateState!.data = {role:'doctor', alive:true, acknowledged:true, voted:false,
      canAct:true, doctorEligibleTargetIds:['host', 'guest']}
    const view = show(snapshot)
    expect(screen.getByRole('button', { name: /selecionar lia/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /selecionar pessoa 3/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /selecionar lia/i }))
    fireEvent.click(screen.getByRole('button', { name: /proteger pessoa/i }))
    expect(view.cb.onGameCommand).toHaveBeenCalledWith('PROTECT', {playerId:'host'})
  })
  it('night/day public subtitles use the canonical event without extra voice controls for guest or mayor', () => {
    const guest = frame('killer-turn', 'citizen')
    show(guest, 'guest')
    expect(screen.getByText(/A cidade adormece\. Todos fechem os olhos/i)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Ativar narração no anfitrião'})).not.toBeInTheDocument()
    cleanup()
    show(frame('killer-turn', 'killer'))
    expect(screen.getByRole('button',{name:'Ativar narração no anfitrião'})).toBeInTheDocument()
  })
  it('pause from mayor blocks phase actions and displays waiting state on every player', () => {
    const snapshot = frame('morning')
    snapshot.gamePublicState!.data = {...snapshot.gamePublicState!.data as object,paused:true}
    const view = show(snapshot)
    expect(screen.getByText(/Partida pausada pelo prefeito/i)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/abrir discussão/i})).toBeDisabled()
    expect(view.cb.onGameCommand).not.toHaveBeenCalled()
  })
  it('end-of-game roles display the two-traitor team under their accurate role labels', () => {
    const snapshot = frame('summary', 'citizen', 'results', 8)
    snapshot.gamePublicState!.data = {...snapshot.gamePublicState!.data as object,
      finalRoles: ids.slice(0,8).map((id,i)=>({id,role:i===1?'killer':i===2||i===3?'traitor':'citizen'}))}
    show(snapshot)
    expect(screen.getAllByText('Traidor')).toHaveLength(2)
  })
})

describe('Narration persists across secure scene remounts',()=>{
  it('continues the single activated host voice into next canonical phase without replaying a stale clip',()=>{
    const played:string[]=[]
    class AudioMock {
      currentTime=0
      src:string
      constructor(src:string){this.src=src}
      play(){played.push(this.src);return Promise.resolve()}
      pause(){}
    }
    vi.stubGlobal('Audio',AudioMock)
    const first=frame('reveal','citizen')
    const view=show(first)
    fireEvent.click(screen.getByRole('button',{name:'Ativar narração no anfitrião'}))
    expect(played).toEqual([expect.stringContaining('01_identidade.mp3')])
    const next=frame('discussion','citizen')
    view.rerender(<LobbyRoomView {...view.props} snapshot={next}/>)
    expect(played).toEqual([expect.stringContaining('01_identidade.mp3'),expect.stringContaining('11_discussao.mp3')])
    view.rerender(<LobbyRoomView {...view.props} snapshot={next}/>)
    expect(played).toHaveLength(2)
  })
})
