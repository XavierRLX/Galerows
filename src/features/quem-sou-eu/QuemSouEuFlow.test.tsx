import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { useQuemSouEuStore } from './quemSouEu.store'

beforeAll(async () => { await initializeI18n() })

describe('Quem Sou Eu complete flow', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    await LocalPreferences.remove(STORAGE_KEYS.quemSouEuSession)
    useQuemSouEuStore.setState({ session: null, initialized: false, loading: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates words, reveals them after countdown, and shows a simple summary', async () => {
    render(<MemoryRouter initialEntries={['/games/quem-sou-eu/setup']}><AppRoutes /></MemoryRouter>)

    fireEvent.change(screen.getByRole('textbox', { name: /palavra 1/i }), { target: { value: 'Beyonce' } })
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /palavra 2/i }), { target: { value: 'Wi-Fi' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar jogo/i }))
    await act(async () => {})

    expect(screen.getByText(/prepare a testa/i)).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('heading', { name: 'Beyonce' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /acertei/i }))
    await act(async () => {})

    expect(screen.getByText(/2 de 2/i)).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('heading', { name: 'Wi-Fi' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pular/i }))
    await act(async () => {})

    expect(screen.getByRole('heading', { name: /rodada concluída/i })).toBeInTheDocument()
    expect(screen.getByText('Beyonce')).toBeInTheDocument()
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument()
    expect(screen.getByText('Acertou')).toBeInTheDocument()
    expect(screen.getByText('Pulou')).toBeInTheDocument()
  })

  it('keeps suggestions hidden until the player asks to show them', () => {
    render(<MemoryRouter initialEntries={['/games/quem-sou-eu/setup']}><AppRoutes /></MemoryRouter>)

    expect(screen.queryByText('Pessoas e personagens')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mostrar sugestões/i }))
    expect(screen.getByText('Pessoas e personagens')).toBeInTheDocument()
  })
})
