import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Capacitor } from '@capacitor/core'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'

beforeAll(async () => { await initializeI18n() })
afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await LocalPreferences.remove(STORAGE_KEYS.gameFavorites)
  await LocalPreferences.remove(STORAGE_KEYS.gameUsage)
})

describe('G5D — acesso à LAN dentro de Minha Galera', () => {
  it('keeps initial catalog clean and routes through the people icon to enter/create LAN rooms', async () => {
    vi.stubEnv('VITE_GAMES_FIRST_LAN_ENTRY', '1')
    vi.stubEnv('VITE_LAN_PERSISTENT_LOBBY_UI', '1')
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const { HubScreen } = await import('../hub/HubScreen')
    const { PlayersScreen } = await import('./PlayersScreen')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HubScreen />} />
        <Route path="/players" element={<PlayersScreen />} />
        <Route path="/__lan-lobby-v2/entrar" element={<p>Rota de entrar na sala</p>} />
        <Route path="/__lan-lobby-v2/criar" element={<p>Rota de criar sala</p>} />
      </Routes>
    </MemoryRouter>)

    expect(screen.getAllByRole('button', { name: /^Jogar agora / })).toHaveLength(10)
    expect(screen.queryByRole('heading', { name: 'Jogar com a galera' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar sala' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Minha Galera' }))
    expect(await screen.findByRole('heading', { name: 'Seu grupo de jogadores' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da galera')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Criar sala' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar em sala' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Criar sala' }))
    expect(screen.getByText('Rota de criar sala')).toBeInTheDocument()
  })

  it('opens the join flow from Minha Galera without requiring a saved group', async () => {
    vi.stubEnv('VITE_GAMES_FIRST_LAN_ENTRY', '1')
    vi.stubEnv('VITE_LAN_PERSISTENT_LOBBY_UI', '1')
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const { PlayersScreen } = await import('./PlayersScreen')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/players']}>
      <Routes>
        <Route path="/players" element={<PlayersScreen />} />
        <Route path="/__lan-lobby-v2/entrar" element={<p>Rota de entrar na sala</p>} />
      </Routes>
    </MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Entrar em sala' }))
    expect(screen.getByText('Rota de entrar na sala')).toBeInTheDocument()
  })
})
