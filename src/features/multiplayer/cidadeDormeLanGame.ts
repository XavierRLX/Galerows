import {
  assignRolesToPlayers, canDoctorProtect, checkWinCondition, getActiveKiller, getMurderOrder, resolveNight, resolveVotingOutcome,
} from '../cidade-dorme/cidadeDorme.rules'
import { createDefaultCidadeDormeSettings } from '../cidade-dorme/cidadeDorme.setup'
import type { DoctorSelfProtectLimit, GameSettings, GameWinner, Player, RoleKey, WinReason } from '../cidade-dorme/cidadeDorme.types'
import { defineMultiplayerGame } from './multiplayerGames'
import type { MultiplayerGameContext, MultiplayerGameTransition } from './multiplayerGames'

export const CIDADE_DORME_LAN_GAME_ID = 'cidade-dorme'
export interface CidadeDormeLanConfig {
  enableDoctor: boolean
  enableDetective: boolean
  enableJester: boolean
  revealRoleOnDeath: boolean
  /** Same editable options as the single-device game; absent values retain legacy defaults. */
  killersCount?: number
  doctorCanSelfProtect?: boolean
  doctorSelfProtectLimit?: DoctorSelfProtectLimit
  doctorCanRepeatProtection?: boolean
  /** Optional for legacy LAN room configs: absent means everyone plays. */
  conductionMode?: 'automatic' | 'mayor'
}
export type CidadeDormeLanStep = 'reveal' | 'killer-turn' | 'doctor-turn' | 'detective-turn'
  | 'detective-result' | 'morning' | 'discussion' | 'voting' | 'vote-result' | 'summary'
export interface CidadeDormeRoundHistory {
  round: number
  night: { killerId: string | null; killerTargetId: string | null; doctorId: string | null;
    doctorTargetId: string | null; detectiveId: string | null; detectiveTargetId: string | null;
    detectiveResult: 'suspect' | 'innocent' | null; savedByDoctor: boolean;
    eliminatedId: string | null }
  vote: { kind: 'tie' | 'eliminated'; eliminatedId: string | null;
    votes: { voterId: string; targetId: string }[] } | null
}
export interface CidadeDormeLanPublic {
  step: CidadeDormeLanStep
  round: number
  phaseRevision: number
  phaseEventId: string
  phaseStartedAt: number
  phaseReady?: boolean
  /** Only revealed after victory, never in snapshots while playing. */
  history?: CidadeDormeRoundHistory[] | null
  /** Oldest completed rounds omitted from the 16 KB Room projection. */
  historyOmittedRounds?: number
  paused?: boolean
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
  /** Server-validated options for the doctor, including permitted self-protection. */
  doctorEligibleTargetIds?: string[]
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
  phaseReady: boolean
  paused: boolean
  phaseRevision: number
  phaseStartedAt: number
  round: number
  seen: string[]
  night: { killerTarget?: string; protectedTarget?: string; detectiveTarget?: string }
  investigation: { targetId: string; result: 'suspect' | 'innocent' } | null
  previousProtectedTarget: string | null
  doctorSelfProtectCount: number
  nightResult: { eliminatedId: string | null } | null
  votes: Record<string, string>
  voteResult: { kind: 'tie' | 'eliminated'; eliminatedId?: string } | null
  history: CidadeDormeRoundHistory[]
  winner: GameWinner | null
  winReason: WinReason | null
  winnerPlayerId: string | null
}
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
const requiredBooleans = ['enableDoctor','enableDetective','enableJester','revealRoleOnDeath'] as const
const optionalFields = ['conductionMode','killersCount','doctorCanSelfProtect',
  'doctorSelfProtectLimit','doctorCanRepeatProtection']
