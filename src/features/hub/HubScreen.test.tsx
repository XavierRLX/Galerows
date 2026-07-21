import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { gamesRegistry } from '../games/games.registry'
import type { GameFavoritesSnapshot } from '../games/gameFavorites.types'
import type { GameUsageSnapshot } from '../games/gameUsage.types'
import { HubScreen } from './HubScreen'

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => { await LocalPreferences.remove(STORAGE_KEYS.gameUsage); await LocalPreferences.remove(STORAGE_KEYS.gameFavorites) })
afterEach(async () => {
  cleanup()
  await LocalPreferences.remove(STORAGE_KEYS.gameUsage)
  await LocalPreferences.remove(STORAGE_KEYS.gameFavorites)
})

describe('HubScreen usage badges', () => {
  it('keeps the featured badge and shows a discovery badge for an unplayed game', async () => {
    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    expect(screen.getByText('Destaque')).toBeInTheDocument()
    expect(await screen.findByText('Recomendado')).toBeInTheDocument()
  })

  it('shows the recent badge when there is local usage history', async () => {
    await LocalPreferences.setJson<GameUsageSnapshot>(STORAGE_KEYS.gameUsage, {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 20, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        taboo: { openedCount: 1, lastOpenedAt: '2026-06-20T11:00:00.000Z' },
      },
    })

    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    expect(await screen.findByText('Recente')).toBeInTheDocument()
  })

  it('shows the favorite icon for a locally favorited game', async () => {
    await LocalPreferences.setJson<GameFavoritesSnapshot>(STORAGE_KEYS.gameFavorites, {
      schemaVersion: 1,
      favorites: [{ gameId: 'taboo', favoritedAt: '2026-06-20T10:00:00.000Z' }],
    })

    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    expect(await screen.findByLabelText('Jogo favorito')).toBeInTheDocument()
  })

  it('does not show a discovery badge when every available game has been opened', async () => {
    await LocalPreferences.setJson<GameUsageSnapshot>(STORAGE_KEYS.gameUsage, {
      schemaVersion: 1,
      games: Object.fromEntries(gamesRegistry.filter((game) => game.status === 'available').map((game) => [
        game.id,
        { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
      ])),
    })

    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    await waitFor(() => expect(screen.queryByText('Recomendado')).not.toBeInTheDocument())
  })
})
