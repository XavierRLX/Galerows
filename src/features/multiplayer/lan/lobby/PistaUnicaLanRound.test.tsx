import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { PistaUnicaLanRound } from './PistaUnicaLanRound'

afterEach(cleanup)
function scene(step: string = 'writing', guesser = 'host'): RoomSnapshotV2 {
  return { protocolVersion: 2, roomId: 'r', revision: 5, nextClientSeq: 2,
    roomState: { hostPlayerId: 'host', phase: 'playing', members: [
      { playerId: 'host', role: 'host', participation: 'active', ready: true, connected: true },
      { playerId: 'guest', role: 'guest', participation: 'active', ready: true, connected: true },
      { playerId: 'third', role: 'guest', participation: 'active', ready: true, connected: true }],
      selectedGameId: 'pista-unica', selectedConfig: { categories: ['words'] },
      currentGameSessionId: 's1', lastPublicResult: null, barriers: [] },
    gamePublicState: { gameId: 'pista-unica', gameSessionId: 's1', data: {
      step, round: 1, totalRounds: 3, guesserId: guesser, submittedCount: 0,
      requiredCount: 2, clues: step === 'guessing' ? ['Animal', 'Grande'] : [],
      excludedCount: 0, lastResult: null, scores: { host: 0, guest: 0, third: 0 } } },
    privateState: { gameId: 'pista-unica', gameSessionId: 's1',
      data: guesser === 'guest' ? { kind: 'guesser', submitted: false }
        : { kind: 'writer', target: 'Dinossauro', submitted: false } },
  }
}
const show = (snapshot = scene(), connected = true, isHost = false) => {
  const onAction = vi.fn(); const onEnd = vi.fn()
  const props = { snapshot, connected, isHost, busy: false,
    playerId: 'guest', onAction, onEnd }
  return { ...render(<PistaUnicaLanRound {...props} />), props, onAction, onEnd }
}

describe('G6 Pista Única private LAN screen', () => {
  it('shows writer target only on tap, hides on blur, and submits personal clue', () => {
    const s = show()
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar minha pista' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    expect(screen.getByText('Dinossauro')).toBeInTheDocument()
    fireEvent(window, new Event('blur'))
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    fireEvent.change(screen.getByLabelText('Minha pista'), { target: { value: 'Animal extinto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar minha pista' }))
    expect(s.onAction).toHaveBeenCalledWith('SUBMIT_CLUE', { text: 'Animal extinto' })
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
  })
  it('conceals target on connection loss and round transition', () => {
    const { rerender, props } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    rerender(<PistaUnicaLanRound {...props} connected={false} />)
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    rerender(<PistaUnicaLanRound {...props} connected />)
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    rerender(<PistaUnicaLanRound {...props} snapshot={scene('guessing')} />)
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
  })
  it('guesser sees shared filtered clues without secret and sends own answer', () => {
    const snap = scene('guessing', 'guest')
    const s = show(snap)
    expect(screen.getByText('Animal')).toBeInTheDocument()
    expect(screen.queryByText('Dinossauro')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver desafio secreto' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Meu palpite'), { target: { value: 'Dinossauro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar palpite' }))
    expect(s.onAction).toHaveBeenCalledWith('SUBMIT_GUESS', { text: 'Dinossauro' })
  })
  it('only host can advance after result and finalize after summary', () => {
    const snap = scene('round-result')
    snap.gamePublicState!.data = { ...(snap.gamePublicState!.data as Record<string, unknown>),
      lastResult: { round: 1, guesserId: 'host', target: 'Dinossauro', guessedText: 'Dino',
        correct: false, clueCount: 2, excludedCount: 0 } }
    const host = show(snap, true, true)
    expect(screen.getByText('Dinossauro')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima rodada' }))
    expect(host.onAction).toHaveBeenCalledWith('NEXT_ROUND', null)
    cleanup()
    show(snap)
    expect(screen.queryByRole('button', { name: 'Próxima rodada' })).not.toBeInTheDocument()
    cleanup()
    const done = scene('summary')
    const final = show(done, true, true)
    expect(screen.getByText('Resultado da Pista Única')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar partida e pontuar' }))
    expect(final.onEnd).toHaveBeenCalledOnce()
  })
})
