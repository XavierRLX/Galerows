import { afterEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { clearAllLocalData, clearGameplayData } from '../privacy/privacy.service'
import { hasCompletedGuide, markGuideComplete } from './guide.service'

afterEach(async () => { await LocalPreferences.remove(STORAGE_KEYS.firstRunGuideCompleted) })

describe('first-use guidance lifecycle', () => {
  it('persists completion, keeps it when clearing gameplay and removes it on full reset', async () => {
    await expect(hasCompletedGuide()).resolves.toBe(false)
    await markGuideComplete()
    await expect(hasCompletedGuide()).resolves.toBe(true)
    await clearGameplayData()
    await expect(hasCompletedGuide()).resolves.toBe(true)
    await clearAllLocalData()
    await expect(hasCompletedGuide()).resolves.toBe(false)
  })
})
