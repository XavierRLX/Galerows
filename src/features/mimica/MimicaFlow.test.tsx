import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { useMimicaStore } from './mimica.store'
import { usePlayersStore } from '../players/players.store'

beforeAll(async () => { await initializeI18n() })

describe('Mimica complete flow', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    await LocalPreferences.remove(STORAGE_KEYS.mimicaSession)
    await LocalPreferences.remove(STORAGE_KEYS.mimicaOpeningHistory)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
    useMimicaStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('creates guests, scores actor and guesser, and reaches the result', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/mimica']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /configurar partida/i }))
    const guestInput = await screen.findByRole('textbox', { name: /nome do convidado/i })
    for (const name of ['Ana', 'Bia']) {
      await user.type(guestInput, name)
      await user.click(screen.getByRole('button', { name: /adicionar/i }))
    }
    await user.click(screen.getAllByRole('button', { name: '1' })[0])
    await user.click(screen.getByRole('button', { name: /iniciar jogo/i }))
    await user.click(await screen.findByRole('button', { name: /ver carta/i }))
    await user.click(await screen.findByRole('button', { name: /escovar os dentes/i }))
    await user.click(await screen.findByRole('button', { name: /registrar resultado/i }))
    await user.click(await screen.findByRole('button', { name: /Bia/i }))
    await user.click(await screen.findByRole('button', { name: /próximo turno/i }))
    await user.click(await screen.findByRole('button', { name: /ver carta/i }))
    await user.click(await screen.findByRole('button', { name: /levantar um troféu/i }))
    await user.click(await screen.findByRole('button', { name: /registrar resultado/i }))
    await user.click(await screen.findByRole('button', { name: /Ana/i }))
    await user.click(await screen.findByRole('button', { name: /ver resumo da rodada/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    expect(await screen.findByRole('heading', { name: /Bia venceu/i })).toBeInTheDocument()
    expect(screen.getByText('7 pontos')).toBeInTheDocument()
  })
})
