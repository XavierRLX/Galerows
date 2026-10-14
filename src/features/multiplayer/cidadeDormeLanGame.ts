import {
  assignRolesToPlayers, canDoctorProtect, checkWinCondition, getActiveKiller, getMurderOrder, resolveNight, resolveVotingOutcome,
} from '../cidade-dorme/cidadeDorme.rules'
import { createDefaultCidadeDormeSettings, getRecommendedKillersCount } from '../cidade-dorme/cidadeDorme.setup'
import type { GameSettings, GameWinner, Player, RoleKey, WinReason } from '../cidade-dorme/cidadeDorme.types'
import { defineMultiplayerGame } from './multiplayerGames'

export const CIDADE_DORME_LAN_GAME_ID = 'cidade-dorme'
export interface CidadeDormeLanConfig {
  enableDoctor: boolean
  enableDetective: boolean
  enableJester: boolean
  revealRoleOnDeath: boolean
}
export type CidadeDormeLanStep = 'reveal' | 'killer-turn' | 'doctor-turn' | 'detective-turn'
  | 'morning' | 'discussion' | 'voting' | 'vote-result' | 'summary'
export interface CidadeDormeLanPublic {
  step: CidadeDormeLanStep
  round: number
  seenCount: number
  totalPlayers: number
  players: { id: string; alive: boolean; revealedRole?: RoleKey }[]
  votedCount: number
  eligibleVoters: number
  nightResult: { eliminatedId: string | null } | null
  voteResult: { kind: 'tie' | 'eliminated'; eliminatedId?: string } | null
  winner: GameWinner | null
  winReason: WinReason | null
  winnerPlayerId: string | null
  finalRoles: { id: string; role: RoleKey }[] | null
}
export interface CidadeDormeLanPrivate {
  role: RoleKey
  alive: boolean
  acknowledged: boolean
  killerTeammates?: string[]
  successionOrder?: string[]
  activeKiller?: boolean
  investigation?: { targetId: string; result: 'suspect' | 'innocent' }
  voted: boolean
  canAct: boolean
}
interface LanState {
  config: CidadeDormeLanConfig
  settings: GameSettings
  players: Player[]
  murderOrder: string[]
  step: CidadeDormeLanStep
  round: number
  seen: string[]
  night: { killerTarget?: string; protectedTarget?: string; detectiveTarget?: string }
  investigation: { targetId: string; result: 'suspect' | 'innocent' } | null
  previousProtectedTarget: string | null
  nightResult: { eliminatedId: string | null } | null
  votes: Record<string, string>
  voteResult: { kind: 'tie' | 'eliminated'; eliminatedId?: string } | null
  winner: GameWinner | null
  winReason: WinReason | null
  winnerPlayerId: string | null
}
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
function validateConfig(raw: unknown): raw is CidadeDormeLanConfig {
  return isRecord(raw) && Object.keys(raw).length === 4
    && ['enableDoctor', 'enableDetective', 'enableJester', 'revealRoleOnDeath']
      .every(field => typeof raw[field] === 'boolean')
}
const find = (state: LanState, id: string): Player | undefined => state.players.find(p => p.id === id)
const alive = (state: LanState) => state.players.filter(p => p.status === 'alive')
const livingRole = (state: LanState, role: RoleKey) => alive(state).filter(p => p.roleKey === role)
const killerActor = (state: LanState) => getActiveKiller(state.players, state.murderOrder)
function error(code: 'unauthorized' | 'invalid_payload' | 'invalid_phase' | 'not_participant' | 'not_ready') {
  return { accepted: false as const, error: code }
}
function nextNightStep(state: LanState): CidadeDormeLanStep {
  return livingRole(state, 'doctor').length > 0 ? 'doctor-turn'
    : livingRole(state, 'detective').length > 0 ? 'detective-turn' : 'morning'
}
function resolveCurrentNight(state: LanState): LanState {
  const resolution = resolveNight(state.players, {
    round: state.round, killerActorId: killerActor(state)?.id,
    killerTargetId: state.night.killerTarget, protectedPlayerId: state.night.protectedTarget,
    detectiveTargetId: state.night.detectiveTarget,
  })
  const next: LanState = { ...state, players: resolution.players, step: 'morning',
    nightResult: { eliminatedId: resolution.action.eliminatedPlayerId ?? null },
    investigation: state.night.detectiveTarget && resolution.action.detectiveResult
      ? { targetId: state.night.detectiveTarget, result: resolution.action.detectiveResult } : null }
  const win = checkWinCondition(next.players, next.settings)
  return win.isGameOver ? { ...next, step: 'summary', winner: win.winner, winReason: win.reason,
    winnerPlayerId: win.winnerPlayerId ?? null } : next
}
function postNightRoleStep(state: LanState): LanState {
  const step = nextNightStep(state)
  return step === 'morning' ? resolveCurrentNight(state) : { ...state, step }
}
function nextRound(state: LanState): LanState {
  const next: LanState = { ...state, step: 'killer-turn', round: state.round + 1,
    previousProtectedTarget: state.night.protectedTarget ?? state.previousProtectedTarget,
    night: {}, nightResult: null, votes: {}, voteResult: null, investigation: null }
  return next
}
function validTarget(state: LanState, targetId: unknown): targetId is string {
  return typeof targetId === 'string' && Boolean(find(state, targetId)?.status === 'alive')
}
export const cidadeDormeLanGame = defineMultiplayerGame<CidadeDormeLanConfig, LanState>({
  gameId: CIDADE_DORME_LAN_GAME_ID, minPlayers: 4, maxPlayers: 12,
  validateConfig: raw => validateConfig(raw) ? { ok: true, config: {
    enableDoctor: raw.enableDoctor, enableDetective: raw.enableDetective,
    enableJester: raw.enableJester, revealRoleOnDeath: raw.revealRoleOnDeath,
  } } : { ok: false },
  createInitialState: (config, participantIds, ctx) => {
    const recommended = createDefaultCidadeDormeSettings(participantIds.length)
    const settings: GameSettings = { ...recommended, ...config,
      killersCount: getRecommendedKillersCount(participantIds.length) }
    const players = assignRolesToPlayers(participantIds.map((id, i) => ({
      id, name: `Jogador ${i + 1}`,
    })), settings, ctx.random)
    return { config, settings, players, murderOrder: getMurderOrder(players, ctx.random),
      step: 'reveal', round: 1, seen: [], night: {},
      investigation: null, previousProtectedTarget: null, nightResult: null, votes: {},
      voteResult: null, winner: null, winReason: null, winnerPlayerId: null }
  },
  applyCommand: (state, action) => {
    const own = find(state, action.playerId)
    if (!own) return error('not_participant')
    const host = action.role === 'host'
    const payload = action.payload
    const p = isRecord(payload) ? payload.playerId : undefined
    if (action.type === 'ACK_ROLE') {
      if (state.step !== 'reveal' || payload !== null) return error('invalid_phase')
      if (state.seen.includes(own.id)) return { accepted: true, changed: false }
      return { accepted: true, changed: true, state: { ...state, seen: [...state.seen, own.id] } }
    }
    if (action.type === 'START_NIGHT') {
      if (!host) return error('unauthorized')
      if (state.step !== 'reveal' || payload !== null || state.seen.length !== state.players.length)
        return error('invalid_phase')
      if (!action.connectedParticipantIds || state.players.some(x => !action.connectedParticipantIds!.includes(x.id)))
        return error('not_ready')
      return { accepted: true, changed: true, state: { ...state, step: 'killer-turn' as const } }
    }
    if (action.type === 'KILL') {
      if (state.step !== 'killer-turn') return error('invalid_phase')
      if (killerActor(state)?.id !== own.id) return error('unauthorized')
      if (!validTarget(state, p) || p === own.id || state.murderOrder.includes(p)) return error('invalid_payload')
      const next: LanState = { ...state, night: { ...state.night, killerTarget: p } }
      return { accepted: true, changed: true, state: postNightRoleStep(next) }
    }
    if (action.type === 'PROTECT') {
      if (state.step !== 'doctor-turn') return error('invalid_phase')
      if (own.status !== 'alive' || own.roleKey !== 'doctor') return error('unauthorized')
      if (!validTarget(state, p) || !canDoctorProtect(own.id, p, state.settings,
        state.previousProtectedTarget ?? undefined)) return error('invalid_payload')
      const next: LanState = { ...state, night: { ...state.night, protectedTarget: p } }
      return { accepted: true, changed: true,
        state: livingRole(state, 'detective').length ? { ...next, step: 'detective-turn' as const }
          : resolveCurrentNight(next) }
    }
    if (action.type === 'INVESTIGATE') {
      if (state.step !== 'detective-turn') return error('invalid_phase')
      if (own.status !== 'alive' || own.roleKey !== 'detective') return error('unauthorized')
      if (!validTarget(state, p) || p === own.id) return error('invalid_payload')
      return { accepted: true, changed: true,
        state: resolveCurrentNight({ ...state, night: { ...state.night, detectiveTarget: p } }) }
    }
    if (action.type === 'START_DISCUSSION') {
      if (!host) return error('unauthorized')
      if (state.step !== 'morning' || payload !== null) return error('invalid_phase')
      return { accepted: true, changed: true, state: { ...state, step: 'discussion' as const } }
    }
    if (action.type === 'START_VOTE') {
      if (!host) return error('unauthorized')
      if (state.step !== 'discussion' || payload !== null) return error('invalid_phase')
      return { accepted: true, changed: true, state: { ...state, step: 'voting' as const, votes: {} } }
    }
    if (action.type === 'CAST_VOTE') {
      if (state.step !== 'voting') return error('invalid_phase')
      if (own.status !== 'alive') return error('unauthorized')
      if (Object.hasOwn(state.votes, own.id)) return error('invalid_phase')
      if (!validTarget(state, p)) return error('invalid_payload')
      return { accepted: true, changed: true, state: {
        ...state, votes: { ...state.votes, [own.id]: p },
      } }
    }
    if (action.type === 'RESOLVE_VOTE') {
      if (!host) return error('unauthorized')
      if (state.step !== 'voting' || payload !== null) return error('invalid_phase')
      if (Object.keys(state.votes).length !== alive(state).length) return error('not_ready')
      const totals: Record<string, number> = {}
      for (const target of Object.values(state.votes)) totals[target] = (totals[target] ?? 0) + 1
      const highest = Math.max(...Object.values(totals))
      const leaders = Object.keys(totals).filter(id => totals[id] === highest)
      const outcome = leaders.length === 1
        ? { kind: 'eliminated' as const, playerId: leaders[0] }
        : { kind: 'tie' as const }
      const result = resolveVotingOutcome(state.players, outcome, state.round)
      const next: LanState = { ...state, players: result.players, step: 'vote-result',
        voteResult: result.kind === 'tie' ? { kind: 'tie' } : {
          kind: 'eliminated', eliminatedId: result.eliminatedPlayerId },
        votes: {} }
      const win = checkWinCondition(next.players, next.settings)
      return { accepted: true, changed: true, state: win.isGameOver
        ? { ...next, step: 'summary', winner: win.winner, winReason: win.reason,
          winnerPlayerId: win.winnerPlayerId ?? null } : next }
    }
    if (action.type === 'NEXT_NIGHT') {
      if (!host) return error('unauthorized')
      if (state.step !== 'vote-result' || payload !== null) return error('invalid_phase')
      return { accepted: true, changed: true, state: nextRound(state) }
    }
    return error('invalid_phase')
  },
  awardPoints: state => state.step === 'summary'
    ? Object.fromEntries(state.players.map(player => [player.id,
      state.winner === 'jester' ? (player.id === state.winnerPlayerId ? 2 : 0)
        : state.winner === 'killers' ? (state.murderOrder.includes(player.id) ? 2 : 0)
          : (!state.murderOrder.includes(player.id) && player.roleKey !== 'jester' ? 2 : 0)])) : null,
  projectPublic: (state): CidadeDormeLanPublic => ({
    step: state.step, round: state.round, seenCount: state.seen.length,
    totalPlayers: state.players.length,
    players: state.players.map(player => ({
      id: player.id, alive: player.status === 'alive',
      ...(player.status === 'eliminated' && state.config.revealRoleOnDeath
        ? { revealedRole: player.roleKey! } : {}),
    })),
    votedCount: Object.keys(state.votes).length,
    eligibleVoters: alive(state).length,
    nightResult: ['morning', 'discussion', 'voting', 'vote-result', 'summary'].includes(state.step)
      ? state.nightResult : null,
    voteResult: ['vote-result', 'summary'].includes(state.step) ? state.voteResult : null,
    winner: state.winner, winReason: state.winReason, winnerPlayerId: state.winnerPlayerId,
    finalRoles: state.step === 'summary'
      ? state.players.map(player => ({ id: player.id, role: player.roleKey! })) : null,
  }),
  projectPrivate: (state, playerId): CidadeDormeLanPrivate | null => {
    const own = find(state, playerId)
    if (!own) return null
    return { role: own.roleKey!, alive: own.status === 'alive',
      acknowledged: state.seen.includes(playerId),
      ...(state.murderOrder.includes(playerId) ? {
        killerTeammates: state.murderOrder.filter(id => id !== playerId),
        successionOrder: [...state.murderOrder],
        activeKiller: killerActor(state)?.id === playerId,
      } : {}),
      ...(own.roleKey === 'detective' && state.investigation && state.step !== 'summary'
        ? { investigation: { ...state.investigation } } : {}),
      voted: Object.hasOwn(state.votes, playerId),
      canAct: own.status === 'alive' && (
        (state.step === 'killer-turn' && killerActor(state)?.id === playerId)
        || (state.step === 'doctor-turn' && own.roleKey === 'doctor')
        || (state.step === 'detective-turn' && own.roleKey === 'detective')
        || state.step === 'voting'),
    }
  },
})
