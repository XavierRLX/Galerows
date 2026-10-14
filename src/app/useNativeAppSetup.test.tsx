import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useNativeAppSetup } from './useNativeAppSetup'
const lifecycle = vi.hoisted(() => ({ back: null as null | (() => void), exit: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/capacitor/app', () => ({ AppLifecycle: {
  onBackButton: async (callback: () => void) => { lifecycle.back = callback; return lifecycle.remove }, exit: lifecycle.exit,
} }))
vi.mock('../lib/capacitor/splashScreen', () => ({ SplashScreenService: { hide: vi.fn() } }))
vi.mock('../lib/capacitor/statusBar', () => ({ StatusBarService: { configure: vi.fn() } }))
function Harness() { useNativeAppSetup(); return null }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })
it('allows the visible modal to consume Android back before history or app exit', () => {
  render(<Harness />)
  const back = vi.spyOn(window.history, 'back')
  const consume = (event: Event) => event.preventDefault()
  window.addEventListener('galerows:back', consume)
  try { lifecycle.back?.(); expect(back).not.toHaveBeenCalled(); expect(lifecycle.exit).not.toHaveBeenCalled() }
  finally { window.removeEventListener('galerows:back', consume) }
})
it('keeps normal Android history navigation when no modal consumes back', () => {
  render(<Harness />)
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
  lifecycle.back?.()
  expect(back).toHaveBeenCalledOnce()
  expect(lifecycle.exit).not.toHaveBeenCalled()
})
