import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('store publication configuration', () => {
  it('enables official HTTPS store destinations', async () => {
    vi.stubEnv('VITE_APP_STORE_URL', 'https://apps.apple.com/br/app/id123456789')
    vi.stubEnv('VITE_GOOGLE_PLAY_URL', 'https://play.google.com/store/apps/details?id=com.galerows.app')
    const { storeLinks } = await import('./landing.config')
    expect(storeLinks.apple).toBe('https://apps.apple.com/br/app/id123456789')
    expect(storeLinks.google).toBe('https://play.google.com/store/apps/details?id=com.galerows.app')
  })

  it('keeps missing or invalid destinations unpublished', async () => {
    vi.stubEnv('VITE_APP_STORE_URL', '')
    vi.stubEnv('VITE_GOOGLE_PLAY_URL', 'not-a-url')
    const { storeLinks } = await import('./landing.config')
    expect(storeLinks).toEqual({ apple: undefined, google: undefined })
  })

  it('rejects non-store hosts and insecure destinations', async () => {
    vi.stubEnv('VITE_APP_STORE_URL', 'https://apps.apple.com.example.org/app')
    vi.stubEnv('VITE_GOOGLE_PLAY_URL', 'http://play.google.com/store/apps/details')
    const { storeLinks } = await import('./landing.config')
    expect(storeLinks).toEqual({ apple: undefined, google: undefined })
  })
})
