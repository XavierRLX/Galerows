import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { emptyGameUsageSnapshot, normalizeGameUsageSnapshot, recordGameOpenedInSnapshot } from './gameUsage.model'
import type { GameUsageSnapshot } from './gameUsage.types'

export async function loadGameUsageSnapshot(): Promise<GameUsageSnapshot> {
  try {
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.gameUsage)
    return normalizeGameUsageSnapshot(saved)
  } catch {
    return emptyGameUsageSnapshot
  }
}

export async function recordGameOpened(gameId: string, now = new Date()): Promise<GameUsageSnapshot> {
  const snapshot = await loadGameUsageSnapshot()
  const next = recordGameOpenedInSnapshot(snapshot, gameId, now)
  await LocalPreferences.setJson(STORAGE_KEYS.gameUsage, next)
  return next
}
