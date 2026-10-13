import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { lanNativeMvpAvailable } from './lanPlatform'

afterEach(() => vi.restoreAllMocks())

describe('G8 platform gate while native iOS WSS is incomplete', () => {
  it('allows fully implemented Android native LAN', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    expect(lanNativeMvpAvailable()).toBe(true)
  })
  it('never advertises an incomplete iOS LAN bridge', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')
    expect(lanNativeMvpAvailable()).toBe(false)
  })
  it('does not mount native-only LAN in browsers', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web')
    expect(lanNativeMvpAvailable()).toBe(false)
  })
})
