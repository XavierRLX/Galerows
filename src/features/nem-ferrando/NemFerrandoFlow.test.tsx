import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useNemFerrandoStore } from './nemFerrando.store'

beforeAll(async () => { await initializeI18n() })
describe('Nem Ferrando complete flow', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    await LocalPreferences.remove(STORAGE_KEYS.nemFerrandoSession)
    await LocalPreferences.remove(STORAGE_KEYS.nemFerrandoOpeningHistory)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
    useNemFerrandoStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('creates temporary players and plays until someone reaches the limit', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/nem-ferrando']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /configurar partida/i }))
    const guestInput = await screen.findByRole('textbox', { name: /nome do convidado/i })
    await user.type(guestInput, 'Ana')
    await user.click(screen.getByRole('button', { name: /adicionar/i }))
    await user.type(guestInput, 'Bia')
    await user.click(screen.getByRole('button', { name: /adicionar/i }))
    await user.click(screen.getByRole('button', { name: /iniciar partida/i }))
    expect(await screen.findByRole('heading', { name: /Ana começa/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /revelar primeira carta/i }))
    expect(screen.getByText(/Passagem 1 · carta 1 de 4/i)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /trocar carta/i }))
    expect(screen.getByText('Carta #03')).toBeInTheDocument()

    for (let round = 0; round < 3; round += 1) {
      const choices = await screen.findAllByRole('button', { name: /circunferência|altitude|percentual|velocidade|potência|tempo aproximado|quantidade|batimentos|área|distância|luz do sol|luas conhecidas/i })
      await user.click(choices[0])
      await user.click(screen.getByRole('button', { name: /nem ferrando/i }))
      await user.click(screen.getByRole('button', { name: /revelar resposta/i }))
      const penaltyButton = screen.getAllByRole('button').find((button) => /^Ana\d+ → \d+$/.test(button.textContent ?? ''))
      expect(penaltyButton).toBeDefined()
      await user.click(penaltyButton!)
      expect(await screen.findByRole('heading', { name: /resumo da rodada/i })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: round === 2 ? /ver resultado/i : /continuar/i }))
    }

    expect(await screen.findByRole('heading', { name: /Bia venceu/i })).toBeInTheDocument()
    expect(screen.getByText('11 Ferros')).toBeInTheDocument()
  })
})
