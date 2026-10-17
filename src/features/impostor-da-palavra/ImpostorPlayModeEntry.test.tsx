import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => {
  await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraSession)
  usePlayersStore.setState({ group: null, hydrated: false, error: null })
  useImpostorDaPalavraStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
})

describe('Impostor game mode entry', () => {
  it('explains a one-phone game and enters local setup without creating a LAN room', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/impostor-da-palavra']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /como vocês vão jogar/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^1 celular/i }))
    const single = screen.getByRole('button', { name: /configurar partida.*1 celular/i })
    expect(single).toBeEnabled()
    await user.click(single)
    expect(await screen.findByRole('heading', { name: /quem vai jogar/i })).toBeInTheDocument()
  })

  it('does not offer an inoperative LAN shortcut on unsupported platforms', async () => {
    render(<MemoryRouter initialEntries={['/games/impostor-da-palavra']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /como vocês vão jogar/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    expect(screen.queryByRole('button', { name: /^criar sala/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^entrar em sala/i })).not.toBeInTheDocument()
    expect(screen.getByText(/disponível no android com multiplayer lan/i)).toBeInTheDocument()
  })
})
