import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { clearGaleraResults, emptyGaleraResultsSnapshot, normalizeGaleraResultsSnapshot, recordGaleraMatch } from './ranking.model'
import type { GaleraMatchResult, GaleraResultsSnapshot } from './ranking.types'

export async function loadGaleraResultsSnapshot(): Promise<GaleraResultsSnapshot> {
  try {
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.galeraResults)
    return normalizeGaleraResultsSnapshot(saved)
  } catch {
    return emptyGaleraResultsSnapshot
  }
}

export async function recordGaleraMatchResult(match: GaleraMatchResult): Promise<GaleraResultsSnapshot> {
  const snapshot = await loadGaleraResultsSnapshot()
  const next = recordGaleraMatch(snapshot, match)
  if (next !== snapshot) await LocalPreferences.setJson(STORAGE_KEYS.galeraResults, next)
  return next
}

export async function clearGaleraResultsSnapshot(): Promise<GaleraResultsSnapshot> {
  const next = clearGaleraResults()
  await LocalPreferences.setJson(STORAGE_KEYS.galeraResults, next)
  return next
}
