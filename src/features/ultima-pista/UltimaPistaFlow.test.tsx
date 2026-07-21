import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../../app/routes'
import i18n, { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { useUltimaPistaStore } from './ultimaPista.store'

beforeAll(async () => { await initializeI18n() })

describe('Última Pista complete flow', () => {
  beforeEach(async () => {
    cleanup()
    await i18n.changeLanguage('pt-BR')
    await LocalPreferences.remove(STORAGE_KEYS.ultimaPistaProgress)
    useUltimaPistaStore.setState({ deck: null, progress: null, initialized: false, loading: false })
  })

  it('opens the immersive story directly and toggles the persisted solved state', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/ultima-pista']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /antes de começar/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /abrir baralho/i }))
    expect(await screen.findByRole('heading', { name: /a voz depois da meia-noite/i })).toBeInTheDocument()
    expect(screen.queryByText(/Dário descobriu que o produtor Lúcio desviava dinheiro/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /escolher esta carta/i }))
    expect(await screen.findByText(/Dário descobriu que o produtor Lúcio desviava dinheiro/i)).toBeInTheDocument()
    expect(screen.getByText(/Um radialista é encontrado morto/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mostrar verso|voltar ao baralho/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /marcar como resolvida/i }))
    expect(await screen.findByRole('button', { name: /desmarcar como resolvida/i })).toBeInTheDocument()

    const saved = await LocalPreferences.getJson<{ solvedCardIds: number[] }>(STORAGE_KEYS.ultimaPistaProgress)
    expect(saved?.solvedCardIds).toEqual([1])

    await user.click(screen.getByRole('button', { name: /desmarcar como resolvida/i }))
    expect(await screen.findByRole('button', { name: /marcar como resolvida/i })).toBeInTheDocument()
    const updated = await LocalPreferences.getJson<{ solvedCardIds: number[] }>(STORAGE_KEYS.ultimaPistaProgress)
    expect(updated?.solvedCardIds).toEqual([])

    await user.click(screen.getByRole('button', { name: /fechar história e voltar à carta/i }))
    expect(await screen.findByRole('button', { name: /escolher esta carta/i })).toBeInTheDocument()
    expect(screen.queryByText(/Dário descobriu que o produtor Lúcio desviava dinheiro/i)).not.toBeInTheDocument()
  })

  it('changes cards by swiping in either direction', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/ultima-pista']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /abrir baralho/i }))

    const card = await screen.findByLabelText(/deslize para trocar de carta/i)
    fireEvent.pointerDown(card, { clientX: 240 })
    fireEvent.pointerUp(card, { clientX: 100 })
    expect(await screen.findByRole('heading', { name: /cabine entre estações/i })).toBeInTheDocument()

    const nextCard = screen.getByLabelText(/deslize para trocar de carta/i)
    fireEvent.pointerDown(nextCard, { clientX: 100 })
    fireEvent.pointerUp(nextCard, { clientX: 240 })
    expect(await screen.findByRole('heading', { name: /a voz depois da meia-noite/i })).toBeInTheDocument()
  })
})
