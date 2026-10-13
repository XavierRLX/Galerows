import { createBarrier, completeBarrier } from './barrier'
import type { BarrierState } from './barrier'
import { systemClock } from './clock'
import type { Clock } from './clock'
import type { RoomEffect } from './gameAdapter'
import type { MultiplayerGameContext, RegisteredMultiplayerGame } from './multiplayerGames'
import { isJsonValue, parseRoomCommandV2, PERSISTENT_ROOM_PROTOCOL_VERSION, roomFrameFits } from './persistentProtocol'
import type { RoomCommandV2, RoomCommandError, RoomCommandResultV2, RoomEventV2,
  RoomCompetitionV2, RoomPhase, RoomSnapshotV2, RoomStatePublicV2 } from './persistentProtocol'

type Receipt = { command: RoomCommandV2; result: RoomCommandResultV2 }
const RECENT_COMMAND_ID_LIMIT = 64
interface Membership {
  playerId: string
  connectionId: string | null
  role: 'host' | 'guest'
  ready: boolean
  participation: 'active' | 'waiting'
  displayName?: string
  nextClientSeq: number
  recentCommandIds: string[]
  lastReceipt?: Receipt
}
interface GameSession {
  gameSessionId: string
  gameId: string
  status: 'running' | 'completed' | 'aborted'
  participantIds: readonly string[]
  config: unknown
  gameState: unknown
  barriers: Map<string, BarrierState>
}
interface CanonicalRoom {
  phase: RoomPhase
  selectedGameId: string | null
  selectedConfig: unknown | null
  configured: boolean
  session: GameSession | null
  lastPublicResult: { gameSessionId: string; gameId: string; status: 'completed' | 'aborted' } | null
  sessionOrdinal: number
  competition: RoomCompetitionV2
}
interface Candidate { state: CanonicalRoom; members: Map<string, Membership>; changed: boolean }
type Reduction = { ok: true; candidate: Candidate } | { ok: false; error: RoomCommandError }
export interface RoomDeliveryV2 { playerId: string; connectionId: string; event: RoomEventV2 }
export interface RoomCommandOutcomeV2 { result: RoomCommandResultV2; deliveries: readonly RoomDeliveryV2[]; deduplicated: boolean }
export type RoomJoinV2 = { ok: true; playerId: string; snapshot: RoomSnapshotV2; deliveries: readonly RoomDeliveryV2[] }
  | { ok: false; error: RoomCommandError }
export type RoomSnapshotOutcomeV2 = { ok: true; snapshot: RoomSnapshotV2 }
  | { ok: false; error: RoomCommandError }
export type RoomPresenceV2 = { ok: true; snapshot?: RoomSnapshotV2; deliveries: readonly RoomDeliveryV2[] }
  | { ok: false; error: RoomCommandError }

/** Fixed lifecycle adapter; game reducers are selected only within the canonical GameSession. */
export class RoomLifecycleAdapter {
  private readonly games: ReadonlyMap<string, RegisteredMultiplayerGame>

  constructor(games: readonly RegisteredMultiplayerGame[]) {
    const byId = new Map<string, RegisteredMultiplayerGame>()
    for (const game of games) {
      if (byId.has(game.gameId) || !game.gameId || !Number.isSafeInteger(game.minPlayers)
        || !Number.isSafeInteger(game.maxPlayers) || game.minPlayers < 1
        || game.maxPlayers < game.minPlayers || game.maxPlayers > 12) throw new Error('invalid_multiplayer_catalog')
      byId.set(game.gameId, game)
    }
    this.games = byId
  }

  game(gameId: string) { return this.games.get(gameId) }

