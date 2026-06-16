import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hideBanner, showBanner } from './ads.service'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'web',
    isNativePlatform: () => false,
  },
}))

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: vi.fn(),
    requestConsentInfo: vi.fn(),
    showBanner: vi.fn(),
    hideBanner: vi.fn(),
    removeBanner: vi.fn(),
  },
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
  MaxAdContentRating: { Teen: 'Teen' },
}))

describe('ads service on web', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not break when banner is requested outside native Android', async () => {
    await expect(showBanner('game-home')).resolves.toBeUndefined()
  })

  it('does not break when hiding a banner outside native Android', async () => {
    await expect(hideBanner()).resolves.toBeUndefined()
  })
})
