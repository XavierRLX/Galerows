import { isJsonValue, parseRoomCommandV2, PERSISTENT_ROOM_MAX_FRAME_BYTES,
  PERSISTENT_ROOM_PROTOCOL_VERSION } from '../persistentProtocol'
import type { RoomCommandResultV2, RoomEventV2, RoomSnapshotV2 } from '../persistentProtocol'
import type { RoomCommandError } from '../persistentProtocol'

const VERSION = PERSISTENT_ROOM_PROTOCOL_VERSION

/** Strict, standalone v2 application frames. Not wired to native sockets until PL-02B integration. */
export interface PersistentResyncRequest {
  protocolVersion: typeof VERSION
  roomId: string
  playerId: string
  lastAppliedRevision: number
}

export type PersistentLanFrame =
  | { kind: 'commandV2'; protocolVersion: typeof VERSION; command: import('../persistentProtocol').RoomCommandV2 }
  | { kind: 'commandResultV2'; protocolVersion: typeof VERSION; result: RoomCommandResultV2 }
  | { kind: 'snapshotV2'; protocolVersion: typeof VERSION; snapshot: RoomSnapshotV2 }
  | { kind: 'eventV2'; protocolVersion: typeof VERSION; event: RoomEventV2 }
  | { kind: 'resyncV2'; protocolVersion: typeof VERSION; request: PersistentResyncRequest }

export type PersistentLanDecodeResult =
  | { ok: true; frame: PersistentLanFrame }
  | { ok: false; error: 'invalid_frame' | 'incompatible_protocol' | 'frame_too_large' }

const invalid = (): PersistentLanDecodeResult => ({ ok: false, error: 'invalid_frame' })

/** Encoding is as strict as decoding: reject NaN, undefined, unknown shapes and >16KiB UTF-8. */
export function encodePersistentLanFrame(frame: PersistentLanFrame): string {
  if (!isJsonValue(frame)) throw new Error('invalid_frame')
  const encoded = JSON.stringify(frame)
  if (new TextEncoder().encode(encoded).length > PERSISTENT_ROOM_MAX_FRAME_BYTES) {
    throw new Error('frame_too_large')
  }
  const checked = decodePersistentLanFrame(encoded)
  if (!checked.ok) throw new Error(checked.error)
  return encoded
}

/** Parse only v2 envelopes. LAN v1 decoder and secure admission are intentionally untouched. */
export function decodePersistentLanFrame(raw: string): PersistentLanDecodeResult {
  if (new TextEncoder().encode(raw).length > PERSISTENT_ROOM_MAX_FRAME_BYTES) {
    return { ok: false, error: 'frame_too_large' }
  }
  let value: unknown
  try { value = JSON.parse(raw) } catch { return invalid() }
  if (!record(value) || typeof value.kind !== 'string') return invalid()
  if (value.protocolVersion !== VERSION) return { ok: false, error: 'incompatible_protocol' }
  if (!isJsonValue(value)) return invalid()

  if (value.kind === 'commandV2') {
    const parsed = parseRoomCommandV2(value.command)
    if (!parsed.ok) return invalid()
    return { ok: true, frame: { kind: 'commandV2', protocolVersion: VERSION, command: parsed.command } }
  }
  if (value.kind === 'commandResultV2') {
    if (!validCommandResult(value.result)) return invalid()
    return { ok: true, frame: { kind: 'commandResultV2', protocolVersion: VERSION, result: value.result } }
  }
  if (value.kind === 'snapshotV2') {
    if (!validSnapshot(value.snapshot)) return invalid()
    return { ok: true, frame: { kind: 'snapshotV2', protocolVersion: VERSION, snapshot: value.snapshot } }
  }
  if (value.kind === 'eventV2') {
    if (!record(value.event) || value.event.protocolVersion !== VERSION) return invalid()
    if (value.event.kind === 'marker') {
      if (!nonEmpty(value.event.roomId) || !revision(value.event.revision)) return invalid()
      return { ok: true, frame: { kind: 'eventV2', protocolVersion: VERSION, event: {
        kind: 'marker', protocolVersion: VERSION, roomId: value.event.roomId, revision: value.event.revision } } }
    }
    if (value.event.kind !== 'projection' || !validSnapshot(value.event)) return invalid()
    return { ok: true, frame: { kind: 'eventV2', protocolVersion: VERSION, event: value.event as unknown as RoomEventV2 } }
  }
  if (value.kind === 'resyncV2') {
    const request = value.request
    if (!record(request) || request.protocolVersion !== VERSION || !nonEmpty(request.roomId)
      || !nonEmpty(request.playerId) || !revision(request.lastAppliedRevision)) return invalid()
    return { ok: true, frame: { kind: 'resyncV2', protocolVersion: VERSION, request: {
      protocolVersion: VERSION, roomId: request.roomId, playerId: request.playerId,
      lastAppliedRevision: request.lastAppliedRevision } } }
  }
  return invalid()
}

