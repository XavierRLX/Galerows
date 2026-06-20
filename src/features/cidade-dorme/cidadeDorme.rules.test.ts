import { describe, expect, it } from 'vitest'
import type { CidadeDormePlayerInput, GameSettings, Player } from './cidadeDorme.types'
import { assignRolesToPlayers, canDoctorProtect, canStartGame, checkWinCondition, createRoleDeck, getAliveInnocents, getAliveKillers, getAlivePlayers, resolveNight, resolveVotingOutcome } from './cidadeDorme.rules'

const players: CidadeDormePlayerInput[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'caio', name: 'Caio' },
  { id: 'dani', name: 'Dani' },
  { id: 'eli', name: 'Eli' },
  { id: 'fefa', name: 'Fefa' },
]

const defaultSettings: GameSettings = {
  playerCount: 6,
  killersCount: 1,
  enableDoctor: true,
  enableDetective: true,
  enableJester: true,
  revealRoleOnDeath: false,
  doctorCanSelfProtect: false,
  doctorSelfProtectLimit: 1,
  doctorCanRepeatProtection: false,
  themeId: 'classic',
}

const noShuffle = () => 0.999999

describe('Cidade Dorme rules', () => {
  it('creates the configured role deck and assigns roles without mutating inputs', () => {
    expect(createRoleDeck(defaultSettings)).toEqual(['killer', 'doctor', 'detective', 'jester', 'citizen', 'citizen'])
    const assigned = assignRolesToPlayers(players, defaultSettings, noShuffle)
    expect(assigned.map((player) => player.roleKey)).toEqual(['killer', 'doctor', 'detective', 'jester', 'citizen', 'citizen'])
    expect(assigned.every((player) => player.status === 'alive')).toBe(true)
    expect(players.some((player) => 'roleKey' in player)).toBe(false)
  })

  it('validates player count, unique names and role composition before starting', () => {
    expect(canStartGame(players, defaultSettings)).toBe(true)
    expect(canStartGame(players.slice(0, 3), { ...defaultSettings, playerCount: 3 })).toBe(false)
    expect(canStartGame([...players.slice(0, 5), { id: 'other-ana', name: ' Ana ' }], defaultSettings)).toBe(false)
    expect(canStartGame(players, { ...defaultSettings, killersCount: 6 })).toBe(false)
  })

  it('selects alive players, killers and innocents', () => {
    const assigned = assignRolesToPlayers(players, defaultSettings, noShuffle)
    const afterNight = resolveNight(assigned, { round: 1, killerTargetId: 'fefa' }).players
    expect(getAlivePlayers(afterNight).map((player) => player.id)).not.toContain('fefa')
    expect(getAliveKillers(afterNight).map((player) => player.id)).toEqual(['ana'])
    expect(getAliveInnocents(afterNight).map((player) => player.id)).toEqual(['bia', 'caio', 'dani', 'eli'])
  })

  it('resolves night kills, doctor protection and detective investigation', () => {
    const assigned = assignRolesToPlayers(players, defaultSettings, noShuffle)
    const protectedNight = resolveNight(assigned, { round: 1, killerTargetId: 'caio', protectedPlayerId: 'caio', detectiveTargetId: 'ana' })
    expect(protectedNight.action).toMatchObject({ wasProtected: true, detectiveResult: 'suspect' })
    expect(protectedNight.action.eliminatedPlayerId).toBeUndefined()
    expect(getAlivePlayers(protectedNight.players)).toHaveLength(6)

    const lethalNight = resolveNight(assigned, { round: 1, killerTargetId: 'eli', protectedPlayerId: 'caio', detectiveTargetId: 'bia' })
    expect(lethalNight.action).toMatchObject({ wasProtected: false, detectiveResult: 'innocent', eliminatedPlayerId: 'eli' })
    expect(lethalNight.players.find((player) => player.id === 'eli')).toMatchObject({ status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'night' })
  })

  it('checks doctor self-protection and repeated protection settings', () => {
    expect(canDoctorProtect('bia', 'bia', defaultSettings)).toBe(false)
    expect(canDoctorProtect('bia', 'caio', defaultSettings, 'caio')).toBe(false)
    expect(canDoctorProtect('bia', 'bia', { ...defaultSettings, doctorCanSelfProtect: true })).toBe(true)
    expect(canDoctorProtect('bia', 'caio', { ...defaultSettings, doctorCanRepeatProtection: true }, 'caio')).toBe(true)
    expect(canDoctorProtect('bia', 'bia', { ...defaultSettings, doctorCanSelfProtect: true, doctorSelfProtectLimit: 1 }, undefined, 1)).toBe(false)
    expect(canDoctorProtect('bia', 'bia', { ...defaultSettings, doctorCanSelfProtect: true, doctorSelfProtectLimit: 2 }, undefined, 1)).toBe(true)
    expect(canDoctorProtect('bia', 'bia', { ...defaultSettings, doctorCanSelfProtect: true, doctorSelfProtectLimit: 3 }, undefined, 3)).toBe(false)
    expect(canDoctorProtect('bia', 'bia', { ...defaultSettings, doctorCanSelfProtect: true, doctorSelfProtectLimit: 'unlimited' }, undefined, 99)).toBe(true)
  })

  it('applies a manual eliminated voting result', () => {
    const assigned = assignRolesToPlayers(players, defaultSettings, noShuffle)
    const resolution = resolveVotingOutcome(assigned, { kind: 'eliminated', playerId: 'eli' }, 1)
    expect(resolution.kind).toBe('eliminated')
    expect(resolution.eliminatedPlayerId).toBe('eli')
    expect(resolution.players.find((player) => player.id === 'eli')).toMatchObject({ status: 'eliminated', eliminationReason: 'vote' })
  })

  it('applies a manual tie result without individual votes', () => {
    const assigned = assignRolesToPlayers(players, defaultSettings, noShuffle)
    const resolution = resolveVotingOutcome(assigned, { kind: 'tie' }, 1)
    expect(resolution).toMatchObject({ kind: 'tie', round: 1 })
    expect(resolution.players.map((player) => player.status)).toEqual(assigned.map((player) => player.status))
  })

  it('detects city, killer and instant jester wins', () => {
    expect(checkWinCondition(withRoles([
      ['ana', 'killer', 'eliminated', 'vote'],
      ['bia', 'doctor', 'alive'],
      ['caio', 'citizen', 'alive'],
    ]), defaultSettings)).toMatchObject({ isGameOver: true, winner: 'city', reason: 'city-eliminated-killers' })

    expect(checkWinCondition(withRoles([
      ['ana', 'killer', 'alive'],
      ['bia', 'citizen', 'alive'],
    ]), defaultSettings)).toMatchObject({ isGameOver: true, winner: 'killers', reason: 'killers-parity' })

    expect(checkWinCondition(withRoles([
      ['ana', 'killer', 'alive'],
      ['bia', 'jester', 'eliminated', 'vote'],
      ['caio', 'citizen', 'alive'],
    ]), defaultSettings)).toMatchObject({ isGameOver: true, winner: 'jester', winnerPlayerId: 'bia', reason: 'jester-voted-out' })
  })

  it('always ends the game for jester wins', () => {
    const result = checkWinCondition(withRoles([
      ['ana', 'killer', 'alive'],
      ['bia', 'jester', 'eliminated', 'vote'],
      ['caio', 'citizen', 'alive'],
      ['dani', 'doctor', 'alive'],
    ]), defaultSettings)
    expect(result).toMatchObject({ isGameOver: true, winner: 'jester', winnerPlayerId: 'bia', reason: 'jester-voted-out' })
  })
})

function withRoles(entries: [string, NonNullable<Player['roleKey']>, Player['status'], Player['eliminationReason']?][]): Player[] {
  return entries.map(([id, roleKey, status, eliminationReason]) => ({
    id,
    name: id,
    roleKey,
    status,
    eliminatedAtRound: status === 'eliminated' ? 1 : undefined,
    eliminationReason,
  }))
}
