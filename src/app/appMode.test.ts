import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shouldRenderGameApp } from './appMode'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('public website and native app entry', () => {
  it('keeps the native app accessible in production', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.stubEnv('DEV', false)
    expect(shouldRenderGameApp()).toBe(true)
  })

  it('always serves the landing to production browsers, even with preview flags', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_APP_PREVIEW', '1')
    vi.stubEnv('VITE_LAN_DIAGNOSTICS', '1')
    expect(shouldRenderGameApp()).toBe(false)
  })

  it('allows explicit local browser testing of the game', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_APP_PREVIEW', '1')
    expect(shouldRenderGameApp()).toBe(true)
  })
})
