import { describe, expect, it, vi } from 'vitest'
import { createScreenAwakeCoordinator } from './screenAwake'

describe('centralized Android screen-awake coordination', () => {
  it('enables during play, releases on background and restores on foreground', async () => {
    const setEnabled = vi.fn().mockResolvedValue(undefined)
    const coordinator = createScreenAwakeCoordinator(setEnabled)
    await coordinator.setWanted(true)
    await coordinator.setForeground(false)
    await coordinator.setForeground(true)
    await coordinator.release()
    expect(setEnabled.mock.calls).toEqual([[true], [false], [true], [false]])
  })

  it('serializes rapid requests and never leaves a stale enable after exit', async () => {
    const changes: boolean[] = []
    const setEnabled = vi.fn(async (enabled: boolean) => {
      await Promise.resolve()
      changes.push(enabled)
    })
    const coordinator = createScreenAwakeCoordinator(setEnabled)
    const start = coordinator.setWanted(true)
    const exit = coordinator.setWanted(false)
    await Promise.all([start, exit])
    await coordinator.release()
    expect(changes.at(-1)).not.toBe(true)
  })

  it('does not activate the screen while the application is in background', async () => {
    const setEnabled = vi.fn().mockResolvedValue(undefined)
    const coordinator = createScreenAwakeCoordinator(setEnabled)
    await coordinator.setForeground(false)
    await coordinator.setWanted(true)
    expect(setEnabled).not.toHaveBeenCalledWith(true)
    await coordinator.setForeground(true)
    expect(setEnabled).toHaveBeenCalledWith(true)
  })
})