  reduce(command: RoomCommandV2, roomId: string, current: CanonicalRoom,
    sourceMembers: ReadonlyMap<string, Membership>, context: MultiplayerGameContext): Reduction {
    const members = cloneMembers(sourceMembers)
    const state = cloneRoom(current)
    const actor = members.get(command.playerId)!
    if (command.scope === 'game') return this.reduceGame(command, state, members, context)

    const hostAction = command.type === 'SELECT_GAME' || command.type === 'CONFIGURE_GAME'
      || command.type === 'START_GAME' || command.type === 'END_GAME'
      || command.type === 'RETURN_TO_LOBBY' || command.type === 'FINISH_SESSION'
    if (hostAction && actor.role !== 'host') return { ok: false, error: 'unauthorized' }
    // The champion ceremony is terminal for this tournament, not for the WSS
    // connection: existing members can still see standings and exit gracefully.
    if (state.competition.status === 'finished') return { ok: false, error: 'invalid_phase' }
    if (command.type === 'FINISH_SESSION') {
      if (state.phase !== 'lobby' || state.competition.completedGames === 0
        || command.payload !== null) return { ok: false, error: 'invalid_phase' }
      const leaders = competitionLeaders(state.competition)
      state.competition = { ...state.competition, status: 'finished', winnerPlayerIds: leaders }
      return { ok: true, candidate: { state, members, changed: true } }
    }
    if (command.type === 'SELECT_GAME') {
      if (state.phase !== 'lobby' && state.phase !== 'configuring') return { ok: false, error: 'invalid_phase' }
      const gameId = field(command.payload, 'gameId')
      if (typeof gameId !== 'string' || !this.games.has(gameId)) return { ok: false, error: 'unsupported_game' }
      state.phase = 'configuring'; state.selectedGameId = gameId; state.selectedConfig = null
      state.configured = false
      state.session = null; state.lastPublicResult = null
      for (const member of members.values()) member.ready = false
      return { ok: true, candidate: { state, members, changed: true } }
    }
    if (command.type === 'CONFIGURE_GAME') {
      if (state.phase !== 'configuring' || !state.selectedGameId) return { ok: false, error: 'invalid_phase' }
      const validated = this.games.get(state.selectedGameId)!.validateConfig(command.payload)
      if (!validated.ok) return { ok: false, error: 'invalid_config' }
      const changed = !state.configured || !equal(state.selectedConfig, validated.config)
        || [...members.values()].some(member => member.ready)
      state.selectedConfig = validated.config
      state.configured = true
      for (const member of members.values()) member.ready = false
      return { ok: true, candidate: { state, members, changed } }
    }
    if (command.type === 'READY') {
      if (state.phase !== 'lobby' && state.phase !== 'configuring') return { ok: false, error: 'invalid_phase' }
      const ready = field(command.payload, 'ready')
      if (typeof ready !== 'boolean') return { ok: false, error: 'invalid_payload' }
      const changed = actor.ready !== ready
      actor.ready = ready
      return { ok: true, candidate: { state, members, changed } }
    }
    if (command.type === 'START_GAME') {
      if (state.phase !== 'configuring' || !state.selectedGameId || !state.configured) {
        return { ok: false, error: 'invalid_phase' }
      }
      const game = this.games.get(state.selectedGameId)!
      const validated = game.validateConfig(state.selectedConfig)
      if (!validated.ok) return { ok: false, error: 'invalid_config' }
      const connected = [...members.values()].filter(member => member.connectionId !== null)
      if (!actor.connectionId || connected.some(member => !member.ready)) return { ok: false, error: 'not_ready' }
      if (connected.length < game.minPlayers || connected.length > game.maxPlayers) {
        return { ok: false, error: 'invalid_player_count' }
      }
      const participants = connected.map(member => member.playerId)
      const ordinal = state.sessionOrdinal + 1
      const gameSessionId = `${roomId}:game-${ordinal}`
      const gameState = game.createInitialState(validated.config, participants, context)
      state.sessionOrdinal = ordinal
      state.session = { gameSessionId, gameId: game.gameId, status: 'running', participantIds: participants,
        config: validated.config, gameState, barriers: new Map() }
      state.phase = 'playing'; state.lastPublicResult = null
      for (const member of members.values()) member.participation = participants.includes(member.playerId) ? 'active' : 'waiting'
      return { ok: true, candidate: { state, members, changed: true } }
    }
    if (command.type === 'END_GAME') {
      if (state.phase !== 'playing' || !state.session) return { ok: false, error: 'invalid_phase' }
      if (state.session.gameId === 'impostor-da-palavra' || state.session.gameId === 'pista-unica' || state.session.gameId === 'cidade-dorme') {
        const projection = this.games.get(state.session.gameId)!.projectPublic(state.session.gameState)
        if (!field(projection, 'step') || field(projection, 'step') !== 'summary') {
          return { ok: false, error: 'invalid_phase' }
        }
      }
      const game = this.games.get(state.session.gameId)!
      // Read awards from trusted host-owned game state. Guest payloads cannot
      // create or alter points, and an invalid adapter cannot commit partial changes.
      if (game.awardPoints) {
        const awards = game.awardPoints(state.session.gameState)
        if (!validAwards(awards, state.session.participantIds)) {
          return { ok: false, error: 'invalid_payload' }
        }
        state.competition = applyRoundAwards(state.competition, awards, state.session.participantIds)
      }
      state.phase = 'results'; state.session.status = 'completed'
      state.lastPublicResult = { gameSessionId: state.session.gameSessionId,
        gameId: state.session.gameId, status: 'completed' }
      return { ok: true, candidate: { state, members, changed: true } }
    }
    if (command.type === 'RETURN_TO_LOBBY') {
      if (state.phase !== 'results' || !state.session) return { ok: false, error: 'invalid_phase' }
      state.phase = 'lobby'; state.session = null; state.selectedGameId = null; state.selectedConfig = null
      state.configured = false
      for (const member of members.values()) { member.ready = false; member.participation = 'active' }
      return { ok: true, candidate: { state, members, changed: true } }
    }
    return { ok: false, error: 'invalid_payload' }
  }

