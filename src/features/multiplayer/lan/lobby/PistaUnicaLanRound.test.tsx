import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { PistaUnicaLanRound } from './PistaUnicaLanRound'

afterEach(cleanup)
function scene(step: string = 'writing', guesser = 'host'): RoomSnapshotV2 {
  return { protocolVersion: 2, roomId: 'r', revision: 5, nextClientSeq: 2,
    roomState: { hostPlayerId: 'host', phase: 'playing', members: [
      { playerId: 'host', displayName:'host', role: 'host', participation: 'active', ready: true, connected: true },
      { playerId: 'guest', displayName:'guest', role: 'guest', participation: 'active', ready: true, connected: true },
      { playerId: 'third', displayName:'third', role: 'guest', participation: 'active', ready: true, connected: true }],
      selectedGameId: 'pista-unica', selectedConfig: { categories: ['words'] },
      currentGameSessionId: 's1', lastPublicResult: null, barriers: [] },
    gamePublicState: { gameId: 'pista-unica', gameSessionId: 's1', data: {
      step, round: 1, totalRounds: 3, guesserId: guesser, reviewerId: guesser === 'host' ? 'guest' : 'host', submittedCount: 0,
      requiredCount: 2, clues: step === 'guessing' ? ['Animal', 'Grande'] : [],
      excludedCount: 0, lastResult: null, scores: { host: 0, guest: 0, third: 0 } } },
    privateState: { gameId: 'pista-unica', gameSessionId: 's1',
      data: guesser === 'guest' ? { kind: 'guesser', submitted: false }
        : { kind: 'writer', target: 'Dinossauro', submitted: false,
          ...(step === 'review' ? { reviewClues: [
            { playerId:'guest', text:'Gigante', included:true, reason:null },
            { playerId:'third', text:'DINOSSAURO', included:false, reason:'answer' },
          ] } : {}) } },
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
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar encerramento' }))
    expect(final.onEnd).toHaveBeenCalledOnce()
  })
})

