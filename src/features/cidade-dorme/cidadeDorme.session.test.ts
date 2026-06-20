import { describe, expect, it } from 'vitest'
import { advanceRoleReveal, createCidadeDormeSession, isCidadeDormeSessionCompatible, migrateCidadeDormeSession, recordDetectiveInvestigation, recordDoctorProtection, recordKillerTarget, resolveCurrentNight, resolveCurrentVoting } from './cidadeDorme.session'
import { createDefaultCidadeDormeSettings } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput } from './cidadeDorme.types'

const players: CidadeDormePlayerInput[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'caio', name: 'Caio' },
  { id: 'dani', name: 'Dani' },
]

const playersWithDoctor: CidadeDormePlayerInput[] = [
  ...players,
  { id: 'eli', name: 'Eli' },
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
    expect(recordKillerTarget(session, 'ana', 'bia')).toBe(session)
    expect(recordKillerTarget(killerTurn, 'missing', 'bia')).toBe(killerTurn)
    expect(recordKillerTarget(killerTurn, 'ana', 'ana')).toBe(killerTurn)
    expect(recordKillerTarget(killerTurn, 'ana', 'bia')).toMatchObject({
      phase: 'killerTurn',
      currentNightAction: { round: 1, killerActorId: 'ana', killerTargetId: 'bia' },
    })
  })

  it('allows one killer to target another killer when they are not the actor', () => {
    const settings = { ...createDefaultCidadeDormeSettings(playersWithDoctor.length), killersCount: 2 }
    const session = createCidadeDormeSession(playersWithDoctor, settings, () => 0.999999)
    const killerTurn = { ...session, phase: 'killerTurn' as const }

    expect(recordKillerTarget(killerTurn, 'ana', 'bia')).toMatchObject({
      currentNightAction: { killerActorId: 'ana', killerTargetId: 'bia' },
    })
  })

  it('records doctor protection only for valid targets during the doctor turn', () => {
    const session = createCidadeDormeSession(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length), () => 0.999999)
    const doctorTurn = { ...session, phase: 'doctorTurn' as const }
    expect(recordDoctorProtection(session, 'caio')).toBe(session)
    expect(recordDoctorProtection(doctorTurn, 'missing')).toBe(doctorTurn)
    expect(recordDoctorProtection(doctorTurn, 'bia')).toBe(doctorTurn)
    expect(recordDoctorProtection(doctorTurn, 'caio')).toMatchObject({
      phase: 'doctorTurn',
      currentNightAction: { round: 1, protectedPlayerId: 'caio' },
    })
  })

  it('blocks repeated doctor protection when the setting is disabled', () => {
    const session = createCidadeDormeSession(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length), () => 0.999999)
    const doctorTurn = {
      ...session,
      phase: 'doctorTurn' as const,
      history: [{ round: 1, nightAction: { round: 1, protectedPlayerId: 'caio' } }],
    }
    expect(recordDoctorProtection(doctorTurn, 'caio')).toBe(doctorTurn)
    expect(recordDoctorProtection({ ...doctorTurn, settings: { ...doctorTurn.settings, doctorCanRepeatProtection: true } }, 'caio')).toMatchObject({
      currentNightAction: { protectedPlayerId: 'caio' },
    })
  })

  it('records detective investigation only during the detective turn', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    const detectiveTurn = { ...session, phase: 'detectiveTurn' as const }
    expect(recordDetectiveInvestigation(session, 'ana')).toBe(session)
    expect(recordDetectiveInvestigation(detectiveTurn, 'missing')).toBe(detectiveTurn)
    expect(recordDetectiveInvestigation(detectiveTurn, 'bia')).toBe(detectiveTurn)
    expect(recordDetectiveInvestigation(detectiveTurn, 'ana')).toMatchObject({
      phase: 'detectiveTurn',
      currentNightAction: { round: 1, detectiveTargetId: 'ana' },
    })
  })

  it('resolves the current night and stores the round history', () => {
    const session = createCidadeDormeSession(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length), () => 0.999999)
    const nightResolution = {
      ...session,
      phase: 'nightResolution' as const,
      currentNightAction: { round: 1, killerTargetId: 'dani', protectedPlayerId: 'caio', detectiveTargetId: 'ana' },
    }
    const resolved = resolveCurrentNight(nightResolution)
    expect(resolved.currentNightAction).toMatchObject({ eliminatedPlayerId: 'dani', wasProtected: false, detectiveResult: 'suspect' })
    expect(resolved.players.find((player) => player.id === 'dani')).toMatchObject({ status: 'eliminated', eliminationReason: 'night' })
    expect(resolved.history).toHaveLength(1)
    expect(resolved.history[0]?.nightAction).toMatchObject({ eliminatedPlayerId: 'dani' })
  })

  it('applies a manual voting elimination and stores the round history', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    const voting = {
      ...session,
      phase: 'voting' as const,
      players: session.players.map((player) => player.id === 'ana' ? { ...player, roleKey: 'killer' as const } : player),
    }
    const resolved = resolveCurrentVoting(voting, { kind: 'eliminated', playerId: 'ana' })
    expect(resolved.players.find((player) => player.id === 'ana')).toMatchObject({ status: 'eliminated', eliminationReason: 'vote' })
    expect(resolved.history[0]).toMatchObject({
      eliminatedByVoteId: 'ana',
      votingResult: {
        kind: 'eliminated',
        eliminatedPlayerId: 'ana',
      },
    })
    expect(resolved).toMatchObject({ phase: 'gameOver', winner: 'city' })
  })

  it('applies a manual tie without eliminating anyone and advances to the next night', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    const voting = { ...session, phase: 'voting' as const }
    const resolved = resolveCurrentVoting(voting, { kind: 'tie' })

    expect(resolved.players.every((player) => player.status === 'alive')).toBe(true)
    expect(resolved).toMatchObject({ phase: 'nightIntro', round: 2, currentNightAction: { round: 2 } })
    expect(resolved.history[0]?.votingResult).toEqual({ kind: 'tie', eliminatedPlayerId: undefined, jesterWinnerPlayerId: undefined })
  })

  it('validates compatible saved sessions', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    expect(isCidadeDormeSessionCompatible(session)).toBe(true)
    expect(isCidadeDormeSessionCompatible({ ...session, gameId: 'other' })).toBe(false)
    expect(isCidadeDormeSessionCompatible({ ...session, currentRevealIndex: 99 })).toBe(false)
  })

  it('migrates legacy voting sessions to day discussion with new settings', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    const legacy = {
      ...session,
      phase: 'voteResolution',
      currentVotes: [{ voterId: 'ana', targetId: 'bia' }],
      settings: {
        ...session.settings,
        allowSkipVote: true,
        tieRule: 'revoteTied',
        jesterWinMode: 'parallel',
      },
      history: [{
        round: 1,
        nightAction: { round: 1 },
        votes: [{ voterId: 'ana', targetId: 'bia' }],
        votingResult: { kind: 'revote', tally: { bia: 1, caio: 1 }, tiedTargetIds: ['bia', 'caio'] },
      }],
    }
    const migrated = migrateCidadeDormeSession(legacy)
    expect(migrated).toMatchObject({
      phase: 'dayDiscussion',
      settings: { doctorSelfProtectLimit: 1 },
      history: [{ votingResult: { kind: 'tie' } }],
    })
    expect(migrated).not.toHaveProperty('currentVotes')
  })
})