  private reduceGame(command: RoomCommandV2, state: CanonicalRoom,
    members: Map<string, Membership>, context: MultiplayerGameContext): Reduction {
    if (command.gameSessionId !== state.session?.gameSessionId) return { ok: false, error: 'stale_game_session' }
    if (state.phase !== 'playing' || !state.session) return { ok: false, error: 'invalid_phase' }
    if (!state.session.participantIds.includes(command.playerId)) return { ok: false, error: 'not_participant' }
    const game = this.games.get(state.session.gameId)!
    const transition = game.applyCommand(state.session.gameState,
      { playerId: command.playerId, role: members.get(command.playerId)!.role,
        connectedParticipantIds: state.session.participantIds.filter(id => members.get(id)?.connectionId !== null),
        type: command.type, payload: command.payload }, context)
    if (!transition.accepted) return { ok: false, error: transition.error }
    if (transition.changed) state.session.gameState = transition.state
    const barrierChanged = applyEffects(state.session, transition.roomEffects ?? [])
    return { ok: true, candidate: { state, members, changed: transition.changed || barrierChanged } }
  }
}

export interface AuthoritativeRoomRuntimeV2Options {
  roomId: string
  hostPlayerId: string
  hostConnectionId: string
  adapter: RoomLifecycleAdapter
  createPlayerId?: () => string
  clock?: Clock
  random?: () => number
}

/** In-memory authority for one Room. PL-02B will provide authenticated LAN bindings. */
export class AuthoritativeRoomRuntimeV2 {
  private readonly roomId: string
  private readonly hostPlayerId: string
  private readonly adapter: RoomLifecycleAdapter
  private readonly context: MultiplayerGameContext
  private readonly createPlayerId: () => string
  private revision = 1
  private state: CanonicalRoom = { phase: 'lobby', selectedGameId: null, selectedConfig: null, configured: false,
    session: null, lastPublicResult: null, sessionOrdinal: 0,
    competition: { status: 'active', completedGames: 0, standings: [], winnerPlayerIds: [] } }
  private members = new Map<string, Membership>()

