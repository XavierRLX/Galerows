import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(cleanup)
function scene(phase: RoomSnapshotV2['roomState']['phase'] = 'configuring'): RoomSnapshotV2 {
  return { protocolVersion: 2, roomId: 'room', revision: 4, nextClientSeq: 1,
    privateState: { gameSessionId: 's', gameId: 'toy', data: { secret: 'ONLY-MINE' } },
    gamePublicState: { gameSessionId: 's', gameId: 'toy', data: { rounds: 2, clueCount: 0 } },
    roomState: { hostPlayerId: 'host', phase, selectedGameId: 'toy', selectedConfig: { rounds: 2 },
      members: [{ playerId: 'host', role: 'host', connected: true, ready: true, participation: 'active' },
        { playerId: 'guest', role: 'guest', connected: true, ready: true, participation: 'active' }],
      currentGameSessionId: phase === 'playing' || phase === 'results' ? 's' : null,
      lastPublicResult: null, barriers: [] } }
}
const actions = () => ({
  onSelect: vi.fn(async () => undefined), onConfigure: vi.fn(async () => undefined),
  onReady: vi.fn(async () => undefined), onStart: vi.fn(async () => undefined),
  onGameAction: vi.fn(async () => undefined), onEnd: vi.fn(async () => undefined),
  onBackToLobby: vi.fn(async () => undefined), onReconnect: vi.fn(async () => undefined),
  onLeave: vi.fn(async () => undefined), onClose: vi.fn(async () => undefined),
  onRefreshInvite: vi.fn(async () => undefined),
})

describe('PL-03 persistent lobby UI', () => {
  it('shows host/guest live member readiness, brand and only host-only start control', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene()} role="host" playerId="host" busy={false}
      code="ABCD-EFGH" inviteQr="data:image/png;base64,abcd" inviteText="secret-invite"
      hostIp="192.168.0.1" status="Conectado à rede local" {...callbacks} />)
    expect(screen.getByRole('img', { name: 'Galerows' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2 prontos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar rodada' }))
    expect(callbacks.onStart).toHaveBeenCalledOnce()
    expect(screen.getByRole('img', { name: 'QR de convite da sala' })).toBeInTheDocument()
  })

  it('does not offer host controls to a guest and toggles ready', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene()} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    expect(screen.queryByRole('button', { name: 'Iniciar rodada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Selecionar Cartas secretas' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pronto' }))
    expect(callbacks.onReady).toHaveBeenCalledWith(false)
  })

  it('requires personal interaction to reveal a private synthetic card', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    expect(screen.queryByText('ONLY-MINE')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revelar minha carta' }))
    expect(screen.getByText('ONLY-MINE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar minha carta' }))
    expect(screen.queryByText('ONLY-MINE')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encerrar rodada' })).not.toBeInTheDocument()
  })

  it('hides a revealed private card on app background and requires a new explicit reveal on return', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revelar minha carta' }))
    expect(screen.getByText('ONLY-MINE')).toBeInTheDocument()
    fireEvent(window, new Event('blur'))
    expect(screen.queryByText('ONLY-MINE')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revelar minha carta' })).toBeInTheDocument()
    expect(callbacks.onLeave).not.toHaveBeenCalled()
    expect(callbacks.onReconnect).not.toHaveBeenCalled()
  })

  it('conceals the card on Android-like document visibility loss, independently of a blur event', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revelar minha carta' }))
    expect(screen.getByText('ONLY-MINE')).toBeInTheDocument()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    try {
      fireEvent(document, new Event('visibilitychange'))
      expect(screen.queryByText('ONLY-MINE')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Revelar minha carta' })).toBeInTheDocument()
      expect(callbacks.onLeave).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
    }
  })

  it('does not reveal stale private card or allow game commands while disconnected', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene('playing')} role="guest" playerId="guest"
      busy={false} connected={false} status="Conexão interrompida" {...callbacks} />)
    expect(screen.queryByRole('button', { name: 'Revelar minha carta' })).not.toBeInTheDocument()
    expect(screen.queryByText('ONLY-MINE')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar pista/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reconectar/ })).toBeEnabled()
  })

  it('returns to the same lobby after results rather than closing the room', () => {
    const callbacks = actions()
    render(<LobbyRoomView snapshot={scene('results')} role="host" playerId="host" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao lobby' }))
    expect(callbacks.onBackToLobby).toHaveBeenCalledOnce()
    expect(callbacks.onClose).not.toHaveBeenCalled()
  })

  it('shows accumulated tournament scores and lets only the host end it from the lobby', () => {
    const callbacks = { ...actions(), onFinishSession: vi.fn(async () => undefined) }
    const snapshot = scene('lobby')
    snapshot.roomState.competition = { status: 'active', completedGames: 2, winnerPlayerIds: [],
      standings: [
        { playerId: 'host', displayName: 'Anfitrião', points: 2, played: 2, wins: 1 },
        { playerId: 'guest', displayName: 'Ana', points: 1, played: 2, wins: 1 },
      ] }
    render(<LobbyRoomView snapshot={snapshot} role="host" playerId="host" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Placar da sala' })).toBeInTheDocument()
    expect(screen.getByText('2 partidas pontuadas')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar disputa' }))
    expect(callbacks.onFinishSession).toHaveBeenCalledOnce()
  })

  it('displays tied champions and hides all new-game actions after the competition closes', () => {
    const callbacks = { ...actions(), onFinishSession: vi.fn() }
    const snapshot = scene('lobby')
    snapshot.roomState.selectedGameId = null
    snapshot.roomState.selectedConfig = null
    snapshot.roomState.competition = { status: 'finished', completedGames: 3,
      winnerPlayerIds: ['host', 'guest'], standings: [
        { playerId: 'host', displayName: 'Anfitrião', points: 3, played: 3, wins: 2 },
        { playerId: 'guest', displayName: 'Ana', points: 3, played: 3, wins: 2 },
      ] }
    render(<LobbyRoomView snapshot={snapshot} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Campeões da galera!' })).toBeInTheDocument()
    expect(screen.getByText('Ana e Anfitrião')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encerrar disputa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Iniciar rodada/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Estou pronto/i })).not.toBeInTheDocument()
  })

  it('does not grant a guest the host competition-ending action', () => {
    const callbacks = { ...actions(), onFinishSession: vi.fn() }
    const snapshot = scene('lobby')
    snapshot.roomState.competition = { status: 'active', completedGames: 1,
      winnerPlayerIds: [], standings: [
        { playerId: 'host', displayName: 'Anfitrião', points: 2, played: 1, wins: 1 },
        { playerId: 'guest', displayName: 'Ana', points: 0, played: 1, wins: 0 },
      ] }
    render(<LobbyRoomView snapshot={snapshot} role="guest" playerId="guest" busy={false}
      status="Conectado à rede local" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Placar da sala' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encerrar disputa' })).not.toBeInTheDocument()
  })

})
