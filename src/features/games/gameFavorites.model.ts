import type { GameFavoritesSnapshot } from './gameFavorites.types'

export const maxFavoriteGames = 2

export const emptyGameFavoritesSnapshot: GameFavoritesSnapshot = {
  schemaVersion: 1,
  favorites: [],
}

export function normalizeGameFavoritesSnapshot(value: unknown, availableGameIds: readonly string[]): GameFavoritesSnapshot {
  if (!isGameFavoritesSnapshot(value)) return emptyGameFavoritesSnapshot

  const availableIds = new Set(availableGameIds)
  const favorites = value.favorites.filter((favorite) => availableIds.has(favorite.gameId))
  if (favorites.length > maxFavoriteGames) return emptyGameFavoritesSnapshot
  return { schemaVersion: 1, favorites }
}

export function toggleGameFavoriteInSnapshot(
  snapshot: GameFavoritesSnapshot,
  gameId: string,
  availableGameIds: readonly string[],
  now = new Date(),
): GameFavoritesSnapshot {
  if (!availableGameIds.includes(gameId)) return snapshot

  if (snapshot.favorites.some((favorite) => favorite.gameId === gameId)) {
    return { schemaVersion: 1, favorites: snapshot.favorites.filter((favorite) => favorite.gameId !== gameId) }
  }

  const nextFavorite = { gameId, favoritedAt: now.toISOString() }
  const favorites = [...snapshot.favorites, nextFavorite]
  if (favorites.length <= maxFavoriteGames) return { schemaVersion: 1, favorites }

  const oldest = favorites.reduce((oldestFavorite, favorite) => (
    Date.parse(favorite.favoritedAt) < Date.parse(oldestFavorite.favoritedAt) ? favorite : oldestFavorite
  ))
  return { schemaVersion: 1, favorites: favorites.filter((favorite) => favorite !== oldest) }
}

function isGameFavoritesSnapshot(value: unknown): value is GameFavoritesSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GameFavoritesSnapshot>
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.favorites) || candidate.favorites.length > maxFavoriteGames) return false

  const ids = new Set<string>()
  return candidate.favorites.every((favorite) => {
    if (!favorite || typeof favorite !== 'object') return false
    const entry = favorite as Partial<{ gameId: unknown; favoritedAt: unknown }>
    if (typeof entry.gameId !== 'string' || !entry.gameId || typeof entry.favoritedAt !== 'string' || Number.isNaN(Date.parse(entry.favoritedAt))) return false
    if (ids.has(entry.gameId)) return false
    ids.add(entry.gameId)
    return true
  })
}
