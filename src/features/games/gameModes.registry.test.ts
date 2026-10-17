import { describe, expect, it } from 'vitest'
import { gamesRegistry } from './games.registry'
import { getGameModeCapabilities } from './gameModes.registry'

describe('game mode capabilities', () => {
  it('covers the full catalog without mistaking offline support for LAN', () => {
    expect(gamesRegistry).toHaveLength(13)
    for (const game of gamesRegistry) {
      const capabilities = getGameModeCapabilities(game)
      expect(capabilities.local.label.length).toBeGreaterThan(0)
      expect(capabilities.lan === 'available').toBe(['impostor-da-palavra', 'cidade-dorme', 'pista-unica'].includes(game.id))
    }
  })

  it.each(['impostor-da-palavra', 'cidade-dorme', 'pista-unica'])('marks %s as supporting a shared device and local multiplayer', (id) => {
    const game = gamesRegistry.find(item => item.id === id)!
    expect(getGameModeCapabilities(game)).toEqual({
      local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
      lan: 'available',
    })
  })

  it('does not label the Adedonha QR configuration flow as synchronized LAN or shared-device play', () => {
    const game = gamesRegistry.find(item => item.id === 'adedonha')!
    expect(getGameModeCapabilities(game)).toEqual({
      local: { kind: 'localPersonalSheet', label: 'Minha folha no celular' },
      lan: 'comingSoon',
    })
  })

  it('does not invent LAN support for unrelated or coming-soon games', () => {
    const game = gamesRegistry.find(item => item.id === 'mimica')!
    const future = gamesRegistry.find(item => item.id === 'damas')!
    expect(getGameModeCapabilities(game).lan).toBe('unsupported')
    expect(getGameModeCapabilities(future).lan).toBe('unsupported')
    expect(getGameModeCapabilities(future).local.label).toBe('Em breve')
  })
})
