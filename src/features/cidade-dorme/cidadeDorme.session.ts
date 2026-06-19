import { createId } from '../../lib/utils/createId'
import { assignRolesToPlayers, canDoctorProtect, getAlivePlayers } from './cidadeDorme.rules'
import { isSupportedCidadeDormePlayerCount } from './cidadeDorme.setup'
import { advancePhase, CIDADE_DORME_PHASES } from './cidadeDorme.stateMachine'
import type { CidadeDormePlayerInput, GamePhase, GameSettings, GameState, NightAction, Player } from './cidadeDorme.types'

export function createCidadeDormeSession(players: CidadeDormePlayerInput[], settings: GameSettings, random: () => number = Math.random): GameState {
  const assignedPlayers = assignRolesToPlayers(players, settings, random)
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: createId('cidade-dorme'),
    gameId: 'cidade-dorme',
    phase: 'revealRoles',
    round: 1,
    players: assignedPlayers,
    settings: { ...settings },
    currentRevealIndex: 0,
    currentNightAction: createEmptyNightAction(1),
    currentVotes: [],
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function advanceRoleReveal(session: GameState): GameState {
  if (session.phase !== 'revealRoles') return session
  if (session.currentRevealIndex < session.players.length - 1) return touch({ ...session, currentRevealIndex: session.currentRevealIndex + 1 })
  return advancePhase({ ...session, currentRevealIndex: session.players.length - 1 })
}

export function recordKillerTarget(session: GameState, targetId: string): GameState {
  if (session.phase !== 'killerTurn') return session
  if (!getAlivePlayers(session.players).some((player) => player.id === targetId)) return session
  return touch({
    ...session,
    currentNightAction: {
      ...session.currentNightAction,
      round: session.round,
      killerTargetId: targetId,
    },
  })
}

export function recordDoctorProtection(session: GameState, protectedPlayerId: string): GameState {
  if (session.phase !== 'doctorTurn') return session
  const alivePlayers = getAlivePlayers(session.players)
  const doctor = alivePlayers.find((player) => player.roleKey === 'doctor')
  if (!doctor || !alivePlayers.some((player) => player.id === protectedPlayerId)) return session
  if (!canDoctorProtect(doctor.id, protectedPlayerId, session.settings, getPreviousProtectedPlayerId(session))) return session
  return touch({
    ...session,
    currentNightAction: {
      ...session.currentNightAction,
      round: session.round,
      protectedPlayerId,
    },
  })
}

export function isCidadeDormeSessionCompatible(value: unknown): value is GameState {
  if (!isRecord(value)) return false
  const session = value as Partial<GameState>
  if (session.schemaVersion !== 1 || session.gameId !== 'cidade-dorme') return false
  if (typeof session.id !== 'string' || typeof session.createdAt !== 'string' || typeof session.updatedAt !== 'string') return false
  if (typeof session.phase !== 'string' || !CIDADE_DORME_PHASES.includes(session.phase as GamePhase)) return false
  if (!Number.isInteger(session.round) || session.round! < 1) return false
  if (!isSettings(session.settings)) return false
  if (!Array.isArray(session.players) || session.players.length !== session.settings.playerCount) return false
  if (!session.players.every(isPlayer)) return false
  const ids = session.players.map((player) => player.id)
  if (new Set(ids).size !== ids.length) return false
  if (!Number.isInteger(session.currentRevealIndex) || session.currentRevealIndex! < 0 || session.currentRevealIndex! >= session.players.length) return false
  if (!isNightAction(session.currentNightAction, session.round!)) return false
  if (!Array.isArray(session.currentVotes)) return false
  if (!Array.isArray(session.history)) return false
  return true
}

function getPreviousProtectedPlayerId(session: GameState) {
  return [...session.history].reverse().find((round) => round.nightAction.protectedPlayerId)?.nightAction.protectedPlayerId
}

function createEmptyNightAction(round: number): NightAction {
  return { round }
}

function touch(session: GameState): GameState {
  return { ...session, updatedAt: new Date().toISOString() }
}

function isSettings(value: unknown): value is GameSettings {
  if (!isRecord(value)) return false
  const { playerCount, killersCount } = value
  return typeof playerCount === 'number'
    && typeof killersCount === 'number'
    && isSupportedCidadeDormePlayerCount(playerCount)
    && Number.isInteger(killersCount)
    && killersCount >= 1
    && killersCount < playerCount
    && typeof value.enableDoctor === 'boolean'
    && typeof value.enableDetective === 'boolean'
    && typeof value.enableJester === 'boolean'
    && typeof value.revealRoleOnDeath === 'boolean'
    && typeof value.allowSkipVote === 'boolean'
    && ['noElimination', 'revoteTied', 'mediatorDecision'].includes(String(value.tieRule))
    && typeof value.doctorCanSelfProtect === 'boolean'
    && typeof value.doctorCanRepeatProtection === 'boolean'
    && ['instant', 'parallel'].includes(String(value.jesterWinMode))
    && typeof value.themeId === 'string'
}

function isPlayer(value: unknown): value is Player {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && (value.sourcePlayerId === undefined || typeof value.sourcePlayerId === 'string')
    && (value.isGuest === undefined || typeof value.isGuest === 'boolean')
    && ['citizen', 'killer', 'detective', 'doctor', 'jester'].includes(String(value.roleKey))
    && ['alive', 'eliminated'].includes(String(value.status))
}

function isNightAction(value: unknown, round: number) {
  return isRecord(value) && value.round === round
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
