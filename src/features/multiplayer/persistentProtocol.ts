/** Isolated core contract. LAN v1 keeps its own protocol version until PL-02B. */
export const PERSISTENT_ROOM_PROTOCOL_VERSION = 2 as const
export const PERSISTENT_ROOM_MAX_FRAME_BYTES = 16 * 1024

export type RoomScope = 'room' | 'game'
export type RoomPhase = 'lobby' | 'configuring' | 'playing' | 'results'
export type RoomCommandError = 'incompatible_protocol' | 'invalid_payload' | 'room_not_found'
  | 'not_member' | 'unauthorized' | 'invalid_phase' | 'unsupported_game' | 'invalid_config'
  | 'not_ready' | 'invalid_player_count' | 'not_participant' | 'stale_game_session'
  | 'command_conflict' | 'stale_sequence' | 'future_sequence' | 'frame_too_large'
  | 'internal_authority_failure' | 'room_full'

export interface RoomCommandV2 {
  protocolVersion: typeof PERSISTENT_ROOM_PROTOCOL_VERSION
  scope: RoomScope
  roomId: string
  playerId: string
  commandId: string
  clientSeq: number
  type: string
  payload: unknown
  gameSessionId?: string
}

export interface RoomCommandResultV2 {
  protocolVersion: typeof PERSISTENT_ROOM_PROTOCOL_VERSION
  roomId: string
  commandId: string | null
  status: 'accepted' | 'rejected'
  revision: number
  nextClientSeq: number | null
  error?: RoomCommandError
}

export interface RoomMemberPublicV2 {
  playerId: string
  role: 'host' | 'guest'
  connected: boolean
  ready: boolean
  participation: 'active' | 'waiting'
  displayName?: string
}

export interface RoomBarrierPublicV2 {
  gameSessionId: string
  id: string
  type: string
  expectedCount: number
  completedCount: number
  isComplete: boolean
}

/** Scores are ephemeral to the current LAN Room. Never include private game cards. */
export interface RoomCompetitionV2 {
  status: 'active' | 'finished'
  completedGames: number
  standings: { playerId: string; displayName: string; points: number; wins: number; played: number }[]
  winnerPlayerIds: string[]
}

export interface RoomStatePublicV2 {
  hostPlayerId: string
  phase: RoomPhase
  members: readonly RoomMemberPublicV2[]
  selectedGameId: string | null
  selectedConfig: unknown | null
  currentGameSessionId: string | null
  lastPublicResult: { gameSessionId: string; gameId: string; status: 'completed' | 'aborted' } | null
  barriers: readonly RoomBarrierPublicV2[]
  /** Optional for compatibility with pre-G5E test fixtures; real v2 Rooms always include it. */
  competition?: RoomCompetitionV2
}

export interface GamePublicV2 { gameSessionId: string; gameId: string; data: unknown }
export interface GamePrivateV2 { gameSessionId: string; gameId: string; data: unknown }

export interface RoomSnapshotV2 {
  protocolVersion: typeof PERSISTENT_ROOM_PROTOCOL_VERSION
  roomId: string
  revision: number
  roomState: RoomStatePublicV2
  gamePublicState: GamePublicV2 | null
  privateState: GamePrivateV2 | null
  nextClientSeq: number
}

export type RoomEventV2 =
  | (RoomSnapshotV2 & { kind: 'projection' })
  | { protocolVersion: typeof PERSISTENT_ROOM_PROTOCOL_VERSION; roomId: string; revision: number; kind: 'marker' }

export type RoomCommandParseV2 =
  | { ok: true; command: RoomCommandV2 }
  | { ok: false; error: 'incompatible_protocol' | 'invalid_payload' }

export function parseRoomCommandV2(input: unknown): RoomCommandParseV2 {
  if (!record(input)) return { ok: false, error: 'invalid_payload' }
  if (input.protocolVersion !== PERSISTENT_ROOM_PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
  if ((input.scope !== 'room' && input.scope !== 'game') || !nonEmpty(input.roomId)
    || !nonEmpty(input.playerId) || !nonEmpty(input.commandId) || !nonEmpty(input.type)
    || !Number.isSafeInteger(input.clientSeq) || (input.clientSeq as number) < 1
    || !Object.hasOwn(input, 'payload') || !isJsonValue(input.payload)
    || (input.scope === 'game' && !nonEmpty(input.gameSessionId))
    || (input.scope === 'room' && input.gameSessionId !== undefined)) return { ok: false, error: 'invalid_payload' }
  return { ok: true, command: { protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION,
    scope: input.scope, roomId: input.roomId, playerId: input.playerId,
    commandId: input.commandId, clientSeq: input.clientSeq as number,
    type: input.type, payload: input.payload,
    ...(input.scope === 'game' ? { gameSessionId: input.gameSessionId as string } : {}) } }
}

export function roomFrameFits(value: unknown): boolean {
  try {
    const json = JSON.stringify(value)
    return typeof json === 'string' && new TextEncoder().encode(json).length <= PERSISTENT_ROOM_MAX_FRAME_BYTES
  } catch { return false }
}

export function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  const valid = Array.isArray(value)
    ? value.every(item => isJsonValue(item, seen))
    : (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
      && Object.keys(value).every(key => isJsonValue((value as Record<string, unknown>)[key], seen))
  seen.delete(value)
  return valid
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
