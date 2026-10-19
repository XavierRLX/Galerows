import { describe, expect, it } from 'vitest'
import type { GameModule } from '../games/games.types'
import { orderHubGames, shouldInsertHubAdAfterCard } from './hubGames.model'

const games = ['featured', 'favorite', 'discover', 'other'].map((id) => ({ id, status: 'available' })) as GameModule[]

describe('hub ad placement', () => {
  it('keeps the two-column poster rows intact when ads are enabled', () => {
    expect(Array.from({ length: 10 }, (_, index) => index).filter((index) => shouldInsertHubAdAfterCard(index, 10))).toEqual([3, 7])
    expect(Array.from({ length: 3 }, (_, index) => index).filter((index) => shouldInsertHubAdAfterCard(index, 3))).toEqual([])
  })
})

describe('orderHubGames', () => {
  it('prioritizes featured and favorites, then keeps a predictable catalog order', () => {
    expect(orderHubGames(games, 'featured', ['favorite'], ['other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'favorite', 'other', 'discover'])
  })

  it('keeps the first position of a game when the catalog order includes fallbacks', () => {
    expect(orderHubGames(games, 'featured', [], ['discover', 'favorite', 'other', 'discover', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'discover', 'favorite', 'other'])
  })

  it('never repeats games that belong to multiple priority groups', () => {
    expect(orderHubGames(games, 'featured', ['featured', 'discover'], ['other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'discover', 'other', 'favorite'])
  })

  it('keeps coming-soon games after every available game', () => {
    const comingSoon = { id: 'coming-soon', status: 'coming-soon' } as GameModule
    expect(orderHubGames([...games, comingSoon], 'featured', ['favorite'], ['coming-soon', 'other', 'discover', 'favorite', 'featured']).map((game) => game.id))
      .toEqual(['featured', 'favorite', 'other', 'discover', 'coming-soon'])
  })
})