it('allows only the private assigned reviewer to exclude clues and confirm the review', () => {
  const s = show(scene('review'))
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByText('Gigante')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
  expect(screen.getByText('DINOSSAURO')).toBeInTheDocument()
  expect(screen.getByText(/Dica igual à palavra secreta/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reincluir pista de third' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Revisão: carta anterior' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remover pista de guest' }))
  expect(s.onAction).toHaveBeenCalledWith('SET_CLUE_INCLUDED',{playerId:'guest',included:false})
  fireEvent.click(screen.getByRole('button',{name:'Confirmar pistas'}))
  expect(s.onAction).toHaveBeenCalledWith('CONFIRM_CLUES',null)
  cleanup()
  show(scene('review','guest'))
  expect(screen.queryByText('Gigante')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Confirmar pistas'})).not.toBeInTheDocument()
})
it('shows round awards with two points for the guesser and one per valid hint', () => {
  const snap = scene('round-result')
  snap.gamePublicState!.data = { ...(snap.gamePublicState!.data as Record<string, unknown>),
    lastResult:{ round:1, guesserId:'host',target:'Dinossauro',guessedText:'Dinossauro',
      correct:true,clueCount:1,excludedCount:1,creditedPlayerIds:['guest'],
      awardedPoints:{host:2,guest:1} },
  }
  show(snap)
  expect(screen.getByText(/Acertou! \+2 pontos/)).toBeInTheDocument()
  const awards = screen.getByRole('region', { name: 'Pontuação da rodada' })
  expect(within(awards).getByText('guest').closest('.pw-award')).toHaveTextContent('+1')
})

it('exposes accessible received progress and preserves private review privacy on blur', () => {
  const { rerender, props } = show()
  expect(screen.getByRole('progressbar', { name: 'Pistas recebidas' })).toHaveAttribute('aria-valuenow', '0')
  rerender(<PistaUnicaLanRound {...props} snapshot={scene('review')} />)
  expect(screen.queryByText('Gigante')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByText('Gigante')).toBeInTheDocument()
  fireEvent(window, new Event('blur'))
  expect(screen.queryByText('Gigante')).not.toBeInTheDocument()
})
it('paginates reviewer cards, displays automatic/manual states and blocks offline review', () => {
  const snap = scene('review')
  snap.privateState!.data = { kind: 'writer', target: 'Dinossauro', submitted: true, reviewClues: [
    { playerId: 'guest', text: 'Gigante', included: false, reason: 'manual' },
    { playerId: 'third', text: 'Grande', included: false, reason: 'duplicate' },
  ] }
  const { rerender, props } = show(snap)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByText('Removida pelo revisor')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
  expect(screen.getByText('Repetida — removida automaticamente')).toBeInTheDocument()
  expect(screen.queryByText('Gigante')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Reincluir pista de third/ })).not.toBeInTheDocument()
  rerender(<PistaUnicaLanRound {...props} connected={false} />)
  expect(screen.queryByText('Grande')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Confirmar pistas' })).not.toBeInTheDocument()
})
it('requires host confirmation before ending and distinguishes totals from round awards', () => {
  const snap = scene('summary')
  snap.gamePublicState!.data = { ...(snap.gamePublicState!.data as Record<string, unknown>), scores: { host: 5, guest: 3, third: 0 } }
  const s = show(snap, true, true)
  expect(screen.getByText('5 pt')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar partida e pontuar' }))
  expect(s.onEnd).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar encerramento' }))
  expect(s.onEnd).toHaveBeenCalledOnce()
})

it.each([false, true])('allows retry after void-callback review failure (empty review: %s)', empty => {
  const snapshot = scene('review')
  if (empty) snapshot.privateState!.data = { kind: 'writer', target: 'Dinossauro', submitted: true, reviewClues: [
    { playerId: 'guest', text: 'Gigante', included: false, reason: 'manual' },
  ] }
  const s = show(snapshot)
  const confirm = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pistas' }))
    if (empty) fireEvent.click(screen.getByRole('button', { name: 'Concluir rodada' }))
  }
  confirm()
  expect(s.onAction).toHaveBeenCalledTimes(1)
  s.rerender(<PistaUnicaLanRound {...s.props} busy />)
  expect(screen.getByRole('button', { name: 'Abrir revisão privada' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(s.onAction).toHaveBeenCalledTimes(1)
  s.rerender(<PistaUnicaLanRound {...s.props} busy={false} error="Não foi possível enviar o comando." />)
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível enviar o comando.')
  expect(screen.getByRole('button', { name: 'Abrir revisão privada' })).toBeEnabled()
  confirm()
  expect(s.onAction).toHaveBeenCalledTimes(2)
  expect(s.onAction).toHaveBeenLastCalledWith('CONFIRM_CLUES', null)
  expect(screen.getByRole('button', { name: 'Abrir revisão privada' })).toBeDisabled()
  s.rerender(<PistaUnicaLanRound {...s.props} busy error="Não foi possível enviar o comando." />)
  s.rerender(<PistaUnicaLanRound {...s.props} busy={false} error="Não foi possível enviar o comando." />)
  expect(screen.getByRole('button', { name: 'Abrir revisão privada' })).toBeEnabled()
})

it.each(['clue', 'guess'] as const)('retains the %s draft and allows retry after provider failure', kind => {
  const s = show(kind === 'guess' ? scene('guessing', 'guest') : scene())
  if (kind === 'clue') fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
  fireEvent.change(screen.getByLabelText(kind === 'clue' ? 'Minha pista' : 'Meu palpite'), { target: { value: 'Animal' } })
  fireEvent.click(screen.getByRole('button', { name: kind === 'clue' ? 'Enviar minha pista' : 'Enviar palpite' }))
  s.rerender(<PistaUnicaLanRound {...s.props} busy />)
  s.rerender(<PistaUnicaLanRound {...s.props} busy={false} error="Falha de envio" />)
  if (kind === 'clue') fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
  expect(screen.getByDisplayValue('Animal')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: kind === 'clue' ? 'Enviar minha pista' : 'Enviar palpite' }))
  expect(s.onAction).toHaveBeenCalledTimes(2)
  expect(s.onAction).toHaveBeenLastCalledWith(kind === 'clue' ? 'SUBMIT_CLUE' : 'SUBMIT_GUESS', { text: 'Animal' })
})
