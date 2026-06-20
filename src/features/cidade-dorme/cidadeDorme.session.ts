import { createId } from '../../lib/utils/createId'
import { assignRolesToPlayers, canDoctorProtect, checkWinCondition, getAlivePlayers, resolveNight, resolveVotingOutcome } from './cidadeDorme.rules'
import { isSupportedCidadeDormePlayerCount } from './cidadeDorme.setup'
import { advancePhase, CIDADE_DORME_PHASES } from './cidadeDorme.stateMachine'
import type { CidadeDormePlayerInput, DoctorSelfProtectLimit, GamePhase, GameSettings, GameState, ManualVotingOutcome, NightAction, Player, RoundHistory, VotingHistoryResult, VotingResolution } from './cidadeDorme.types'

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

export function recordKillerTarget(session: GameState, actorId: string, targetId: string): GameState {
  if (session.phase !== 'killerTurn') return session
  const alivePlayers = getAlivePlayers(session.players)
  if (!alivePlayers.some((player) => player.id === actorId && player.roleKey === 'killer')) return session
  if (actorId === targetId) return session
  if (!alivePlayers.some((player) => player.id === targetId)) return session
  return touch({
    ...session,
    currentNightAction: {
      ...session.currentNightAction,
      round: session.round,
      killerActorId: actorId,
      killerTargetId: targetId,
    },
  })
}

export function recordDoctorProtection(session: GameState, protectedPlayerId: string): GameState {
  if (session.phase !== 'doctorTurn') return session
  const alivePlayers = getAlivePlayers(session.players)
  const doctor = alivePlayers.find((player) => player.roleKey === 'doctor')
  if (!doctor || !alivePlayers.some((player) => player.id === protectedPlayerId)) return session
  if (!canDoctorProtect(doctor.id, protectedPlayerId, session.settings, getPreviousProtectedPlayerId(session), getDoctorSelfProtectCount(session, doctor.id))) return session
  return touch({
    ...session,
    currentNightAction: {
      ...session.currentNightAction,
      round: session.round,
      protectedPlayerId,
    },
  })
}

export function recordDetectiveInvestigation(session: GameState, detectiveTargetId: string): GameState {
  if (session.phase !== 'detectiveTurn') return session
  const alivePlayers = getAlivePlayers(session.players)
  const detective = alivePlayers.find((player) => player.roleKey === 'detective')
  if (!detective || detective.id === detectiveTargetId) return session
  if (!alivePlayers.some((player) => player.id === detectiveTargetId)) return session
  return touch({
    ...session,
    currentNightAction: {
      ...session.currentNightAction,
      round: session.round,
      detectiveTargetId,
    },
  })
}

export function resolveCurrentNight(session: GameState): GameState {
  if (session.phase !== 'nightResolution') return session
  if (typeof session.currentNightAction.wasProtected === 'boolean') return session
  const resolution = resolveNight(session.players, { ...session.currentNightAction, round: session.round })
  const resolvedSession = {
    ...session,
    players: resolution.players,
    currentNightAction: resolution.action,
  }
  return touch({
    ...resolvedSession,
    history: upsertRoundHistory(resolvedSession),
  })
}

export function resolveCurrentVoting(session: GameState, outcome: ManualVotingOutcome): GameState {
  if (session.phase !== 'voting') return session
  const resolution = resolveVotingOutcome(session.players, outcome, session.round)
  return applyVotingResolution(session, resolution)
}

function applyVotingResolution(session: GameState, resolution: VotingResolution): GameState {
  const resolvedSession = {
    ...session,
    players: resolution.players,
  }
  const winCondition = checkWinCondition(resolvedSession.players, resolvedSession.settings)
  if (winCondition.isGameOver) {
    return touch({
      ...resolvedSession,
      phase: 'gameOver',
      winner: winCondition.winner ?? resolvedSession.winner,
      winnerPlayerId: winCondition.winnerPlayerId ?? resolvedSession.winnerPlayerId,
      history: upsertRoundHistory(resolvedSession, resolution),
    })
  }

  const nextRound = resolvedSession.round + 1
  return touch({
    ...resolvedSession,
    phase: 'nightIntro',
    round: nextRound,
    currentNightAction: createEmptyNightAction(nextRound),
    history: upsertRoundHistory(resolvedSession, resolution),
  })
}