const errorCodes: ReadonlySet<RoomCommandError> = new Set<RoomCommandError>([
  'incompatible_protocol', 'invalid_payload', 'room_not_found', 'not_member', 'unauthorized',
  'invalid_phase', 'unsupported_game', 'invalid_config', 'not_ready', 'invalid_player_count',
  'not_participant', 'stale_game_session', 'command_conflict', 'stale_sequence', 'future_sequence',
  'frame_too_large', 'internal_authority_failure', 'room_full',
])

function validCommandResult(value: unknown): value is RoomCommandResultV2 {
  if (!record(value) || value.protocolVersion !== VERSION || !nonEmpty(value.roomId)
    || (value.commandId !== null && !nonEmpty(value.commandId))
    || (value.status !== 'accepted' && value.status !== 'rejected')
    || !revision(value.revision)
    || (value.nextClientSeq !== null && !positiveSeq(value.nextClientSeq))) return false
  if (value.error !== undefined && (!errorCodes.has(value.error as RoomCommandError)
    || value.status !== 'rejected')) return false
  return true
}

function validSnapshot(value: unknown): value is RoomSnapshotV2 {
  if (!record(value) || value.protocolVersion !== VERSION || !nonEmpty(value.roomId)
    || !revision(value.revision) || !positiveSeq(value.nextClientSeq)
    || !validRoomState(value.roomState)) return false
  const state = value.roomState as Record<string, unknown>
  const sessionId = state.currentGameSessionId
  const barriers = state.barriers as Array<{ gameSessionId: string }>
  if (sessionId === null) return barriers.length === 0 && value.gamePublicState === null && value.privateState === null
  if (!nonEmpty(sessionId) || !barriers.every(barrier => barrier.gameSessionId === sessionId)) return false
  if (!validGameProjection(value.gamePublicState, sessionId, state.selectedGameId)) return false
  return value.privateState === null || validGameProjection(value.privateState, sessionId, state.selectedGameId)
}

function validRoomState(value: unknown): value is Record<string, unknown> {
  if (!record(value) || !nonEmpty(value.hostPlayerId)
    || !['lobby', 'configuring', 'playing', 'results'].includes(String(value.phase))
    || !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 12
    || (value.selectedGameId !== null && !nonEmpty(value.selectedGameId))
    || !Object.hasOwn(value, 'selectedConfig') || !isJsonValue(value.selectedConfig)
    || (value.currentGameSessionId !== null && !nonEmpty(value.currentGameSessionId))
    || !Array.isArray(value.barriers) || !value.barriers.every(validBarrier)
    || (value.lastPublicResult !== null && !validResult(value.lastPublicResult))) return false

  const members = value.members as unknown[]
  if (!members.every(validMember)) return false
  const host = members.filter(member => (member as { role: string }).role === 'host')
  if (host.length !== 1 || (host[0] as { playerId: string }).playerId !== value.hostPlayerId) return false
  if (new Set(members.map(member => (member as { playerId: string }).playerId)).size !== members.length) return false
  if ((value.phase === 'playing' || value.phase === 'results') && !nonEmpty(value.currentGameSessionId)) return false
  if ((value.phase === 'lobby' || value.phase === 'configuring') && value.currentGameSessionId !== null) return false
  return true
}

function validMember(member: unknown) {
  return record(member) && nonEmpty(member.playerId)
    && (member.role === 'host' || member.role === 'guest')
    && typeof member.connected === 'boolean' && typeof member.ready === 'boolean'
    && (member.participation === 'active' || member.participation === 'waiting')
    && (member.displayName === undefined
      || (typeof member.displayName === 'string' && member.displayName.length <= 40))
}

function validBarrier(value: unknown) {
  return record(value) && nonEmpty(value.gameSessionId) && nonEmpty(value.id)
    && nonEmpty(value.type) && revision(value.expectedCount) && revision(value.completedCount)
    && typeof value.isComplete === 'boolean'
}

function validResult(value: unknown) {
  return record(value) && nonEmpty(value.gameSessionId) && nonEmpty(value.gameId)
    && (value.status === 'completed' || value.status === 'aborted')
}

function validGameProjection(value: unknown, sessionId: unknown, selectedGameId: unknown) {
  return record(value) && nonEmpty(value.gameSessionId) && value.gameSessionId === sessionId
    && nonEmpty(value.gameId) && value.gameId === selectedGameId
    && Object.hasOwn(value, 'data') && isJsonValue(value.data)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function revision(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 }
function positiveSeq(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 1 }
