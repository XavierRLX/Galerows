import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'

beforeAll(async () => { await initializeI18n() })

describe('Impostor da Palavra complete flow', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraSession)
    await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraOpeningHistory)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
    useImpostorDaPalavraStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('creates guests and plays a full game with independent impostor draws', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/impostor-da-palavra']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /configurar partida/i }))
    const guestInput = await screen.findByRole('textbox', { name: /nome do convidado/i })
    for (const name of ['Ana', 'Bia', 'Caio']) {
      await user.type(guestInput, name)
      await user.click(screen.getByRole('button', { name: /adicionar/i }))
    }
    await user.click(screen.getByRole('button', { name: /iniciar partida/i }))

    for (let round = 0; round < 3; round += 1) {
      await passSecretInfo(user, 3)
      await user.click(await screen.findByRole('button', { name: /começar as pistas/i }))
      await user.click(await screen.findByRole('button', { name: /próximo jogador/i }))
      await user.click(screen.getByRole('button', { name: /próximo jogador/i }))
      await user.click(screen.getByRole('button', { name: /começar discussão/i }))
      await user.click(await screen.findByRole('button', { name: /escolher acusado/i }))
      const session = useImpostorDaPalavraStore.getState().session!
      const accused = session.participants.find((participant) => participant.id !== session.currentImpostorId)!
      await user.click(screen.getByRole('button', { name: accused.name }))
      await user.click(screen.getByRole('button', { name: new RegExp(`confirmar acusação: ${accused.name}`, 'i') }))
      expect(await screen.findByRole('heading', { name: /resumo da rodada/i })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: round === 2 ? /ver resultado/i : /próxima rodada/i }))
    }

    expect(await screen.findByRole('heading', { name: /bia venceu/i })).toBeInTheDocument()
    expect(screen.getByText(/6 pontos/i)).toBeInTheDocument()
    expect(screen.getAllByText(/0 pontos/i)).toHaveLength(2)
  })
})

async function passSecretInfo(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (let index = 0; index < count; index += 1) {
    await user.click(await screen.findByRole('button', { name: /mostrar minha informação/i }))
    await user.click(screen.getByRole('button', { name: /esconder e passar/i }))
  }
}
