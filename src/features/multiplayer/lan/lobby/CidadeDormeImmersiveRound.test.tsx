import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPrivate, CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(() => { cleanup(); vi.useRealTimers() })
const ids = ['host', 'guest', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']
function frame(step: CidadeDormeLanStep, role: CidadeDormeLanPrivate['role'] = 'citizen',
  phase: 'playing' | 'results' = 'playing', count = 4): RoomSnapshotV2 {
  const players = ids.slice(0, count)
  const data: CidadeDormeLanPublic = {
    step, round: 1, seenCount: step === 'reveal' ? 0 : count, totalPlayers: count,
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
  onGameAction: vi.fn(), onGameCommand: vi.fn(), onEnd: vi.fn(), onBackToLobby: vi.fn(),
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
    act(() => vi.advanceTimersByTime(1800))
    expect(screen.queryByText('Assassino')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Carta de Assassino' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pegue sua carta/i }))
    expect(screen.getByText('Assassino')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Carta de Assassino' })).toHaveAttribute('src',
      '/assets/games/cidade-dorme/cards/assassino.webp')
    fireEvent.click(screen.getByRole('button', { name: /confirmar minha carta/i }))
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
  it('retira a arte secreta após cinco segundos e permite pegar a carta novamente', () => {
    vi.useFakeTimers()
    show(frame('reveal', 'doctor'))
    act(() => vi.advanceTimersByTime(1800))
    fireEvent.click(screen.getByRole('button', { name: 'Pegue sua carta' }))
    expect(screen.getByRole('img', { name: 'Carta de Médica' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('img', { name: 'Carta de Médica' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar minha carta' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Pegue sua carta' }))
    expect(screen.getByRole('img', { name: 'Carta de Médica' })).toBeInTheDocument()
  })
  it('oculta segredo ao perder foco, ao desconectar e ao mudar de fase', () => {
    const snapshot = frame('morning', 'detective')
    snapshot.privateState!.data = { ...(snapshot.privateState!.data as object),
      investigation: { targetId: 'guest', result: 'suspect' } }
    const view = show(snapshot)
    fireEvent.click(screen.getByRole('button', { name: /minha carta/i }))
    fireEvent.click(screen.getByRole('button', { name: /pegue sua carta/i }))
    expect(screen.getByText(/ana é suspeito/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Carta de Detetive' })).toBeInTheDocument()
    fireEvent(window, new Event('blur'))
    expect(screen.queryByRole('img', { name: 'Carta de Detetive' })).not.toBeInTheDocument()
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
