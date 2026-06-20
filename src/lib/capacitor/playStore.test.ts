import { describe, expect, it, vi } from 'vitest'

describe('PlayStore wrapper fallback', () => {
  it('returns safe no-op values outside native Android', async () => {
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        getPlatform: () => 'web',
        isNativePlatform: () => false,
      },
      registerPlugin: () => ({
        checkForUpdate: vi.fn(() => Promise.reject(new Error('native unavailable'))),
        openPlayStoreListing: vi.fn(() => Promise.reject(new Error('native unavailable'))),
      }),
    }))

    const { PlayStore, canUseNativeAndroidPlayStore } = await import('./playStore')

    expect(canUseNativeAndroidPlayStore()).toBe(false)
    await expect(PlayStore.checkForUpdate()).resolves.toMatchObject({ available: false, downloaded: false })
    await expect(PlayStore.openPlayStoreListing()).resolves.toBe(false)
  })
})
