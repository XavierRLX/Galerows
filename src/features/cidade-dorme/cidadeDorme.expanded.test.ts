import { describe, expect, it } from 'vitest'
import {
  createDefaultCidadeDormeSettings, getCidadeDormeRoleCounts, getRecommendedKillersCount,
} from './cidadeDorme.setup'
import { createRoleDeck, getWatchmanObservation, resolveNight } from './cidadeDorme.rules'
import type { GameSettings, Player, RoleKey } from './cidadeDorme.types'

const presets = [
  [4, 1, 0, 0, 0, 1], [5, 1, 0, 0, 0, 2], [6, 1, 0, 0, 0, 3],
  [7, 2, 1, 1, 1, 1], [8, 2, 1, 1, 1, 2], [9, 2, 1, 1, 1, 3],
  [10, 2, 1, 1, 1, 4], [11, 3, 2, 1, 1, 4], [12, 3, 2, 1, 1, 5],
] as const

describe('CITY-EXPANDED — authoritative roles', () => {
  it.each(presets)('generates a complete balanced %i-player preset', (players, killers, traitors, watchman, sleepwalker, citizens) => {
    const config = createDefaultCidadeDormeSettings(players)
    const count = getCidadeDormeRoleCounts(config)
    expect(getRecommendedKillersCount(players)).toBe(killers)
    expect(count).toMatchObject({ killer: 1, traitor: traitors, doctor: 1,
      detective: 1, watchman, sleepwalker, jester: 0, citizen: citizens })
    expect(Object.values(count).reduce((a, b) => a + b, 0)).toBe(players)
    expect(createRoleDeck(config)).toHaveLength(players)
  })

  it('allows multiple independent jokers while requiring a citizen', () => {
    const settings = { ...createDefaultCidadeDormeSettings(12), jesterCount: 2, enableJester: true }
    expect(getCidadeDormeRoleCounts(settings)).toMatchObject({ jester: 2, citizen: 3 })
    expect(createRoleDeck(settings).filter(role => role === 'jester')).toHaveLength(2)
    expect(() => createRoleDeck({ ...settings, jesterCount: 3 })).toThrow()
    expect(() => createRoleDeck({ ...createDefaultCidadeDormeSettings(4), jesterCount: 2 })).toThrow()
  })

  it('honors explicit zero Coringas even if the legacy flag is still true', () => {
    const settings = { ...createDefaultCidadeDormeSettings(8), jesterCount: 0, enableJester: true }
    expect(getCidadeDormeRoleCounts(settings).jester).toBe(0)
    expect(createRoleDeck(settings)).not.toContain('jester')
  })

  it('recommends both mandatory roles by default while continuing to read old custom sessions', () => {
    const settings = createDefaultCidadeDormeSettings(7)
    expect(settings).toMatchObject({ enableDoctor: true, enableDetective: true })
    // The LAN adapter validates new configurations. Previously saved local games
    // with an absent Doctor can still be resumed without modifying their deck.
    const legacy: GameSettings = { ...settings, enableDoctor: false }
    delete legacy.jesterCount
    delete legacy.enableWatchman
    delete legacy.enableSleepwalker
    expect(createRoleDeck(legacy)).toHaveLength(7)
  })

  it('reads legacy enableJester true as exactly one joker', () => {
    const settings: GameSettings = { ...createDefaultCidadeDormeSettings(6), enableJester: true }
    delete settings.jesterCount
    delete settings.enableWatchman
    delete settings.enableSleepwalker
    expect(getCidadeDormeRoleCounts(settings).jester).toBe(1)
    expect(createRoleDeck(settings)).toContain('jester')
  })

  it('watchman sees real movement only, not roles, and ignores simulated eliminated turns', () => {
    const kinds: RoleKey[] = ['killer','traitor','doctor','detective','watchman','sleepwalker','jester','citizen']
    const players: Player[] = kinds.map((roleKey, i) => ({ id: String(i), name: String(i), roleKey, status: 'alive' }))
    expect(getWatchmanObservation(players, '0', '0')).toBe('passed')
    expect(getWatchmanObservation(players, '1', '0')).toBe('stayed')
    expect(getWatchmanObservation(players, '2', '0')).toBe('passed')
    expect(getWatchmanObservation(players, '3', '0')).toBe('passed')
    expect(getWatchmanObservation(players, '4', '0')).toBe('stayed')
    expect(getWatchmanObservation(players, '5', '0')).toBe('passed')
    expect(getWatchmanObservation(players, '6', '0')).toBe('stayed')
    expect(getWatchmanObservation(players, '7', '0')).toBe('stayed')
    expect(getWatchmanObservation(players, '1', '1')).toBe('passed')
    expect(getWatchmanObservation(players.map(p=>p.id==='5'?{...p,status:'eliminated'}:p), '5', '0')).toBe('stayed')
    expect(resolveNight(players, {round:1, killerActorId:'0', detectiveTargetId:'1'}).action.detectiveResult).toBe('innocent')
    expect(resolveNight(players, {round:1, killerActorId:'1', detectiveTargetId:'1'}).action.detectiveResult).toBe('suspect')
  })
})
