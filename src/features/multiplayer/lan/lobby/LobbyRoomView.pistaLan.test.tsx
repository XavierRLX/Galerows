import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(cleanup)
const callbacks = () => ({
  onSelect: vi.fn(), onConfigure: vi.fn(), onReady: vi.fn(), onStart: vi.fn(),
  onGameAction: vi.fn(), onGameCommand: vi.fn(), onEnd: vi.fn(),
  onBackToLobby: vi.fn(), onReconnect: vi.fn(), onLeave: vi.fn(),
  onClose: vi.fn(), onRefreshInvite: vi.fn(),
})
function scene(phase: 'lobby' | 'configuring' | 'playing'): RoomSnapshotV2 {
  return { protocolVersion: 2, roomId: 'room', revision: 6, nextClientSeq: 1,
    roomState: { hostPlayerId: 'host', phase, members: [
      { playerId: 'host', role: 'host', ready: true, connected: true, participation: 'active' },
      { playerId: 'guest', role: 'guest', ready: true, connected: true, participation: 'active' },
      { playerId: 'third', role: 'guest', ready: true, connected: true, participation: 'active' },
    ], selectedGameId: phase === 'lobby' ? null : 'pista-unica',
      selectedConfig: phase === 'playing' ? { categories: ['words'] } : null,
      currentGameSessionId: phase === 'playing' ? 'g6-session' : null,
      lastPublicResult: null, barriers: [] },
    gamePublicState: phase === 'playing' ? { gameId: 'pista-unica', gameSessionId: 'g6-session',
      data: { step: 'writing', round: 1, totalRounds: 3, guesserId: 'host',
        submittedCount: 0, requiredCount: 2, clues: [], excludedCount: 0,
        lastResult: null, scores: { host: 0, guest: 0, third: 0 } } } : null,
    privateState: phase === 'playing' ? { gameId: 'pista-unica', gameSessionId: 'g6-session',
      data: { kind: 'writer', submitted: false, target: 'Dinossauro' } } : null }
}
describe('G6 Pista Única integrates with the persistent lobby', () => {
  it('host can select it and configure eligible clue categories', () => {
    const props = callbacks()
    const { rerender } = render(<LobbyRoomView snapshot={scene('lobby')} role="host"
      playerId="host" busy={false} status="Conectado" {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Pista Única' }))
    expect(props.onSelect).toHaveBeenCalledWith('pista-unica')
    rerender(<LobbyRoomView snapshot={scene('configuring')} role="host"
      playerId="host" busy={false} status="Conectado" {...props} />)
    expect(screen.getByText(/cada pessoa escreve no próprio celular/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar categorias da Pista Única' }))
    expect(props.onConfigure).toHaveBeenCalledWith({ categories: ['words', 'movies', 'series'] })
  })

  it('routes playing to the private LAN component, never the synthetic proof of concept', () => {
    const props = callbacks()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest"
      busy={false} status="Conectado" {...props} />)
    expect(screen.getByRole('button', { name: 'Ver desafio secreto' })).toBeInTheDocument()
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    expect(screen.queryByText(/Partida sintética para validar/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    expect(screen.getByText('Dinossauro')).toBeInTheDocument()
  })
})
