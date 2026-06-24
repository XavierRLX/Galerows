import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { gamesRegistry } from '../games/games.registry'
import type { GameUsageSnapshot } from '../games/gameUsage.types'
import { HubScreen } from './HubScreen'

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => { await LocalPreferences.remove(STORAGE_KEYS.gameUsage) })
afterEach(async () => {
  cleanup()
  await LocalPreferences.remove(STORAGE_KEYS.gameUsage)
})

describe('HubScreen usage badges', () => {
  it('keeps the featured badge and shows a discovery badge for an unplayed game', async () => {
    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    expect(screen.getByText('Destaque')).toBeInTheDocument()
    expect(await screen.findByText('Recomendado')).toBeInTheDocument()
  })

  it('shows the most played badge when there is local usage history', async () => {
    await LocalPreferences.setJson<GameUsageSnapshot>(STORAGE_KEYS.gameUsage, {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        taboo: { openedCount: 3, lastOpenedAt: '2026-06-20T11:00:00.000Z' },
      },
    })

    render(<MemoryRouter><HubScreen /></MemoryRouter>)

    expect(await screen.findByText('Recente')).toBeInTheDocument()
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
