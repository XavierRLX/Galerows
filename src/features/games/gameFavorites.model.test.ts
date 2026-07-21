import { describe, expect, it } from 'vitest'
import { emptyGameFavoritesSnapshot, normalizeGameFavoritesSnapshot, toggleGameFavoriteInSnapshot } from './gameFavorites.model'

const availableGameIds = ['adedonha', 'mimica', 'taboo']

describe('game favorites model', () => {
  it('rejects malformed, duplicate, unavailable, and oversized snapshots', () => {
    expect(normalizeGameFavoritesSnapshot({ schemaVersion: 1, favorites: [{ gameId: 'adedonha', favoritedAt: 'invalid' }] }, availableGameIds)).toBe(emptyGameFavoritesSnapshot)
    expect(normalizeGameFavoritesSnapshot({ schemaVersion: 1, favorites: [{ gameId: 'adedonha', favoritedAt: '2026-01-01T00:00:00.000Z' }, { gameId: 'adedonha', favoritedAt: '2026-01-02T00:00:00.000Z' }] }, availableGameIds)).toBe(emptyGameFavoritesSnapshot)
    expect(normalizeGameFavoritesSnapshot({ schemaVersion: 1, favorites: [{ gameId: 'jogo-da-velha', favoritedAt: '2026-01-01T00:00:00.000Z' }] }, availableGameIds)).toEqual(emptyGameFavoritesSnapshot)
  })

  it('toggles an available game and ignores unavailable games', () => {
    const added = toggleGameFavoriteInSnapshot(emptyGameFavoritesSnapshot, 'adedonha', availableGameIds, new Date('2026-01-01T00:00:00.000Z'))
    expect(added.favorites.map((favorite) => favorite.gameId)).toEqual(['adedonha'])
    expect(toggleGameFavoriteInSnapshot(added, 'jogo-da-velha', availableGameIds)).toBe(added)
    expect(toggleGameFavoriteInSnapshot(added, 'adedonha', availableGameIds)).toEqual(emptyGameFavoritesSnapshot)
  })

  it('replaces the oldest favorite when a third game is added', () => {
    let snapshot = toggleGameFavoriteInSnapshot(emptyGameFavoritesSnapshot, 'adedonha', availableGameIds, new Date('2026-01-01T00:00:00.000Z'))
    snapshot = toggleGameFavoriteInSnapshot(snapshot, 'mimica', availableGameIds, new Date('2026-01-02T00:00:00.000Z'))
    snapshot = toggleGameFavoriteInSnapshot(snapshot, 'taboo', availableGameIds, new Date('2026-01-03T00:00:00.000Z'))
    expect(snapshot.favorites.map((favorite) => favorite.gameId)).toEqual(['mimica', 'taboo'])
  })
})
