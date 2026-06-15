import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { useAdedonhaStore } from './adedonha.store'

beforeAll(async () => { await initializeI18n() })

describe('Adedonha flow', () => {
  beforeEach(async () => {
    await LocalPreferences.remove(STORAGE_KEYS.adedonhaSession)
    useAdedonhaStore.setState({ session: null, initialized: false, loading: false })
  })

  it('creates categories and lets the player fill answers', async () => {
    render(<MemoryRouter initialEntries={['/games/adedonha/setup']}><AppRoutes /></MemoryRouter>)

    fireEvent.change(screen.getByRole('textbox', { name: /novo tema/i }), { target: { value: 'Minha sogra é...' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    fireEvent.click(screen.getByRole('button', { name: /começar folha/i }))

    expect(await screen.findByText(/letra da rodada/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /começar respostas/i }))
    const input = (await screen.findAllByPlaceholderText(/resposta com/i))[0]
    fireEvent.change(input, { target: { value: 'Ana' } })
    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /finalizar e pontuar/i }))
    expect(await screen.findByText(/pontuação/i)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: '10' })[0])
    fireEvent.click(screen.getByRole('button', { name: /ver resumo/i }))
    expect(await screen.findByText(/resumo da rodada/i)).toBeInTheDocument()
    expect(screen.getAllByText(/10 pts/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/rodadas salvas/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /finalizar partida/i }))
    expect(await screen.findByText(/partida finalizada/i)).toBeInTheDocument()
  })
})
