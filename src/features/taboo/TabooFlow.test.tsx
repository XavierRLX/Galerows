import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useTabooStore } from './taboo.store'

beforeAll(async () => { await initializeI18n() })

describe('Taboo complete flow', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    await LocalPreferences.remove(STORAGE_KEYS.tabooSession)
    await LocalPreferences.remove(STORAGE_KEYS.tabooOpeningHistory)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
    useTabooStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('creates guests, scores a guesser, skips, and reaches the result', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/taboo']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /configurar partida/i }))
    const guestInput = await screen.findByRole('textbox', { name: /nome do convidado/i })
    for (const name of ['Ana', 'Bia']) {
      await user.type(guestInput, name)
      await user.click(screen.getByRole('button', { name: /adicionar/i }))
    }
    await user.click(screen.getByRole('button', { name: /iniciar jogo/i }))
    await user.click(await screen.findByRole('button', { name: /começar turno/i }))
    await user.click(await screen.findByRole('button', { name: /acertou/i }))
    await user.click(screen.getByRole('button', { name: 'Ana' }))
    await user.click(screen.getByRole('button', { name: /pular/i }))
    await user.click(screen.getByRole('button', { name: /encerrar/i }))
    await user.click(await screen.findByRole('button', { name: /próximo turno/i }))
    await user.click(await screen.findByRole('button', { name: /começar turno/i }))
    await user.click(await screen.findByRole('button', { name: /encerrar/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    expect(await screen.findByRole('heading', { name: /Ana venceu/i })).toBeInTheDocument()
    expect(screen.getByText('1 pontos')).toBeInTheDocument()
  })
})
