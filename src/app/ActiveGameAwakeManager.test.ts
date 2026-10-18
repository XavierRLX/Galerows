import { describe, expect, it } from 'vitest'
import { shouldKeepScreenAwake } from './activeGameAwakePolicy'

describe('screen-awake route policy', () => {
  it('covers local play but not home, setup, results or settings', () => {
    expect(shouldKeepScreenAwake('/games/cidade-dorme/play', null)).toBe(true)
    expect(shouldKeepScreenAwake('/games/impostor-da-palavra/play', null)).toBe(true)
    expect(shouldKeepScreenAwake('/games/pista-unica/play', null)).toBe(true)
    expect(shouldKeepScreenAwake('/', 'playing')).toBe(false)
    expect(shouldKeepScreenAwake('/games/cidade-dorme/setup', null)).toBe(false)
    expect(shouldKeepScreenAwake('/games/pista-unica/result', null)).toBe(false)
  })

  it('covers LAN only while the room is playing on the room screen', () => {
    expect(shouldKeepScreenAwake('/__lan-lobby-v2', 'playing')).toBe(true)
    expect(shouldKeepScreenAwake('/__lan-lobby-v2/criar', 'playing')).toBe(true)
    expect(shouldKeepScreenAwake('/__lan-lobby-v2', 'lobby')).toBe(false)
    expect(shouldKeepScreenAwake('/__lan-lobby-v2', 'results')).toBe(false)
  })
})
