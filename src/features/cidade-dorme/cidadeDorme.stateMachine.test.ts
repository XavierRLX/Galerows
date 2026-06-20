import { describe, expect, it } from 'vitest'
import { createCidadeDormeSession } from './cidadeDorme.session'
import { createDefaultCidadeDormeSettings } from './cidadeDorme.setup'
import { advancePhase, canTransitionToPhase, getNextPhase } from './cidadeDorme.stateMachine'
import type { CidadeDormePlayerInput, GameState } from './cidadeDorme.types'

const players: CidadeDormePlayerInput[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'caio', name: 'Caio' },
  { id: 'dani', name: 'Dani' },
  { id: 'eli', name: 'Eli' },
]

describe('Cidade Dorme state machine', () => {
  it('only leaves role reveal after the final player', () => {
    const session = createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999)
    expect(getNextPhase(session)).toBeNull()
    expect(canTransitionToPhase(session, 'nightIntro')).toBe(false)

    const finalReveal = { ...session, currentRevealIndex: players.length - 1 }
    expect(getNextPhase(finalReveal)).toBe('nightIntro')
    expect(canTransitionToPhase(finalReveal, 'nightIntro')).toBe(true)
  })

  it('keeps enabled night roles even when they are eliminated', () => {
    const session = withPhase(createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999), 'killerTurn')
    const withEliminatedDoctor: GameState = {
      ...session,
      players: session.players.map((player) => player.roleKey === 'doctor' ? { ...player, status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'night' } : player),
    }
    expect(getNextPhase(withEliminatedDoctor)).toBe('doctorTurn')

    const withEliminatedDetective = withPhase({
      ...withEliminatedDoctor,
      players: withEliminatedDoctor.players.map((player) => player.roleKey === 'detective' ? { ...player, status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'night' } : player),
    }, 'doctorTurn')
    expect(getNextPhase(withEliminatedDetective)).toBe('detectiveTurn')
  })

  it('skips disabled night roles', () => {
    const session = withPhase(createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999), 'killerTurn')
    const withoutDoctor = { ...session, settings: { ...session.settings, enableDoctor: false } }
    expect(getNextPhase(withoutDoctor)).toBe('detectiveTurn')

    const withoutSpecials = { ...withoutDoctor, settings: { ...withoutDoctor.settings, enableDetective: false } }
    expect(getNextPhase(withoutSpecials)).toBe('nightResolution')
  })

  it('starts night actions with the killer turn', () => {
    const session = withPhase(createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999), 'nightIntro')
    expect(advancePhase(session)).toMatchObject({ phase: 'killerTurn', round: 1 })
  })

  it('keeps voting waiting for the mediator result', () => {
    const session = withPhase(createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999), 'voting')
    expect(getNextPhase(session)).toBeNull()
    expect(advancePhase(session)).toBe(session)
  })

  it('moves to game over when a team has already won', () => {
    const session = withPhase(createCidadeDormeSession(players, createDefaultCidadeDormeSettings(players.length), () => 0.999999), 'nightResolution')
    const withoutKillers: GameState = {
      ...session,
      players: session.players.map((player) => player.roleKey === 'killer' ? { ...player, status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'vote' } : player),
    }
    const next = advancePhase(withoutKillers)
    expect(next).toMatchObject({ phase: 'gameOver', winner: 'city' })
  })
})

function withPhase(session: GameState, phase: GameState['phase']): GameState {
  return { ...session, phase }
}
