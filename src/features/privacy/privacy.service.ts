import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { PRIVACY_NOTICE_VERSION } from './privacy.config'

const APP_STORAGE_PREFIX = 'galerows.'

export async function hasSeenCurrentPrivacyNotice() {
  return (await LocalPreferences.getJson<string>(STORAGE_KEYS.privacyNoticeVersion)) === PRIVACY_NOTICE_VERSION
}

export async function markCurrentPrivacyNoticeSeen() {
  await LocalPreferences.setJson(STORAGE_KEYS.privacyNoticeVersion, PRIVACY_NOTICE_VERSION)
}

export async function clearGameplayData() {
  const preservedKeys = new Set<string>([STORAGE_KEYS.locale, STORAGE_KEYS.privacyNoticeVersion])
  const keys = await LocalPreferences.keys()
  await Promise.all(keys
    .filter((key) => key.startsWith(APP_STORAGE_PREFIX) && !preservedKeys.has(key))
    .map((key) => LocalPreferences.remove(key)))
}

export async function clearAllLocalData() {
  const keys = await LocalPreferences.keys()
  await Promise.all(keys
    .filter((key) => key.startsWith(APP_STORAGE_PREFIX))
    .map((key) => LocalPreferences.remove(key)))
}
