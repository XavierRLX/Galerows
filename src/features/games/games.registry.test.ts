import { describe, expect, it } from 'vitest'
import { gamesRegistry } from './games.registry'

describe('gamesRegistry', () => {
  it('keeps implemented games available', () => {
    expect(gamesRegistry).toHaveLength(10)
    expect(gamesRegistry.filter((game) => game.status === 'available').map((game) => game.id)).toEqual(['nem-ferrando', 'impostor-da-palavra', 'taboo', 'quem-sou-eu', 'adedonha'])
  })
  it('keeps every game offline-ready', () => { expect(gamesRegistry.every((game) => game.isAvailableOffline)).toBe(true) })
})