  constructor(options: AuthoritativeRoomRuntimeV2Options) {
    if (!options.roomId || !options.hostPlayerId || !options.hostConnectionId) throw new Error('invalid_room_identity')
    this.roomId = options.roomId; this.hostPlayerId = options.hostPlayerId; this.adapter = options.adapter
    this.context = { clock: options.clock ?? systemClock, random: options.random ?? Math.random }
    this.createPlayerId = options.createPlayerId ?? (() => crypto.randomUUID())
    this.state.competition.standings.push({
      playerId: options.hostPlayerId, displayName: 'Anfitrião', points: 0, played: 0, wins: 0,
    })
    this.members.set(options.hostPlayerId, { playerId: options.hostPlayerId, connectionId: options.hostConnectionId,
      role: 'host', ready: false, participation: 'active', nextClientSeq: 1, recentCommandIds: [] })
  }

  getRevision() { return this.revision }
  hasMembership(playerId: string) { return this.members.has(playerId) }
  getConnectionId(playerId: string) { return this.members.get(playerId)?.connectionId ?? null }

  joinGuest(connectionId: string, displayName?: string): RoomJoinV2 {
    if (this.state.competition.status === 'finished') return { ok: false, error: 'invalid_phase' }
    if (!connectionId || this.memberForConnection(connectionId)) return { ok: false, error: 'unauthorized' }
    if (this.members.size >= 12) return { ok: false, error: 'room_full' }
    let playerId = this.createPlayerId()
    while (!playerId || this.members.has(playerId)) playerId = this.createPlayerId()
    const members = cloneMembers(this.members)
    members.set(playerId, { playerId, connectionId, role: 'guest', ready: false,
      participation: this.state.phase === 'playing' || this.state.phase === 'results' ? 'waiting' : 'active',
      ...(displayName ? { displayName: displayName.slice(0, 40) } : {}), nextClientSeq: 1,
      recentCommandIds: [] })
    const state = cloneRoom(this.state)
    state.competition.standings.push({
      playerId, displayName: displayName?.slice(0, 40) || `Jogador ${members.size}`,
      points: 0, played: 0, wins: 0,
    })
    const prepared = this.preflight(state, members, this.revision + 1)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    this.state = state; this.members = members; this.revision++
    return { ok: true, playerId, snapshot: prepared.snapshots.get(playerId)!,
      deliveries: prepared.deliveries.filter(delivery => delivery.playerId !== playerId) }
  }

  leaveGuest(playerId: string, connectionId: string): RoomPresenceV2 {
    const member = this.members.get(playerId)
    if (!member || member.connectionId !== connectionId || member.role !== 'guest') return { ok: false, error: 'unauthorized' }
    const members = cloneMembers(this.members)
    members.delete(playerId)
    const prepared = this.preflight(this.state, members, this.revision + 1)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    this.members = members; this.revision++
    return { ok: true, deliveries: prepared.deliveries }
  }

  disconnect(connectionId: string): RoomPresenceV2 {
    const member = this.memberForConnection(connectionId)
    if (!member) return { ok: false, error: 'unauthorized' }
    const members = cloneMembers(this.members)
    members.get(member.playerId)!.connectionId = null
    const prepared = this.preflight(this.state, members, this.revision + 1)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    this.members = members; this.revision++
    return { ok: true, deliveries: prepared.deliveries }
  }

  reassociate(playerId: string, connectionId: string): RoomPresenceV2 {
    const member = this.members.get(playerId)
    if (!member || !connectionId || this.memberForConnection(connectionId)) return { ok: false, error: 'unauthorized' }
    const members = cloneMembers(this.members)
    members.get(playerId)!.connectionId = connectionId
    const prepared = this.preflight(this.state, members, this.revision + 1)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    this.members = members; this.revision++
    return { ok: true, snapshot: prepared.snapshots.get(playerId), deliveries: prepared.deliveries }
  }

