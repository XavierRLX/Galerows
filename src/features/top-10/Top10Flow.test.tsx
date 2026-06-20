import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useTop10Store } from './top10.store'

beforeAll(async () => { await initializeI18n() })

describe('Top 10 complete flow', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    await LocalPreferences.remove(STORAGE_KEYS.top10Session)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
    useTop10Store.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('starts, scores an answer, advances summary, and shows the result', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/top-10']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /configurar partida/i }))
    const guestInput = await screen.findByRole('textbox', { name: /nome do convidado/i })
    for (const name of ['Ana', 'Bia']) {
      await user.type(guestInput, name)
      await user.click(screen.getByRole('button', { name: /adicionar/i }))
    }
    expect(screen.getByRole('button', { name: /iniciar jogo/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Ana/i }))
    await user.click(screen.getByRole('button', { name: /iniciar jogo/i }))
    expect(await screen.findByText(/Mediador: Ana/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /resposta oculta/i })[0]).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /ver gabarito/i }))
    expect((await screen.findAllByText(/Avatar|India|Miroslav/i)).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /10 pontos/i })[0])
    expect(screen.queryByRole('button', { name: /Ana \+10/i })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Bia/i }))
    expect(await screen.findByText(/Bia ganhou 10 pontos/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /encerrar carta/i }))
    await user.click(await screen.findByRole('button', { name: /próxima carta/i }))
    expect(await screen.findByText(/Mediador: Bia/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /encerrar carta/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    expect(await screen.findByRole('heading', { name: /Bia venceu/i })).toBeInTheDocument()
    expect(screen.getByText('10 pontos')).toBeInTheDocument()
  })
})
