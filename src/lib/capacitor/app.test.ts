import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { getInstalledAppDetails, getInstalledAppVersion } from './app'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
}))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }))

describe('installed application details', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('reads the real Android version and build once from Capacitor App', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(App.getInfo).mockResolvedValue({ name: 'Galerows', id: 'com.galerows.app', version: '1.0.6', build: '11' })

    await expect(getInstalledAppDetails()).resolves.toEqual({
      platform: 'android', version: '1.0.6', build: '11',
    })
    expect(App.getInfo).toHaveBeenCalledTimes(1)
    await expect(getInstalledAppVersion()).resolves.toBe('1.0.6')
  })

  it('does not request native metadata on web', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web')
    const details = await getInstalledAppDetails()
    expect(details.platform).toBe('web')
    expect(details.build).toBeNull()
    expect(App.getInfo).not.toHaveBeenCalled()
  })

  it('degrades gracefully when the native plugin is unavailable', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(App.getInfo).mockRejectedValue(new Error('unavailable'))
    await expect(getInstalledAppDetails()).resolves.toMatchObject({ platform: 'android', build: null })
  })
})
