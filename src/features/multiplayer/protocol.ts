export const PROTOCOL_VERSION = 1 as const

export type ProtocolVersion = typeof PROTOCOL_VERSION
export type RoomId = string
export type PlayerId = string
export type ConnectionId = string
export type CommandId = string

export type CommandErrorCode =
  | 'invalid_payload'
  | 'unauthorized'
  | 'not_member'
  | 'invalid_phase'
  | 'incompatible_protocol'
  | 'command_conflict'
  | 'room_not_found'
  | 'room_closed'
  | 'internal_authority_failure'

export interface RoomBarrierPublicState {
  id: string
  type: string
  expectedCount: number
  completedCount: number
  isComplete: boolean
}

export interface RoomPublicState {
  playerIds: readonly PlayerId[]
  barriers: readonly RoomBarrierPublicState[]
}

export interface Command<TPayload = unknown> {
  protocolVersion: ProtocolVersion
  roomId: RoomId
  playerId: PlayerId
  commandId: CommandId
  type: string
  payload: TPayload
}

export type CommandResultStatus =
  | 'accepted'
  | 'rejected'
  | 'recoverable_error'
  | 'incompatible_protocol'

export interface CommandResult {
  protocolVersion: number
  roomId: RoomId | null
  commandId: CommandId | null
  status: CommandResultStatus
  revision?: number
  error?: CommandErrorCode
  playerId?: PlayerId
}

export interface ProjectionEvent<TGamePublic, TPrivate> {
  protocolVersion: number
  roomId: RoomId
  revision: number
  kind: 'projection'
  roomState: RoomPublicState
  gamePublicState: TGamePublic
  privateState: TPrivate | null
}

export interface MarkerEvent {
  protocolVersion: number
  roomId: RoomId
  revision: number
  kind: 'marker'
}

export type Event<TGamePublic, TPrivate> =
  | ProjectionEvent<TGamePublic, TPrivate>
  | MarkerEvent

export interface Snapshot<TGamePublic, TPrivate> {
  protocolVersion: number
  roomId: RoomId
  revision: number
  roomState: RoomPublicState
  gamePublicState: TGamePublic
  privateState: TPrivate | null
}

export interface ResyncRequest {
  protocolVersion: ProtocolVersion
  roomId: RoomId
  playerId: PlayerId
  lastAppliedRevision: number
}

export type AuthoritativeMessage<TGamePublic, TPrivate> =
  | CommandResult
  | Event<TGamePublic, TPrivate>
  | Snapshot<TGamePublic, TPrivate>

export type CommandParseResult =
  | { ok: true; command: Command }
  | {
    ok: false
    error: 'invalid_payload' | 'incompatible_protocol'
    roomId: RoomId | null
    commandId: CommandId | null
  }

export type ResyncRequestParseResult =
  | { ok: true; request: ResyncRequest }
  | { ok: false; error: 'invalid_payload' | 'incompatible_protocol' }

export function parseCommand(input: unknown): CommandParseResult {
  if (!isRecord(input)) return invalidCommand('invalid_payload')

  const roomId = nonEmptyString(input.roomId) ? input.roomId : null
  const commandId = nonEmptyString(input.commandId) ? input.commandId : null

  if (input.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: 'incompatible_protocol', roomId, commandId }
  }

  if (
    !roomId
    || !commandId
    || !nonEmptyString(input.playerId)
    || !nonEmptyString(input.type)
    || !Object.hasOwn(input, 'payload')
  ) {
    return { ok: false, error: 'invalid_payload', roomId, commandId }
  }

  return {
    ok: true,
    command: {
      protocolVersion: PROTOCOL_VERSION,
      roomId,
      playerId: input.playerId,
      commandId,
      type: input.type,
      payload: input.payload,
    },
  }
}

export function parseResyncRequest(input: unknown): ResyncRequestParseResult {
  if (!isRecord(input)) return { ok: false, error: 'invalid_payload' }
  if (input.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: 'incompatible_protocol' }
  }
  if (
    !nonEmptyString(input.roomId)
    || !nonEmptyString(input.playerId)
    || typeof input.lastAppliedRevision !== 'number'
    || !Number.isInteger(input.lastAppliedRevision)
    || input.lastAppliedRevision < 0
  ) {
    return { ok: false, error: 'invalid_payload' }
  }
  return {
    ok: true,
    request: {
      protocolVersion: PROTOCOL_VERSION,
      roomId: input.roomId,
      playerId: input.playerId,
      lastAppliedRevision: input.lastAppliedRevision,
    },
  }
}

function invalidCommand(error: 'invalid_payload' | 'incompatible_protocol'): CommandParseResult {
  return { ok: false, error, roomId: null, commandId: null }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
