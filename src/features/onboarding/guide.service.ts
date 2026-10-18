import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'

export async function hasCompletedGuide(): Promise<boolean> {
  return (await LocalPreferences.getJson<boolean>(STORAGE_KEYS.firstRunGuideCompleted)) === true
}

export async function markGuideComplete(): Promise<void> {
  await LocalPreferences.setJson(STORAGE_KEYS.firstRunGuideCompleted, true)
}
