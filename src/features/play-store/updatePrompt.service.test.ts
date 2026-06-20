import { describe, expect, it } from 'vitest'
import { getFlexibleUpdatePromptStatus, isActivePlayRoute } from './updatePrompt.service'
import type { PlayStoreUpdateInfo } from '../../lib/capacitor/playStore'

const availableUpdate: PlayStoreUpdateInfo = {
  available: true,
  developerTriggeredUpdateInProgress: false,
  flexibleAllowed: true,
  immediateAllowed: false,
  updatePriority: 2,
  clientVersionStalenessDays: 3,
  availableVersionCode: 9,
  installStatus: 0,
  downloaded: false,
}

describe('update prompt rules', () => {
  it('detects active play routes', () => {
    expect(isActivePlayRoute('/games/taboo/play')).toBe(true)
    expect(isActivePlayRoute('/games/taboo/result')).toBe(false)
    expect(isActivePlayRoute('/settings')).toBe(false)
  })

  it('does not show flexible update prompts during active play', () => {
    expect(getFlexibleUpdatePromptStatus(availableUpdate, '/games/taboo/play', false)).toBe('hidden')
    expect(getFlexibleUpdatePromptStatus(availableUpdate, '/games/taboo/result', false)).toBe('available')
  })

  it('shows restart only outside active play once flexible update is downloaded', () => {
    const downloaded = { ...availableUpdate, downloaded: true }

    expect(getFlexibleUpdatePromptStatus(downloaded, '/games/taboo/play', false)).toBe('hidden')
    expect(getFlexibleUpdatePromptStatus(downloaded, '/', false)).toBe('downloaded')
  })

  it('hides dismissed or unavailable flexible updates', () => {
    expect(getFlexibleUpdatePromptStatus(availableUpdate, '/', true)).toBe('hidden')
    expect(getFlexibleUpdatePromptStatus({ ...availableUpdate, available: false }, '/', false)).toBe('hidden')
    expect(getFlexibleUpdatePromptStatus({ ...availableUpdate, flexibleAllowed: false }, '/', false)).toBe('hidden')
  })
})