  snapshotFor(playerId: string, connectionId: string): RoomSnapshotOutcomeV2 {
    const member = this.members.get(playerId)
    if (!member) return { ok: false, error: 'not_member' }
    if (member.connectionId !== connectionId) return { ok: false, error: 'unauthorized' }
    try {
      const snapshot = this.makeSnapshot(this.state, this.members, playerId, this.revision)
      if (!isJsonValue(snapshot)) return { ok: false, error: 'internal_authority_failure' }
      return roomFrameFits({ kind: 'snapshotV2', protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, snapshot })
        ? { ok: true, snapshot } : { ok: false, error: 'frame_too_large' }
    } catch { return { ok: false, error: 'internal_authority_failure' } }
  }

  processCommand(input: unknown, connectionId: string): RoomCommandOutcomeV2 {
    const parsed = parseRoomCommandV2(input)
    if (!parsed.ok) return this.failure(null, parsed.error, null)
    const command = parsed.command
    if (command.roomId !== this.roomId) return this.failure(command.commandId, 'room_not_found', null)
    const member = this.members.get(command.playerId)
    if (!member) return this.failure(command.commandId, 'not_member', null)
    if (member.connectionId !== connectionId) return this.failure(command.commandId, 'unauthorized', member.nextClientSeq)
    if (!roomFrameFits(command)) return this.failure(command.commandId, 'frame_too_large', member.nextClientSeq)
    const previous = member.lastReceipt
    if (command.clientSeq < member.nextClientSeq) {
      if (previous && command.clientSeq === member.nextClientSeq - 1 && command.commandId === previous.command.commandId) {
        if (sameIntent(command, previous.command)) return { result: clone(previous.result), deliveries: [], deduplicated: true }
        return this.failure(command.commandId, 'command_conflict', member.nextClientSeq)
      }
      return this.failure(command.commandId, 'stale_sequence', member.nextClientSeq)
    }
    if (command.clientSeq > member.nextClientSeq) return this.failure(command.commandId, 'future_sequence', member.nextClientSeq)
    if (member.recentCommandIds.includes(command.commandId)) {
      return this.failure(command.commandId, 'command_conflict', member.nextClientSeq)
    }

    let reduction: Reduction
    try { reduction = this.adapter.reduce(command, this.roomId, this.state, this.members, this.context) }
    catch { return this.failure(command.commandId, 'internal_authority_failure', member.nextClientSeq) }
    if (!reduction.ok) {
      const result = this.result(command.commandId, 'rejected', reduction.error, member.nextClientSeq + 1)
      const members = cloneMembers(this.members)
      members.get(command.playerId)!.nextClientSeq++
      rememberCommandId(members.get(command.playerId)!, command.commandId)
      members.get(command.playerId)!.lastReceipt = { command: clone(command), result: clone(result) }
      this.members = members
      return { result, deliveries: [], deduplicated: false }
    }
    const candidate = reduction.candidate
    const nextMember = candidate.members.get(command.playerId)!
    nextMember.nextClientSeq++
    rememberCommandId(nextMember, command.commandId)
    const revision = this.revision + (candidate.changed ? 1 : 0)
    const result = this.result(command.commandId, 'accepted', undefined, nextMember.nextClientSeq, revision)
    nextMember.lastReceipt = { command: clone(command), result: clone(result) }
    const prepared = this.preflight(candidate.state, candidate.members, revision)
    if (!prepared.ok) return this.failure(command.commandId, prepared.error, member.nextClientSeq)
    this.state = candidate.state; this.members = candidate.members; this.revision = revision
    return { result, deliveries: candidate.changed ? prepared.deliveries : [], deduplicated: false }
  }

