import { describe, expect, it } from 'vitest'
import { canStartGame } from './cidadeDorme.rules'
import { CIDADE_DORME_MAX_PLAYERS, CIDADE_DORME_MIN_PLAYERS, createDefaultCidadeDormeSettings, getCidadeDormeRoleCounts, getCidadeDormeSetupWarnings, getRecommendedKillersCount, isSupportedCidadeDormePlayerCount } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput, GameSettings } from './cidadeDorme.types'

describe('Cidade Dorme setup presets', () => {
  it('supports the planned player range', () => {
    expect(CIDADE_DORME_MIN_PLAYERS).toBe(4)
    expect(CIDADE_DORME_MAX_PLAYERS).toBe(12)
    expect(isSupportedCidadeDormePlayerCount(3)).toBe(false)
    expect(isSupportedCidadeDormePlayerCount(4)).toBe(true)
    expect(isSupportedCidadeDormePlayerCount(12)).toBe(true)
    expect(isSupportedCidadeDormePlayerCount(13)).toBe(false)
  })

  it('creates valid default settings for every supported player count', () => {
    for (let playerCount = CIDADE_DORME_MIN_PLAYERS; playerCount <= CIDADE_DORME_MAX_PLAYERS; playerCount += 1) {
      const settings = createDefaultCidadeDormeSettings(playerCount)
      expect(canStartGame(createPlayers(playerCount), settings)).toBe(true)
      expect(getCidadeDormeRoleCounts(settings).citizen).toBeGreaterThanOrEqual(1)
    }
  })

  it('recommends more killers only for larger groups', () => {
    expect(getRecommendedKillersCount(4)).toBe(1)
    expect(getRecommendedKillersCount(7)).toBe(1)
    expect(getRecommendedKillersCount(8)).toBe(2)
    expect(getRecommendedKillersCount(11)).toBe(2)
    expect(getRecommendedKillersCount(12)).toBe(3)
  })

  it('keeps optional roles simple for small groups', () => {
    expect(createDefaultCidadeDormeSettings(4)).toMatchObject({
      killersCount: 1,
      enableDoctor: false,
      enableDetective: true,
      enableJester: false,
      revealRoleOnDeath: false,
      doctorSelfProtectLimit: 1,
    })
    expect(createDefaultCidadeDormeSettings(6)).toMatchObject({
      killersCount: 1,
      enableDoctor: true,
      enableDetective: true,
      enableJester: false,
      revealRoleOnDeath: false,
      doctorSelfProtectLimit: 1,
    })
  })

  it('summarizes role counts and warns about risky custom setups', () => {
    const settings: GameSettings = {
      ...createDefaultCidadeDormeSettings(5),
      killersCount: 2,
      enableDoctor: true,
      enableDetective: true,
      enableJester: true,
    }
    expect(getCidadeDormeRoleCounts(settings)).toEqual({
      citizen: 0,
      killer: 2,
      detective: 1,
      doctor: 1,
      jester: 1,
    })
    expect(getCidadeDormeSetupWarnings(settings)).toEqual([
      'Inclua pelo menos um Cidadao para manter blefes simples.',
      'O Coringa deixa grupos pequenos muito instaveis.',
    ])
  })

  it('rejects unsupported player counts when creating presets', () => {
    expect(() => createDefaultCidadeDormeSettings(3)).toThrow('Cidade Dorme exige entre 4 e 12 jogadores.')
    expect(() => createDefaultCidadeDormeSettings(13)).toThrow('Cidade Dorme exige entre 4 e 12 jogadores.')
  })
})

function createPlayers(playerCount: number): CidadeDormePlayerInput[] {
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Jogador ${index + 1}`,
  }))
}
