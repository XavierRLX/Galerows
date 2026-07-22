import { afterEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS, contentOverrideKey } from '../../lib/storage/storage.keys'
import { PRIVACY_NOTICE_VERSION } from './privacy.config'
import { clearAllLocalData, clearGameplayData, hasSeenCurrentPrivacyNotice, markCurrentPrivacyNoticeSeen } from './privacy.service'

const externalKey = 'another-library.preference'
const overrideKey = contentOverrideKey('taboo', 'pt-BR')

afterEach(async () => {
  await Promise.all([
    STORAGE_KEYS.locale,
    STORAGE_KEYS.privacyNoticeVersion,
    STORAGE_KEYS.playerGroup,
    overrideKey,
    externalKey,
  ].map((key) => LocalPreferences.remove(key)))
})

describe('privacy local data controls', () => {
  it('versions the informational privacy notice without recording legal consent', async () => {
    await expect(hasSeenCurrentPrivacyNotice()).resolves.toBe(false)
    await markCurrentPrivacyNoticeSeen()
    await expect(LocalPreferences.getJson(STORAGE_KEYS.privacyNoticeVersion)).resolves.toBe(PRIVACY_NOTICE_VERSION)
    await expect(hasSeenCurrentPrivacyNotice()).resolves.toBe(true)
  })

  it('clears gameplay data while preserving locale, notice, and unrelated preferences', async () => {
    await LocalPreferences.setJson(STORAGE_KEYS.locale, 'pt-BR')
    await LocalPreferences.setJson(STORAGE_KEYS.privacyNoticeVersion, PRIVACY_NOTICE_VERSION)
    await LocalPreferences.setJson(STORAGE_KEYS.playerGroup, { players: ['Ana'] })
    await LocalPreferences.setJson(overrideKey, { custom: true })
    await LocalPreferences.setJson(externalKey, 'keep')

    await clearGameplayData()

    await expect(LocalPreferences.getJson(STORAGE_KEYS.locale)).resolves.toBe('pt-BR')
    await expect(LocalPreferences.getJson(STORAGE_KEYS.privacyNoticeVersion)).resolves.toBe(PRIVACY_NOTICE_VERSION)
    await expect(LocalPreferences.getJson(STORAGE_KEYS.playerGroup)).resolves.toBeNull()
    await expect(LocalPreferences.getJson(overrideKey)).resolves.toBeNull()
    await expect(LocalPreferences.getJson(externalKey)).resolves.toBe('keep')
  })

  it('clears every Galerows preference without touching unrelated storage', async () => {
    await LocalPreferences.setJson(STORAGE_KEYS.locale, 'en-US')
    await LocalPreferences.setJson(STORAGE_KEYS.playerGroup, { players: ['Ana'] })
    await LocalPreferences.setJson(externalKey, 'keep')

    await clearAllLocalData()

    await expect(LocalPreferences.getJson(STORAGE_KEYS.locale)).resolves.toBeNull()
    await expect(LocalPreferences.getJson(STORAGE_KEYS.playerGroup)).resolves.toBeNull()
    await expect(LocalPreferences.getJson(externalKey)).resolves.toBe('keep')
  })
})
