import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { gamesRegistry } from './games.registry'
import { emptyGameFavoritesSnapshot, normalizeGameFavoritesSnapshot, toggleGameFavoriteInSnapshot } from './gameFavorites.model'
import type { GameFavoritesSnapshot } from './gameFavorites.types'

const availableGameIds = gamesRegistry.filter((game) => game.status === 'available').map((game) => game.id)

export async function loadGameFavoritesSnapshot(): Promise<GameFavoritesSnapshot> {
  try {
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.gameFavorites)
    return normalizeGameFavoritesSnapshot(saved, availableGameIds)
  } catch {
    return emptyGameFavoritesSnapshot
  }
}

export async function toggleGameFavorite(gameId: string, now = new Date()): Promise<GameFavoritesSnapshot> {
  const snapshot = await loadGameFavoritesSnapshot()
  const next = toggleGameFavoriteInSnapshot(snapshot, gameId, availableGameIds, now)
  await LocalPreferences.setJson(STORAGE_KEYS.gameFavorites, next)
  return next
}
