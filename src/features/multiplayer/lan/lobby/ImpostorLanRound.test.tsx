import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { ImpostorLanRound } from './ImpostorLanRound'

afterEach(cleanup)

function frame(step: string = 'reveal', id = 'round-A'): RoomSnapshotV2 {
  return {
    protocolVersion: 2, roomId: 'room', revision: 6, nextClientSeq: 4,
    roomState: { hostPlayerId: 'host', phase: 'playing', members: [
      { playerId: 'host', role: 'host', ready: true, connected: true, participation: 'active' },
      { playerId: 'guest', role: 'guest', ready: true, connected: true, participation: 'active' },
      { playerId: 'third', role: 'guest', ready: true, connected: true, participation: 'active' },
    ], selectedGameId: 'impostor-da-palavra', selectedConfig: { impostorMode: 'no-word', conversationMode: 'one-word' },
    currentGameSessionId: id, lastPublicResult: null, barriers: [] },
    gamePublicState: { gameSessionId: id, gameId: 'impostor-da-palavra', data: {
      step, mode: 'no-word', conversationMode: 'one-word', seenCount: 2, totalPlayers: 3,
      speakingOrder: ['host', 'guest', 'third'], currentSpeaker: 'guest',
      accusedId: null, winner: null, reason: null, result: null,
    } },
    privateState: { gameSessionId: id, gameId: 'impostor-da-palavra',
      data: { kind: 'word', word: 'Garrafa de água', wasSeen: false } },
  }
}

const actions = () => ({ onAction: vi.fn(), onEnd: vi.fn() })
function show(snapshot = frame(), opts: { isHost?: boolean; connected?: boolean; callbacks?: ReturnType<typeof actions> } = {}) {
  const callbacks = opts.callbacks ?? actions()
  const props = { snapshot, playerId: 'guest', isHost: opts.isHost ?? false, busy: false,
    connected: opts.connected ?? true, ...callbacks }
  return { ...render(<ImpostorLanRound {...props} />), callbacks, props }
}

describe('G5B LAN impostor private-screen lifecycle', () => {
  it('requires a deliberate tap before revealing a private word, then conceals on blur', () => {
    show()
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha palavra' }))
    expect(screen.getByText('Garrafa de água')).toBeInTheDocument()
    fireEvent(window, new Event('blur'))
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('never auto-reveals an earlier card after a connection drops and recovers', () => {
    const { rerender, props } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha palavra' }))
    expect(screen.getByText('Garrafa de água')).toBeInTheDocument()
    rerender(<ImpostorLanRound {...props} connected={false} />)
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
    rerender(<ImpostorLanRound {...props} connected />)
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('conceals information when the round advances from revelation to conversation', () => {
    const { rerender, props } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha palavra' }))
    expect(screen.getByText('Garrafa de água')).toBeInTheDocument()
    rerender(<ImpostorLanRound {...props} snapshot={frame('clues')} />)
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('does not carry a revealed card into a different GameSession', () => {
    const { rerender, props } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha palavra' }))
    rerender(<ImpostorLanRound {...props} snapshot={frame('reveal', 'round-B')} />)
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('sends only this member confirmation after a personal reveal', () => {
    const { callbacks } = show()
    expect(screen.getByRole('button', { name: /Já vi minha informação/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha palavra' }))
    fireEvent.click(screen.getByRole('button', { name: /Já vi minha informação/i }))
    expect(callbacks.onAction).toHaveBeenCalledWith('ACK_BRIEFING', null)
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('does not show a personal card or allow commands without an active connection', () => {
    show(frame(), { connected: false })
    expect(screen.queryByRole('button', { name: 'Ver minha palavra' })).not.toBeInTheDocument()
    expect(screen.queryByText('Garrafa de água')).not.toBeInTheDocument()
  })

  it('hides host moderation controls from guests while allowing the actual impostor one guess', () => {
    const guess = frame('final-guess')
    guess.gamePublicState!.data = {
      ...(guess.gamePublicState!.data as Record<string, unknown>), accusedId: 'guest',
    }
    const { callbacks } = show(guess)
    expect(screen.queryByRole('button', { name: /desistiu/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Qual era a palavra verdadeira/i), { target: { value: 'PIZZA' } })
    fireEvent.click(screen.getByRole('button', { name: /Tentar roubar a palavra/i }))
    expect(callbacks.onAction).toHaveBeenCalledWith('GUESS_WORD', { word: 'PIZZA' })
  })
})
