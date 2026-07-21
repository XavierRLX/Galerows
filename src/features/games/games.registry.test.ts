import { describe, expect, it } from 'vitest'
import { gamesRegistry } from './games.registry'

describe('gamesRegistry', () => {
  it('keeps implemented games available', () => {
    expect(gamesRegistry).toHaveLength(13)
    expect(gamesRegistry.filter((game) => game.status === 'available').map((game) => game.id)).toEqual(['pista-unica', 'ultima-pista', 'nem-ferrando', 'impostor-da-palavra', 'top-10', 'quem-sou-eu', 'adedonha', 'mimica', 'taboo', 'cidade-dorme'])
  })
  it('keeps every game offline-ready', () => { expect(gamesRegistry.every((game) => game.isAvailableOffline)).toBe(true) })
})
