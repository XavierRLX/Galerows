import { AppLifecycle } from '../../lib/capacitor/app'
import { PlayStore, type PlayStoreUpdateInfo } from '../../lib/capacitor/playStore'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'

export type UpdatePromptStatus = 'hidden' | 'available' | 'downloaded'
export type UpdatePromptState = {
  status: UpdatePromptStatus
  updateInfo: PlayStoreUpdateInfo | null
}

type PersistedUpdatePrompt = {
  dismissedAvailableVersionCode: number
  dismissedAt: string
}

const criticalPriority = 4
const dismissCooldownMs = 24 * 60 * 60 * 1000

export function isActivePlayRoute(pathname: string) {
  return /^\/games\/[^/]+\/play$/.test(pathname)
}

export async function checkUpdatePrompt(pathname: string, now = new Date()): Promise<UpdatePromptState> {
  const updateInfo = await PlayStore.checkForUpdate()
  if (updateInfo.developerTriggeredUpdateInProgress && updateInfo.immediateAllowed) {
    await PlayStore.startImmediateUpdate()
    return { status: 'hidden', updateInfo }
  }
  if (updateInfo.available && updateInfo.immediateAllowed && updateInfo.updatePriority >= criticalPriority) {
    await PlayStore.startImmediateUpdate()
    return { status: 'hidden', updateInfo }
  }
  if (updateInfo.downloaded) return { status: isActivePlayRoute(pathname) ? 'hidden' : 'downloaded', updateInfo }
  if (!updateInfo.available || !updateInfo.flexibleAllowed || isActivePlayRoute(pathname)) return { status: 'hidden', updateInfo }
  if (await isUpdateDismissed(updateInfo, now)) return { status: 'hidden', updateInfo }
  return { status: getFlexibleUpdatePromptStatus(updateInfo, pathname, false), updateInfo }
}

export async function dismissUpdatePrompt(updateInfo: PlayStoreUpdateInfo, now = new Date()) {
  const prompt: PersistedUpdatePrompt = {
    dismissedAvailableVersionCode: updateInfo.availableVersionCode,
    dismissedAt: now.toISOString(),
  }
  await LocalPreferences.setJson(STORAGE_KEYS.appUpdatePrompt, prompt)
}

export function subscribeToAppForeground(callback: () => void) {
  return AppLifecycle.onAppStateChange((isActive) => {
    if (isActive) callback()
  })
}

export function getFlexibleUpdatePromptStatus(updateInfo: PlayStoreUpdateInfo, pathname: string, dismissed: boolean): UpdatePromptStatus {
  if (updateInfo.downloaded) return isActivePlayRoute(pathname) ? 'hidden' : 'downloaded'
  if (!updateInfo.available || !updateInfo.flexibleAllowed || isActivePlayRoute(pathname) || dismissed) return 'hidden'
  return 'available'
}

async function isUpdateDismissed(updateInfo: PlayStoreUpdateInfo, now: Date) {
  const prompt = await LocalPreferences.getJson<Partial<PersistedUpdatePrompt>>(STORAGE_KEYS.appUpdatePrompt)
  if (!prompt || typeof prompt.dismissedAt !== 'string' || typeof prompt.dismissedAvailableVersionCode !== 'number') return false
  if (prompt.dismissedAvailableVersionCode !== updateInfo.availableVersionCode) return false
  return now.getTime() - new Date(prompt.dismissedAt).getTime() < dismissCooldownMs
}