export function migrateCidadeDormeSession(value: unknown): GameState | null {
  if (!isRecord(value)) return null
  const session = value as Partial<GameState> & Record<string, unknown>
  const settings = normalizeSettings(session.settings)
  if (!settings) return null
  if (session.schemaVersion !== 1 || session.gameId !== 'cidade-dorme') return null
  if (typeof session.id !== 'string' || typeof session.createdAt !== 'string' || typeof session.updatedAt !== 'string') return null
  const rawPhase = value.phase
  if (typeof rawPhase !== 'string' || (!CIDADE_DORME_PHASES.includes(rawPhase as GamePhase) && rawPhase !== 'voteResolution')) return null
  if (!Number.isInteger(session.round) || session.round! < 1) return null
  if (!Array.isArray(session.players) || session.players.length !== settings.playerCount) return null
  if (!session.players.every(isPlayer)) return null
  const ids = session.players.map((player) => player.id)
  if (new Set(ids).size !== ids.length) return null
  if (!Number.isInteger(session.currentRevealIndex) || session.currentRevealIndex! < 0 || session.currentRevealIndex! >= session.players.length) return null
  if (!isNightAction(session.currentNightAction, session.round!)) return null
  if (!Array.isArray(session.history)) return null

  const round = session.round as number
  const currentRevealIndex = session.currentRevealIndex as number
  const currentNightAction = session.currentNightAction as NightAction
  const phase = rawPhase === 'voteResolution' || (rawPhase === 'voting' && Array.isArray(session.currentVotes)) ? 'dayDiscussion' : rawPhase as GamePhase
  return {
    schemaVersion: 1,
    id: session.id,
    gameId: 'cidade-dorme',
    phase,
    round,
    players: session.players,
    settings,
    currentRevealIndex,
    currentNightAction,
    history: session.history.map(normalizeRoundHistory).filter((round): round is RoundHistory => Boolean(round)),
    winner: typeof session.winner === 'string' && ['city', 'killers', 'jester'].includes(session.winner) ? session.winner : undefined,
    winnerPlayerId: typeof session.winnerPlayerId === 'string' ? session.winnerPlayerId : undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

export function isCidadeDormeSessionCompatible(value: unknown): value is GameState {
  return migrateCidadeDormeSession(value) !== null
}

function getPreviousProtectedPlayerId(session: GameState) {
  return [...session.history].reverse().find((round) => round.nightAction.protectedPlayerId)?.nightAction.protectedPlayerId
}

function getDoctorSelfProtectCount(session: GameState, doctorId: string) {
  return session.history.filter((round) => round.nightAction.protectedPlayerId === doctorId).length
}

function createEmptyNightAction(round: number): NightAction {
  return { round }
}

function upsertRoundHistory(session: GameState, votingResolution?: VotingResolution) {
  const existing = session.history.find((round) => round.round === session.round)
  const entry = {
    round: session.round,
    nightAction: session.currentNightAction,
    votingResult: votingResolution ? {
      kind: votingResolution.kind,
      eliminatedPlayerId: votingResolution.eliminatedPlayerId,
      jesterWinnerPlayerId: votingResolution.jesterWinnerPlayerId,
    } : existing?.votingResult,
    eliminatedByVoteId: votingResolution?.eliminatedPlayerId ?? existing?.eliminatedByVoteId,
    notes: existing?.notes,
  }
  return [...session.history.filter((round) => round.round !== session.round), entry].sort((a, b) => a.round - b.round)
}

function touch(session: GameState): GameState {
  return { ...session, updatedAt: new Date().toISOString() }
}

function normalizeSettings(value: unknown): GameSettings | null {
  if (!isRecord(value)) return null
  const { playerCount, killersCount } = value
  if (!(typeof playerCount === 'number'
    && typeof killersCount === 'number'
    && isSupportedCidadeDormePlayerCount(playerCount)
    && Number.isInteger(killersCount)
    && killersCount >= 1
    && killersCount < playerCount
    && typeof value.enableDoctor === 'boolean'
    && typeof value.enableDetective === 'boolean'
    && typeof value.enableJester === 'boolean'
    && typeof value.revealRoleOnDeath === 'boolean'
    && typeof value.doctorCanSelfProtect === 'boolean'
    && typeof value.doctorCanRepeatProtection === 'boolean'
    && typeof value.themeId === 'string')) return null
  return {
    playerCount,
    killersCount,
    enableDoctor: value.enableDoctor,
    enableDetective: value.enableDetective,
    enableJester: value.enableJester,
    revealRoleOnDeath: value.revealRoleOnDeath,
    doctorCanSelfProtect: value.doctorCanSelfProtect,
    doctorSelfProtectLimit: normalizeDoctorSelfProtectLimit(value.doctorSelfProtectLimit),
    doctorCanRepeatProtection: value.doctorCanRepeatProtection,
    themeId: value.themeId,
  }
}

function normalizeDoctorSelfProtectLimit(value: unknown): DoctorSelfProtectLimit {
  return value === 1 || value === 2 || value === 3 || value === 'unlimited' ? value : 1
}

function normalizeRoundHistory(value: unknown): RoundHistory | null {
  if (!isRecord(value) || typeof value.round !== 'number' || !Number.isInteger(value.round) || value.round < 1 || !isRoundNightAction(value.nightAction)) return null
  const votingResult = normalizeVotingHistoryResult(value.votingResult)
  return {
    round: value.round,
    nightAction: value.nightAction,
    votingResult,
    eliminatedByVoteId: typeof value.eliminatedByVoteId === 'string' ? value.eliminatedByVoteId : votingResult?.eliminatedPlayerId,
    notes: Array.isArray(value.notes) ? value.notes.filter((note): note is string => typeof note === 'string') : undefined,
  }
}

function normalizeVotingHistoryResult(value: unknown): VotingHistoryResult | undefined {
  if (!isRecord(value)) return undefined
  if (value.kind === 'eliminated') {
    return {
      kind: 'eliminated',
      eliminatedPlayerId: typeof value.eliminatedPlayerId === 'string' ? value.eliminatedPlayerId : undefined,
      jesterWinnerPlayerId: typeof value.jesterWinnerPlayerId === 'string' ? value.jesterWinnerPlayerId : undefined,
    }
  }
  if (typeof value.kind === 'string') return { kind: 'tie' }
  return undefined
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

function isRoundNightAction(value: unknown): value is NightAction {
  return isRecord(value) && typeof value.round === 'number' && Number.isInteger(value.round) && value.round >= 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
