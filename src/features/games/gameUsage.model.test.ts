import { describe, expect, it } from 'vitest'
import { gamesRegistry } from './games.registry'
import { emptyGameUsageSnapshot, getDiscoverGameId, getMostPlayedGameId, getMostRecentlyOpenedGameId, normalizeGameUsageSnapshot, recordGameOpenedInSnapshot } from './gameUsage.model'
import type { GameUsageSnapshot } from './gameUsage.types'

describe('game usage model', () => {
  it('increments opened count and updates last opened date', () => {
    const firstOpenedAt = new Date('2026-06-20T10:00:00.000Z')
    const secondOpenedAt = new Date('2026-06-20T11:00:00.000Z')

    let snapshot = recordGameOpenedInSnapshot(emptyGameUsageSnapshot, 'nem-ferrando', firstOpenedAt)
    snapshot = recordGameOpenedInSnapshot(snapshot, 'nem-ferrando', secondOpenedAt)

    expect(snapshot.games['nem-ferrando']).toEqual({
      openedCount: 2,
      lastOpenedAt: secondOpenedAt.toISOString(),
    })
  })

  it('ignores invalid snapshots', () => {
    expect(normalizeGameUsageSnapshot({ schemaVersion: 1, games: { taboo: { openedCount: -1, lastOpenedAt: 'today' } } })).toBe(emptyGameUsageSnapshot)
    expect(normalizeGameUsageSnapshot({ schemaVersion: 2, games: {} })).toBe(emptyGameUsageSnapshot)
  })

  it('chooses the most played available game by count, then recency, then registry order', () => {
    const snapshot = {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 2, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'impostor-da-palavra': { openedCount: 3, lastOpenedAt: '2026-06-20T09:00:00.000Z' },
        taboo: { openedCount: 3, lastOpenedAt: '2026-06-20T11:00:00.000Z' },
        damas: { openedCount: 10, lastOpenedAt: '2026-06-20T12:00:00.000Z' },
      },
    } as const

    expect(getMostPlayedGameId(gamesRegistry, snapshot)).toBe('taboo')
    expect(getMostPlayedGameId(gamesRegistry, {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 2, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'impostor-da-palavra': { openedCount: 2, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
      },
    })).toBe('nem-ferrando')
  })

  it('chooses the most recently opened available game regardless of play count', () => {
    const snapshot: GameUsageSnapshot = {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 20, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        taboo: { openedCount: 1, lastOpenedAt: '2026-06-20T11:00:00.000Z' },
        damas: { openedCount: 1, lastOpenedAt: '2026-06-20T12:00:00.000Z' },
      },
    }

    expect(getMostRecentlyOpenedGameId(gamesRegistry, snapshot)).toBe('taboo')
  })

  it('chooses an available unplayed game for discovery and avoids the featured game when possible', () => {
    const snapshot = {
      schemaVersion: 1,
      games: {
        'nem-ferrando': { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'impostor-da-palavra': { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        taboo: { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'quem-sou-eu': { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        adedonha: { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        mimica: { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'top-10': { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
        'jogo-da-velha': { openedCount: 0, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
      },
    } as const

    expect(getDiscoverGameId(gamesRegistry, snapshot, 'cidade-dorme', () => 0)).toBe('pista-unica')
    expect(getDiscoverGameId(gamesRegistry, emptyGameUsageSnapshot, 'cidade-dorme', () => 0)).toBe('pista-unica')
  })

  it('does not choose a discovery game when every available game has been opened', () => {
    const snapshot: GameUsageSnapshot = {
      schemaVersion: 1,
      games: Object.fromEntries(gamesRegistry.filter((game) => game.status === 'available').map((game) => [
        game.id,
        { openedCount: 1, lastOpenedAt: '2026-06-20T10:00:00.000Z' },
      ])),
    }

    expect(getDiscoverGameId(gamesRegistry, snapshot, 'cidade-dorme', () => 0)).toBeNull()
  })
})