  private preflight(state: CanonicalRoom, members: Map<string, Membership>, revision: number):
    | { ok: true; snapshots: Map<string, RoomSnapshotV2>; deliveries: RoomDeliveryV2[] }
    | { ok: false; error: RoomCommandError } {
    try {
      const snapshots = new Map<string, RoomSnapshotV2>()
      const deliveries: RoomDeliveryV2[] = []
      for (const member of members.values()) {
        const snapshot = this.makeSnapshot(state, members, member.playerId, revision)
        if (!isJsonValue(snapshot)) return { ok: false, error: 'internal_authority_failure' }
        if (!roomFrameFits({ kind: 'snapshotV2', protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, snapshot })) {
          return { ok: false, error: 'frame_too_large' }
        }
        snapshots.set(member.playerId, snapshot)
        if (member.connectionId) {
          const event: RoomEventV2 = { ...snapshot, kind: 'projection' }
          if (!roomFrameFits({ kind: 'eventV2', protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, event })) {
            return { ok: false, error: 'frame_too_large' }
          }
          deliveries.push({ playerId: member.playerId, connectionId: member.connectionId, event })
        }
      }
      return { ok: true, snapshots, deliveries }
    } catch { return { ok: false, error: 'internal_authority_failure' } }
  }

  private makeSnapshot(state: CanonicalRoom, members: ReadonlyMap<string, Membership>,
    playerId: string, revision: number): RoomSnapshotV2 {
    const session = state.session
    const roomState: RoomStatePublicV2 = { hostPlayerId: this.hostPlayerId, phase: state.phase,
      members: [...members.values()].map(member => ({ playerId: member.playerId, role: member.role,
        connected: member.connectionId !== null, ready: member.ready, participation: member.participation,
        ...(member.displayName ? { displayName: member.displayName } : {}) })),
      selectedGameId: state.selectedGameId, selectedConfig: clone(state.selectedConfig),
      currentGameSessionId: session?.gameSessionId ?? null, lastPublicResult: clone(state.lastPublicResult),
      competition: clone(state.competition),
      barriers: session ? [...session.barriers.values()].map(barrier => ({ gameSessionId: session.gameSessionId,
        id: barrier.id, type: barrier.type, expectedCount: barrier.expectedPlayerIds.length,
        completedCount: barrier.completedPlayerIds.length, isComplete: barrier.isComplete })) : [] }
    const game = session ? this.adapter.game(session.gameId)! : null
    const gamePublicState = session && game ? { gameSessionId: session.gameSessionId, gameId: session.gameId,
      data: game.projectPublic(clone(session.gameState)) } : null
    const privateData = session && game && session.participantIds.includes(playerId)
      ? game.projectPrivate(clone(session.gameState), playerId) : null
    return { protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, roomId: this.roomId, revision,
      roomState, gamePublicState, privateState: privateData === null || !session ? null
        : { gameSessionId: session.gameSessionId, gameId: session.gameId, data: privateData },
      nextClientSeq: members.get(playerId)!.nextClientSeq }
  }

  private result(commandId: string | null, status: 'accepted' | 'rejected', error: RoomCommandError | undefined,
    nextClientSeq: number | null, revision = this.revision): RoomCommandResultV2 {
    return { protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, roomId: this.roomId, commandId,
      status, revision, nextClientSeq, ...(error ? { error } : {}) }
  }
  private failure(commandId: string | null, error: RoomCommandError, nextClientSeq: number | null): RoomCommandOutcomeV2 {
    return { result: this.result(commandId, 'rejected', error, nextClientSeq), deliveries: [], deduplicated: false }
  }
  private memberForConnection(connectionId: string) {
    return [...this.members.values()].find(member => member.connectionId === connectionId)
  }
}

/** Queue boundary for PL-02B native effects. Call runExclusive before any admission/leave/resume side effect. */
export class RoomCoordinatorV2 {
  private tail: Promise<unknown> = Promise.resolve()
  readonly runtime: AuthoritativeRoomRuntimeV2
  constructor(runtime: AuthoritativeRoomRuntimeV2) { this.runtime = runtime }
  runExclusive<T>(operation: (runtime: AuthoritativeRoomRuntimeV2) => T | Promise<T>): Promise<T> {
    const scheduled = this.tail.then(() => operation(this.runtime))
    this.tail = scheduled.catch(() => undefined)
    return scheduled
  }
  joinGuest(connectionId: string, displayName?: string) { return this.runExclusive(runtime => runtime.joinGuest(connectionId, displayName)) }
  leaveGuest(playerId: string, connectionId: string) { return this.runExclusive(runtime => runtime.leaveGuest(playerId, connectionId)) }
  disconnect(connectionId: string) { return this.runExclusive(runtime => runtime.disconnect(connectionId)) }
  reassociate(playerId: string, connectionId: string) { return this.runExclusive(runtime => runtime.reassociate(playerId, connectionId)) }
  processCommand(input: unknown, connectionId: string) { return this.runExclusive(runtime => runtime.processCommand(input, connectionId)) }
  snapshotFor(playerId: string, connectionId: string) {
    return this.runExclusive(runtime => runtime.snapshotFor(playerId, connectionId))
  }
}

