import { checkWinCondition, getAlivePlayers } from './cidadeDorme.rules'
import type { GamePhase, GameState, RoleKey } from './cidadeDorme.types'

export const CIDADE_DORME_PHASES: GamePhase[] = [
  'setup',
  'revealRoles',
  'nightIntro',
  'killerTurn',
  'doctorTurn',
  'detectiveTurn',
  'nightResolution',
  'dayDiscussion',
  'voting',
  'voteResolution',
  'gameOver',
]

export function getNextPhase(session: GameState): GamePhase | null {
  if (session.phase === 'gameOver') return null

  const winCondition = checkWinCondition(session.players, session.settings)
  if (winCondition.isGameOver && session.phase !== 'setup' && session.phase !== 'revealRoles') return 'gameOver'

  switch (session.phase) {
    case 'setup':
      return 'revealRoles'
    case 'revealRoles':
      return isLastReveal(session) ? 'nightIntro' : null
    case 'nightIntro':
      return 'killerTurn'
    case 'killerTurn':
      return getNextSpecialNightPhase(session, 'doctor')
    case 'doctorTurn':
      return getNextSpecialNightPhase(session, 'detective')
    case 'detectiveTurn':
      return 'nightResolution'
    case 'nightResolution':
      return 'dayDiscussion'
    case 'dayDiscussion':
      return 'voting'
    case 'voting':
      return 'voteResolution'
    case 'voteResolution':
      return 'nightIntro'
  }
}

export function canTransitionToPhase(session: GameState, phase: GamePhase) {
  return getNextPhase(session) === phase
}

export function advancePhase(session: GameState): GameState {
  const phase = getNextPhase(session)
  if (!phase || !canTransitionToPhase(session, phase)) return session

  const winCondition = checkWinCondition(session.players, session.settings)
  if (phase === 'gameOver') {
    return touch({
      ...session,
      phase,
      winner: winCondition.winner ?? session.winner,
      winnerPlayerId: winCondition.winnerPlayerId ?? session.winnerPlayerId,
    })
  }

  if (session.phase === 'voteResolution' && phase === 'nightIntro') {
    const round = session.round + 1
    return touch({
      ...session,
      phase,
      round,
      currentNightAction: { round },
      currentVotes: [],
    })
  }

  return touch({ ...session, phase })
}

function getNextSpecialNightPhase(session: GameState, roleKey: RoleKey): GamePhase {
  if (roleKey === 'doctor' && hasLivingEnabledRole(session, 'doctor')) return 'doctorTurn'
  if (roleKey === 'detective' && hasLivingEnabledRole(session, 'detective')) return 'detectiveTurn'
  return roleKey === 'doctor' ? getNextSpecialNightPhase(session, 'detective') : 'nightResolution'
}

function hasLivingEnabledRole(session: GameState, roleKey: RoleKey) {
  if (roleKey === 'doctor' && !session.settings.enableDoctor) return false
  if (roleKey === 'detective' && !session.settings.enableDetective) return false
  return getAlivePlayers(session.players).some((player) => player.roleKey === roleKey)
}

function isLastReveal(session: GameState) {
  return session.currentRevealIndex >= session.players.length - 1
}

function touch(session: GameState): GameState {
  return { ...session, updatedAt: new Date().toISOString() }
}
