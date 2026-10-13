import { describe, expect, it } from 'vitest'
import { gamesRegistry } from './games.registry'
import { getGameModeCapabilities } from './gameModes.registry'

describe('game mode capabilities', () => {
  it('covers the full catalog without mistaking offline support for LAN', () => {
    expect(gamesRegistry).toHaveLength(13)
    for (const game of gamesRegistry) {
      const capabilities = getGameModeCapabilities(game)
      expect(capabilities.local.label.length).toBeGreaterThan(0)
      expect(capabilities.lan).not.toBe('available')
    }
  })

  it('marks Impostor as a shared-device game with future LAN only', () => {
    const game = gamesRegistry.find(item => item.id === 'impostor-da-palavra')!
    expect(getGameModeCapabilities(game)).toEqual({
      local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
      lan: 'comingSoon',
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