function validateConfig(raw: unknown): raw is CidadeDormeLanConfig {
  return isRecord(raw)
    && Object.keys(raw).every(field => [...requiredBooleans,...optionalFields].includes(field))
    && requiredBooleans.every(field => typeof raw[field] === 'boolean')
    && (raw.conductionMode === undefined || raw.conductionMode === 'mayor' || raw.conductionMode === 'automatic')
    && (raw.killersCount === undefined || (Number.isInteger(raw.killersCount)
      && (raw.killersCount as number) >= 1 && (raw.killersCount as number) <= 3))
    && (raw.doctorCanSelfProtect === undefined || typeof raw.doctorCanSelfProtect === 'boolean')
    && (raw.doctorCanRepeatProtection === undefined || typeof raw.doctorCanRepeatProtection === 'boolean')
    && (raw.doctorSelfProtectLimit === undefined || raw.doctorSelfProtectLimit === 'unlimited'
      || raw.doctorSelfProtectLimit === 1 || raw.doctorSelfProtectLimit === 2
      || raw.doctorSelfProtectLimit === 3)
}
/** Validate the actual set of participants, never just the room membership count. */
function validComposition(config: CidadeDormeLanConfig, playerCount: number) {
  const defaults = createDefaultCidadeDormeSettings(playerCount)
  const killers = config.killersCount ?? defaults.killersCount
  return killers + Number(config.enableDoctor) + Number(config.enableDetective)
    + Number(config.enableJester) <= playerCount
}
const find = (state: LanState, id: string): Player | undefined => state.players.find(p => p.id === id)
const alive = (state: LanState) => state.players.filter(p => p.status === 'alive')
const livingRole = (state: LanState, role: RoleKey) => alive(state).filter(p => p.roleKey === role)
const killerActor = (state: LanState) => getActiveKiller(state.players, state.murderOrder)
function error(code: 'unauthorized' | 'invalid_payload' | 'invalid_phase' | 'not_participant' | 'not_ready') {
  return { accepted: false as const, error: code }
}
/** Only host-authoritative canonical phase changes increment the cue identity. */
function stampPhase(before: LanState, result: MultiplayerGameTransition<LanState>,
  context: MultiplayerGameContext): MultiplayerGameTransition<LanState> {
  if (!result.accepted || !result.changed) return result
  const after = result.state
  if (after.step === before.step && after.round === before.round) return result
  return { ...result, state: { ...after,
    phaseReady: after.config.conductionMode !== 'automatic',
    phaseRevision: before.phaseRevision + 1, phaseStartedAt: context.clock.now(),
  } }
}
/** All configured LAN roles retain their public night slot after death, even with
 * a human mayor. No player should infer a secret role from a skipped turn. */
