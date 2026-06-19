import { describe, expect, it } from 'vitest'
import { advanceRoleReveal, createCidadeDormeSession, isCidadeDormeSessionCompatible, recordKillerTarget } from './cidadeDorme.session'
import { createDefaultCidadeDormeSettings } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput } from './cidadeDorme.types'

const players: CidadeDormePlayerInput[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'caio', name: 'Caio' },
  { id: 'dani', name: 'Dani' },
]

describe('Cidade Dorme session', () => {
  it('creates a reveal session with assigned roles', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    expect(session).toMatchObject({
      schemaVersion: 1,
      gameId: 'cidade-dorme',
      phase: 'revealRoles',
      round: 1,
      currentRevealIndex: 0,
      currentNightAction: { round: 1 },
      currentVotes: [],
      history: [],
    })
    expect(session.players.map((player) => player.roleKey)).toEqual(['killer', 'detective', 'citizen', 'citizen'])
    expect(session.players.every((player) => player.status === 'alive')).toBe(true)
  })

  it('advances through every reveal and then enters night intro', () => {
    let session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    session = advanceRoleReveal(session)
    expect(session).toMatchObject({ phase: 'revealRoles', currentRevealIndex: 1 })
    session = advanceRoleReveal(session)
    session = advanceRoleReveal(session)
    expect(session).toMatchObject({ phase: 'revealRoles', currentRevealIndex: 3 })
    session = advanceRoleReveal(session)
    expect(session).toMatchObject({ phase: 'nightIntro', currentRevealIndex: 3 })
  })

  it('records the killer target only during the killer turn', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    const killerTurn = { ...session, phase: 'killerTurn' as const }
    expect(recordKillerTarget(session, 'bia')).toBe(session)
    expect(recordKillerTarget(killerTurn, 'missing')).toBe(killerTurn)
    expect(recordKillerTarget(killerTurn, 'bia')).toMatchObject({
      phase: 'killerTurn',
      currentNightAction: { round: 1, killerTargetId: 'bia' },
    })
  })

  it('validates compatible saved sessions', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    expect(isCidadeDormeSessionCompatible(session)).toBe(true)
    expect(isCidadeDormeSessionCompatible({ ...session, gameId: 'other' })).toBe(false)
    expect(isCidadeDormeSessionCompatible({ ...session, currentRevealIndex: 99 })).toBe(false)
  })
})
