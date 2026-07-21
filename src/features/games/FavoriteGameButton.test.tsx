import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { FavoriteGameButton } from './FavoriteGameButton'

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => { await LocalPreferences.remove(STORAGE_KEYS.gameFavorites) })
afterEach(async () => { await LocalPreferences.remove(STORAGE_KEYS.gameFavorites) })

describe('FavoriteGameButton', () => {
  it('toggles a game favorite from a game information header action', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><FavoriteGameButton gameId="adedonha" /></MemoryRouter>)

    const button = await screen.findByRole('button', { name: 'Favoritar jogo' })
    await user.click(button)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remover dos favoritos' })).toBeInTheDocument())
  })
})
