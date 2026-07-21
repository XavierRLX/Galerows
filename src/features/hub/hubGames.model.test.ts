import { describe, expect, it } from 'vitest'
import type { GameModule } from '../games/games.types'
import { orderHubGames } from './hubGames.model'

const games = ['featured', 'favorite', 'discover', 'other'].map((id) => ({ id, status: 'available' })) as GameModule[]

describe('orderHubGames', () => {
  it('keeps priority cards first and the rest in the session order', () => {
    expect(orderHubGames(games, 'featured', ['favorite'], 'discover', ['other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'favorite', 'discover', 'other'])
  })

  it('never repeats a game that belongs to multiple priority groups', () => {
    expect(orderHubGames(games, 'featured', ['featured', 'discover'], 'discover', ['other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'discover', 'other', 'favorite'])
  })

  it('keeps coming-soon games after every other remaining game', () => {
    const comingSoon = { id: 'coming-soon', status: 'coming-soon' } as GameModule
    expect(orderHubGames([...games, comingSoon], 'featured', ['favorite'], 'discover', ['coming-soon', 'other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'favorite', 'discover', 'other', 'coming-soon'])
  })
})
