import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { createPistaUnicaSession } from './pistaUnica.session'
import { getPistaUnicaTarget } from './pistaUnica.content'
import { usePistaUnicaStore } from './pistaUnica.store'
import { PistaUnicaPlayScreen } from './PistaUnicaPlayScreen'
import { PistaUnicaSetupScreen } from './PistaUnicaSetupScreen'
import { PistaUnicaResultScreen } from './PistaUnicaResultScreen'
import type { PistaUnicaSession } from './pistaUnica.types'

beforeAll(async () => { await initializeI18n() })
afterEach(() => { cleanup(); localStorage.clear(); usePistaUnicaStore.setState({ session: null, initialized: false, loading: false }) })
const participants = ['Ana', 'Bia', 'Caio', 'Dani', 'Eva'].map((name, i) => ({ id: String(i), name, isGuest: true }))
const session = (phase: PistaUnicaSession['phase'] = 'pass-clue') => ({ ...createPistaUnicaSession(participants, ['words'], () => 0), phase })
async function play(value: PistaUnicaSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.pistaUnicaSession, value)
  await act(async () => { render(<MemoryRouter initialEntries={['/play']}><Routes>
    <Route path="/play" element={<PistaUnicaPlayScreen />} />
    <Route path="/games/pista-unica/result" element={<PistaUnicaResultScreen />} />
    <Route path="/games/pista-unica/setup" element={<PistaUnicaSetupScreen />} />
  </Routes></MemoryRouter>) })
}
describe('Oficina das Pistas on one phone', () => {
  it('keeps a resumed private target concealed until its author reveals it and conceals again on blur', async () => {
    const value = session('write-clue'); const target = getPistaUnicaTarget(value.currentTargetId)!.title
    await play(value)
    expect(screen.queryByText(target)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    expect(screen.getByText(target)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Sua pista'), { target: { value: 'Animal' } })
    fireEvent(window, new Event('blur'))
    expect(screen.queryByText(target)).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Animal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver desafio secreto' }))
    expect(screen.getByDisplayValue('Animal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar pista' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Passe para Caio' })).toBeInTheDocument())
    expect(screen.queryByText(target)).not.toBeInTheDocument()
  })
  it('shows truthful automatic review stamps, preserves edits across card pages and releases only valid cards', async () => {
    const value = session('review'); const target = getPistaUnicaTarget(value.currentTargetId)!.title
    value.clues = [
      { id: 'a', participantId: '1', text: 'Grande', included: true },
      { id: 'b', participantId: '2', text: 'gránde', included: true },
      { id: 'c', participantId: '3', text: target, included: true },
      { id: 'd', participantId: '4', text: 'Animal', included: false },
    ]
    await play(value)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
    expect(screen.getByText('Repetida — anulada')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Editar pista de Bia' }), { target: { value: 'Gigante' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: carta anterior' }))
    expect(screen.getByDisplayValue('Gigante')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
    expect(screen.getByText('Igual à resposta — anulada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
    expect(screen.getByText('Removida manualmente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar para quem adivinha' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Qual é o desafio?' })).toBeInTheDocument())
    expect(screen.getByText('Gigante')).toBeInTheDocument()
    expect(screen.queryByText(target)).not.toBeInTheDocument()
    expect(screen.queryByText('Animal')).not.toBeInTheDocument()
  })
  it('finishes a zero-clue round with no awards after an explicit confirmation', async () => {
    const value = session('review'); value.clues = [{ id: 'a', participantId: '1', text: 'Animal', included: false }]
    await play(value)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir sem pistas válidas' }))
    expect(usePistaUnicaStore.getState().session?.phase).toBe('review')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Concluir rodada' }))
    await waitFor(() => expect(screen.getByText('0 pontos nesta rodada')).toBeInTheDocument())
    expect(usePistaUnicaStore.getState().session?.scores).toEqual({ '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 })
  })
  it('shows each credited author and +2 for the guesser, with a safe legacy result fallback', async () => {
    const value = session('round-result')
    value.lastRoundResult = { round: 1, guesserId: '0', targetId: value.currentTargetId, correct: true, clueCount: 1, creditedPlayerIds: ['1'] }
    await play(value)
    const awards = screen.getByRole('region', { name: 'Pontuação da rodada' })
    expect(within(awards).getByText('Ana')).toBeInTheDocument()
    expect(within(awards).getByText('+2')).toBeInTheDocument()
    expect(within(awards).getByText('Bia')).toBeInTheDocument()
    expect(within(awards).getByText('+1')).toBeInTheDocument()
    cleanup(); delete value.lastRoundResult.creditedPlayerIds
    await play(value)
    expect(screen.getByText('Créditos das pistas indisponíveis nesta partida antiga.')).toBeInTheDocument()
  })
  it('paginates final totals without treating round awards as totals, then replays into setup', async () => {
    const value = session('finished'); value.scores = { '0': 2, '1': 7, '2': 4, '3': 0, '4': 1 }
    await play(value)
    const ranking = screen.getByRole('region', { name: 'Pontos desta partida' })
    expect(within(ranking).getByText('7 pt')).toBeInTheDocument()
    expect(within(ranking).queryByText('Dani')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Classificação: próxima carta' }))
    expect(within(ranking).getByText('Dani')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova partida' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Quem vai jogar?' })).toBeInTheDocument())
    expect(usePistaUnicaStore.getState().session).toBeNull()
  })
})

it('prepares guests on a compact two-step table and keeps at least one category selected', async () => {
  await act(async () => { render(<MemoryRouter initialEntries={['/setup']}><Routes><Route path="/setup" element={<PistaUnicaSetupScreen />} /><Route path="/games/pista-unica/play" element={<PistaUnicaPlayScreen />} /></Routes></MemoryRouter>) })
  for (const name of ['Ana', 'Bia', 'Caio']) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do convidado' }), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar convidado' }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Escolher categorias' }))
  const movies = screen.getByRole('button', { name: /Filmes/ })
  const series = screen.getByRole('button', { name: /Séries/ })
  fireEvent.click(movies); fireEvent.click(series)
  fireEvent.click(screen.getByRole('button', { name: /Palavras/ }))
  expect(screen.getByRole('button', { name: /Palavras/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Começar partida' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Passe para Bia' })).toBeInTheDocument())
  expect(usePistaUnicaStore.getState().session?.selectedCategories).toEqual(['words'])
  expect(usePistaUnicaStore.getState().session?.participants.map(p => p.name)).toEqual(['Ana', 'Bia', 'Caio'])
})