function configuredNightRole(state:LanState,role:'doctor'|'detective'):boolean{
  return state.config.conductionMode==='automatic' || state.config.conductionMode==='mayor'
    ? (role==='doctor'?state.config.enableDoctor:state.config.enableDetective)
    : livingRole(state,role).length>0
}
function nextNightStep(state: LanState): CidadeDormeLanStep {
  return configuredNightRole(state,'doctor') ? 'doctor-turn'
    : configuredNightRole(state,'detective') ? 'detective-turn' : 'morning'
}
function resolveCurrentNight(state: LanState): LanState {
  const resolution = resolveNight(state.players, {
    round: state.round, killerActorId: killerActor(state)?.id,
    killerTargetId: state.night.killerTarget, protectedPlayerId: state.night.protectedTarget,
    detectiveTargetId: state.night.detectiveTarget,
  })
  const night: CidadeDormeRoundHistory['night'] = {
    killerId: killerActor(state)?.id ?? null,
    killerTargetId: state.night.killerTarget ?? null,
    doctorId: livingRole(state,'doctor')[0]?.id ?? null,
    doctorTargetId: state.night.protectedTarget ?? null,
    detectiveId: livingRole(state,'detective')[0]?.id ?? null,
    detectiveTargetId: state.night.detectiveTarget ?? null,
    detectiveResult: resolution.action.detectiveResult ?? null,
    savedByDoctor: Boolean(resolution.action.wasProtected),
    eliminatedId: resolution.action.eliminatedPlayerId ?? null,
  }
  const history = [...state.history.filter(entry=>entry.round!==state.round),
    { round:state.round, night, vote:null }].slice(-40)
  const next: LanState = { ...state, players: resolution.players, step: 'morning', history,
    nightResult: { eliminatedId: resolution.action.eliminatedPlayerId ?? null },
    investigation: state.night.detectiveTarget && resolution.action.detectiveResult
      ? { targetId: state.night.detectiveTarget, result: resolution.action.detectiveResult } : null }
  const win = checkWinCondition(next.players, next.settings)
  return win.isGameOver ? { ...next, step: state.config.conductionMode === 'automatic' ? 'morning' : 'summary', winner: win.winner, winReason: win.reason,
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
  validateForParticipants: (config, n) => validComposition(config,n),
  validateConfig: raw => validateConfig(raw) ? { ok: true, config: {
    enableDoctor: raw.enableDoctor, enableDetective: raw.enableDetective,
    enableJester: raw.enableJester, revealRoleOnDeath: raw.revealRoleOnDeath,
    ...(raw.conductionMode ? { conductionMode: raw.conductionMode } : {}),
    ...(raw.killersCount !== undefined ? { killersCount: raw.killersCount } : {}),
    ...(raw.doctorCanSelfProtect !== undefined ? { doctorCanSelfProtect: raw.doctorCanSelfProtect } : {}),
    ...(raw.doctorSelfProtectLimit !== undefined ? { doctorSelfProtectLimit: raw.doctorSelfProtectLimit } : {}),
    ...(raw.doctorCanRepeatProtection !== undefined ? { doctorCanRepeatProtection: raw.doctorCanRepeatProtection } : {}),
  } } : { ok: false },
  createInitialState: (config, participantIds, ctx) => {
    const recommended = createDefaultCidadeDormeSettings(participantIds.length)
    const settings: GameSettings = { ...recommended, ...config,
      playerCount: participantIds.length, themeId: recommended.themeId }
    const players = assignRolesToPlayers(participantIds.map((id, i) => ({
      id, name: `Jogador ${i + 1}`,
    })), settings, ctx.random)
    return { config, settings, players, murderOrder: getMurderOrder(players, ctx.random),
      step: 'reveal', paused: false, phaseReady: false, phaseRevision: 1, phaseStartedAt: ctx.clock.now(),
      round: 1, seen: [], night: {},
      investigation: null, previousProtectedTarget: null, doctorSelfProtectCount: 0,
      nightResult: null, votes: {},
      voteResult: null, history: [], winner: null, winReason: null, winnerPlayerId: null }
  },
  applyCommand: (state, action, context) => {
    const decision = ((): MultiplayerGameTransition<LanState> => {
    const own = find(state, action.playerId)
    const host = action.role === 'host'
    const dedicatedMayor = host && state.config.conductionMode === 'mayor' && !own
    const mayorCommands = ['START_NIGHT', 'START_DISCUSSION', 'START_VOTE', 'RESOLVE_VOTE', 'NEXT_NIGHT',
      'PAUSE_CITY', 'RESUME_CITY', 'SIMULATE_NIGHT_ROLE']
    if (!own && (!dedicatedMayor || !mayorCommands.includes(action.type))) return error('not_participant')
    const player = own ?? { id: action.playerId, roleKey: null, status: 'eliminated' as const }
    const payload = action.payload
    const p = isRecord(payload) ? payload.playerId : undefined
    if (action.type === 'PAUSE_CITY' || action.type === 'RESUME_CITY') {
      if (!host || state.config.conductionMode !== 'mayor') return error('unauthorized')
      if (payload !== null || state.step === 'summary') return error('invalid_phase')
      const paused = action.type === 'PAUSE_CITY'
      return paused === state.paused ? { accepted: true, changed: false }
        : { accepted: true, changed: true, state: { ...state, paused } }
    }
    if (state.paused) return error('invalid_phase')
    const automatic = state.config.conductionMode === 'automatic'
    const elapsed = context.clock.now() - state.phaseStartedAt
    const autoWait = (minMs:number) => automatic && elapsed < minMs
    const actionWait = automatic && !state.phaseReady
    if (action.type === 'OPEN_PHASE') {
      if (!automatic || !host) return error('unauthorized')
      const minimum: Partial<Record<CidadeDormeLanStep,number>> = {
        'killer-turn':7000, 'doctor-turn':6300, 'detective-turn':5500,
        'detective-result':7000, voting:6700,
      }
      const min = minimum[state.step]
      if (!min) return error('invalid_phase')
      if (payload !== null) return error('invalid_payload')
      if (state.phaseReady) return { accepted:true, changed:false }
      if (elapsed < min) return error('not_ready')
      return {accepted:true,changed:true,state:{...state,phaseReady:true}}
    }
    if (action.type === 'SIMULATE_NIGHT_ROLE') {
      // A roleless night turn sounds and looks identical to an active one.
      // Every automatic host sends the same generic command after the public
      // announcement + waiting period. If someone is alive, it is a no-op.
      // Crucially, the public snapshot never includes role-presence metadata.
      if (!host || (state.config.conductionMode !== 'automatic'
        && state.config.conductionMode !== 'mayor')) return error('unauthorized')
      if (payload !== null) return error('invalid_payload')
      const role = state.step === 'doctor-turn' ? 'doctor'
        : state.step === 'detective-turn' || state.step === 'detective-result'
          ? 'detective' : null
      if (!role || !configuredNightRole(state,role)) return error('invalid_phase')
      if (!state.phaseReady || elapsed < 14000) return error('not_ready')
      if (livingRole(state,role).length) return { accepted:true, changed:false }
      if (state.step === 'doctor-turn') {
        return {accepted:true,changed:true,state:state.config.enableDetective
          ? {...state,step:'detective-turn' as const}
          : resolveCurrentNight(state)}
      }
      if (state.step === 'detective-turn') {
        // Automatic sessions already give living detectives a clue-reading phase,
        // so simulate it too. A human mayor usually resolves night immediately.
        return {accepted:true,changed:true,state:automatic
          ? {...state,step:'detective-result' as const}
          : resolveCurrentNight(state)}
      }
      return {accepted:true,changed:true,state:resolveCurrentNight(state)}
    }
    if (action.type === 'ACK_ROLE') {
      if (state.step !== 'reveal' || payload !== null) return error('invalid_phase')
      if (state.seen.includes(player.id)) return { accepted: true, changed: false }
      return { accepted: true, changed: true, state: { ...state, seen: [...state.seen, player.id] } }
    }
    if (action.type === 'START_NIGHT') {
      if (!host) return error('unauthorized')
      if (state.step !== 'reveal' || payload !== null || state.seen.length !== state.players.length)
        return error('invalid_phase')
      if (autoWait(5000)) return error('not_ready')
      if (!action.connectedParticipantIds || state.players.some(x => !action.connectedParticipantIds!.includes(x.id)))
        return error('not_ready')
      return { accepted: true, changed: true, state: { ...state, step: 'killer-turn' as const } }
    }
    if (action.type === 'KILL') {
      if (state.step !== 'killer-turn') return error('invalid_phase')
      if (actionWait) return error('not_ready')
      if (killerActor(state)?.id !== player.id) return error('unauthorized')
      if (!validTarget(state, p) || p === player.id || state.murderOrder.includes(p)) return error('invalid_payload')
      const next: LanState = { ...state, night: { ...state.night, killerTarget: p } }
      return { accepted: true, changed: true, state: postNightRoleStep(next) }
    }
    if (action.type === 'PROTECT') {
      if (state.step !== 'doctor-turn') return error('invalid_phase')
      if (actionWait) return error('not_ready')
      if (player.status !== 'alive' || player.roleKey !== 'doctor') return error('unauthorized')
      if (!validTarget(state, p) || !canDoctorProtect(player.id, p, state.settings,
        state.previousProtectedTarget ?? undefined, state.doctorSelfProtectCount)) return error('invalid_payload')
      const next: LanState = { ...state, night: { ...state.night, protectedTarget: p },
        doctorSelfProtectCount: state.doctorSelfProtectCount + Number(p === player.id) }
      return { accepted: true, changed: true,
        state: configuredNightRole(state,'detective') ? { ...next, step: 'detective-turn' as const }
          : resolveCurrentNight(next) }
    }
    if (action.type === 'INVESTIGATE') {
      if (state.step !== 'detective-turn') return error('invalid_phase')
      if (actionWait) return error('not_ready')
      if (player.status !== 'alive' || player.roleKey !== 'detective') return error('unauthorized')
      if (!validTarget(state, p) || p === player.id) return error('invalid_payload')
      const next = { ...state, night:{ ...state.night, detectiveTarget:p } }
      if (automatic) {
        const verdict = resolveNight(state.players,{
          round:state.round,killerActorId:killerActor(state)?.id,killerTargetId:state.night.killerTarget,
          protectedPlayerId:state.night.protectedTarget,detectiveTargetId:p,
        }).action.detectiveResult
        return {accepted:true,changed:true,state:{...next,step:'detective-result' as const,
          investigation:{targetId:p,result:verdict ?? 'innocent'}}}
      }
      return { accepted:true,changed:true,state:resolveCurrentNight(next) }
    }
    if (action.type === 'ACK_INVESTIGATION') {
      if (!automatic || state.step !== 'detective-result' || payload !== null) return error('invalid_phase')
      if (player.status !== 'alive' || player.roleKey !== 'detective') return error('unauthorized')
      if (!state.phaseReady || elapsed < 6500) return error('not_ready')
      return {accepted:true,changed:true,state:resolveCurrentNight(state)}
    }
    if (action.type === 'START_DISCUSSION') {
      if (!host) return error('unauthorized')
      if (state.step !== 'morning' || payload !== null) return error('invalid_phase')
      if (autoWait(7000)) return error('not_ready')
      return { accepted:true,changed:true,state:{...state,
        step:state.winner && automatic ? 'summary' as const : 'discussion' as const} }
    }
    if (action.type === 'START_VOTE') {
      if (!host) return error('unauthorized')
      if (state.step !== 'discussion' || payload !== null) return error('invalid_phase')
      if (autoWait(35000)) return error('not_ready')
      return { accepted: true, changed: true, state: { ...state, step: 'voting' as const, votes: {} } }
    }
    if (action.type === 'CAST_VOTE') {
      if (state.step !== 'voting') return error('invalid_phase')
      if (actionWait) return error('not_ready')
      if (player.status !== 'alive') return error('unauthorized')
      if (Object.hasOwn(state.votes, player.id)) return error('invalid_phase')
      if (!validTarget(state, p)) return error('invalid_payload')
      return { accepted: true, changed: true, state: {
        ...state, votes: { ...state.votes, [player.id]: p },
      } }
    }
    if (action.type === 'RESOLVE_VOTE') {
      if (!host) return error('unauthorized')
      if (state.step !== 'voting' || payload !== null) return error('invalid_phase')
      if (autoWait(7000)) return error('not_ready')
      if (Object.keys(state.votes).length !== alive(state).length) return error('not_ready')
      const totals: Record<string, number> = {}
      for (const target of Object.values(state.votes)) totals[target] = (totals[target] ?? 0) + 1
      const highest = Math.max(...Object.values(totals))
      const leaders = Object.keys(totals).filter(id => totals[id] === highest)
      const outcome = leaders.length === 1
        ? { kind: 'eliminated' as const, playerId: leaders[0] }
        : { kind: 'tie' as const }
      const result = resolveVotingOutcome(state.players, outcome, state.round)
      const history = state.history.map(entry=>entry.round !== state.round ? entry : {
        ...entry,vote:{kind:result.kind === 'tie'?'tie' as const:'eliminated' as const,
          eliminatedId:result.eliminatedPlayerId ?? null,
          votes:Object.entries(state.votes).map(([voterId,targetId])=>({voterId,targetId}))},
      })
      const next: LanState = { ...state, players: result.players, step: 'vote-result', history,
        voteResult: result.kind === 'tie' ? { kind: 'tie' } : {
          kind: 'eliminated', eliminatedId: result.eliminatedPlayerId },
        votes: {} }
      const win = checkWinCondition(next.players, next.settings)
      return { accepted: true, changed: true, state: win.isGameOver
        ? { ...next, step: automatic ? 'vote-result' : 'summary', winner: win.winner, winReason: win.reason,
          winnerPlayerId: win.winnerPlayerId ?? null } : next }
    }
    if (action.type === 'NEXT_NIGHT') {
      if (!host) return error('unauthorized')
      if (state.step !== 'vote-result' || payload !== null) return error('invalid_phase')
      if (autoWait(9000)) return error('not_ready')
      return {accepted:true,changed:true,state:state.winner && automatic
        ? {...state,step:'summary' as const} : nextRound(state)}
    }
    return error('invalid_phase')
    })()
    return stampPhase(state, decision, context)
  },
  awardPoints: state => state.step === 'summary'
    ? Object.fromEntries(state.players.map(player => [player.id,
      state.winner === 'jester' ? (player.id === state.winnerPlayerId ? 2 : 0)
        : state.winner === 'killers' ? (state.murderOrder.includes(player.id) ? 2 : 0)
          : (!state.murderOrder.includes(player.id) && player.roleKey !== 'jester' ? 2 : 0)])) : null,
  projectPublic: (state): CidadeDormeLanPublic => ({
    step: state.step, paused: state.paused, round: state.round,
    phaseRevision: state.phaseRevision, phaseStartedAt: state.phaseStartedAt,
    phaseReady: state.phaseReady, history: state.step === 'summary' ? state.history.slice(-12) : null,
    historyOmittedRounds: state.step === 'summary' ? Math.max(0,state.history.length-12) : 0,
    phaseEventId: `city:phase:${state.phaseRevision}:${state.round}:${state.step}`,
    seenCount: state.seen.length,
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
    winner: state.step==='summary'?state.winner:null,
    winReason: state.step==='summary'?state.winReason:null,
    winnerPlayerId: state.step==='summary'?state.winnerPlayerId:null,
    finalRoles: state.step === 'summary'
      ? state.players.map(player => ({ id: player.id, role: player.roleKey! })) : null,
  }),
  projectModerator: (state) => ({
    kind: 'mayor-consultation' as const,
    roles: state.players.map(player => ({ playerId: player.id, role: player.roleKey!,
      alive: player.status === 'alive' })),
    successionOrder: [...state.murderOrder],
    actions: {
      ...(state.night.killerTarget ? { killerTarget: state.night.killerTarget } : {}),
      ...(state.night.protectedTarget ? { protectedTarget: state.night.protectedTarget } : {}),
      ...(state.night.detectiveTarget ? { detectiveTarget: state.night.detectiveTarget } : {}),
      ...(state.investigation ? { investigation: { ...state.investigation } } : {}),
    },
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
      ...(own.roleKey === 'doctor' && own.status === 'alive' && state.step === 'doctor-turn'
        ? { doctorEligibleTargetIds: alive(state).filter(target=>canDoctorProtect(own.id,target.id,
          state.settings,state.previousProtectedTarget??undefined,state.doctorSelfProtectCount))
          .map(target=>target.id) } : {}),
      ...(own.roleKey === 'detective' && state.investigation && state.step !== 'summary'
        ? { investigation: { ...state.investigation } } : {}),
      voted: Object.hasOwn(state.votes, playerId),
      canAct: !state.paused && (state.config.conductionMode!=='automatic' || state.phaseReady)
        && own.status === 'alive' && (
        (state.step === 'killer-turn' && killerActor(state)?.id === playerId)
        || (state.step === 'doctor-turn' && own.roleKey === 'doctor')
        || (state.step === 'detective-turn' && own.roleKey === 'detective')
        || state.step === 'voting'),
    }
  },
})