function validAwards(awards: Readonly<Record<string, number>> | null,
  participantIds: readonly string[]): awards is Readonly<Record<string, number>> {
  if (!record(awards)) return false
  const keys = Object.keys(awards)
  return keys.length === participantIds.length && keys.every(id => participantIds.includes(id))
    && participantIds.every(id => Number.isSafeInteger(awards[id]) && awards[id] >= 0 && awards[id] <= 2)
}

function applyRoundAwards(competition: RoomCompetitionV2, awards: Readonly<Record<string, number>>,
  participantIds: readonly string[]): RoomCompetitionV2 {
  return {
    ...competition, completedGames: competition.completedGames + 1,
    standings: competition.standings.map(entry => {
      if (!participantIds.includes(entry.playerId)) return entry
      const earned = awards[entry.playerId]
      return { ...entry, points: entry.points + earned, wins: entry.wins + (earned > 0 ? 1 : 0),
        played: entry.played + 1 }
    }),
  }
}

function competitionLeaders(competition: RoomCompetitionV2): string[] {
  if (competition.completedGames === 0) return []
  const high = Math.max(...competition.standings.map(entry => entry.points))
  if (high <= 0) return []
  return competition.standings.filter(entry => entry.points === high).map(entry => entry.playerId)
}

function cloneMembers(members: ReadonlyMap<string, Membership>) {
  return new Map([...members].map(([id, member]) => [id, { ...member, recentCommandIds: [...member.recentCommandIds] }]))
}
function rememberCommandId(member: Membership, commandId: string) {
  member.recentCommandIds.push(commandId)
  if (member.recentCommandIds.length > RECENT_COMMAND_ID_LIMIT) member.recentCommandIds.shift()
}
function cloneRoom(state: CanonicalRoom): CanonicalRoom {
  return { ...state, selectedConfig: clone(state.selectedConfig), lastPublicResult: clone(state.lastPublicResult),
    competition: clone(state.competition),
    session: state.session ? { ...state.session, participantIds: [...state.session.participantIds],
      config: clone(state.session.config), gameState: clone(state.session.gameState),
      barriers: new Map([...state.session.barriers].map(([id, barrier]) => [id, clone(barrier)])) } : null }
}
function clone<T>(value: T): T { return structuredClone(value) }
function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined
}
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equal(item, right[index]))
  }
  if (record(left) && record(right)) {
    const keys = Object.keys(left)
    return keys.length === Object.keys(right).length
      && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
  }
  return false
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function sameIntent(left: RoomCommandV2, right: RoomCommandV2) {
  return left.playerId === right.playerId && left.roomId === right.roomId && left.scope === right.scope
    && left.gameSessionId === right.gameSessionId && left.type === right.type && equal(left.payload, right.payload)
}
function applyEffects(session: GameSession, effects: readonly RoomEffect[]): boolean {
  let changed = false
  for (const effect of effects) {
    if (effect.type === 'open_barrier') {
      const next = createBarrier(effect.id, effect.barrierType, effect.expectedPlayerIds)
      if (!equal(session.barriers.get(effect.id), next)) { session.barriers.set(effect.id, next); changed = true }
    } else {
      const current = session.barriers.get(effect.id)
      if (!current) continue
      const update = completeBarrier(current, effect.playerId)
      if (update.changed) { session.barriers.set(effect.id, update.barrier); changed = true }
    }
  }
  return changed
}
