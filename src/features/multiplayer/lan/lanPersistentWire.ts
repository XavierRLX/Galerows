import { isJsonValue, parseRoomCommandV2, PERSISTENT_ROOM_MAX_FRAME_BYTES,
  PERSISTENT_ROOM_PROTOCOL_VERSION } from '../persistentProtocol'
import type { RoomCommandResultV2, RoomEventV2, RoomSnapshotV2 } from '../persistentProtocol'
import type { RoomCommandError } from '../persistentProtocol'
import { validPersistentLanInvite } from './lanPersistentInvite'
import type { PersistentLanInvite } from './lanPersistentInvite'

const VERSION = PERSISTENT_ROOM_PROTOCOL_VERSION

/** Strict, standalone v2 application frames. Not wired to native sockets until PL-02B integration. */
export interface PersistentResyncRequest {
  protocolVersion: typeof VERSION
  roomId: string
  playerId: string
  lastAppliedRevision: number
}

export type PersistentAdmissionError = 'invalid_invite' | 'invite_expired' | 'invite_used'
  | 'too_many_attempts' | 'room_closed' | 'room_full' | 'coordinator_rejected'
export type PersistentLanFrame =
  | { kind: 'resumeHello'; protocolVersion: typeof VERSION; roomId: string; playerId: string; resumeToken: string }
  | { kind: 'rekeyOfferV2'; protocolVersion: typeof VERSION; roomId: string; playerId: string;
      rekeyId: string; resumeToken: string; resumeExpiresAt: number }
  | { kind: 'rekeyAckV2' | 'rekeyConfirmedV2'; protocolVersion: typeof VERSION;
      roomId: string; playerId: string; rekeyId: string }
  | { kind: 'resumedV2'; protocolVersion: typeof VERSION; playerId: string; snapshot: RoomSnapshotV2;
      resumeToken: string; resumeExpiresAt: number; resumeId: string }
  | { kind: 'resumeAckV2' | 'resumeConfirmedV2'; protocolVersion: typeof VERSION;
      roomId: string; playerId: string; resumeId: string }
  | { kind: 'leaveRequestV2'; protocolVersion: typeof VERSION; roomId: string; playerId: string; commandId: string }
  | { kind: 'leaveConfirmedV2'; protocolVersion: typeof VERSION; roomId: string; playerId: string;
      commandId: string; revision: number }
  | { kind: 'leaveRejectedV2'; protocolVersion: typeof VERSION; roomId: string; playerId: string;
      commandId: string; error: 'revocation_failed' | 'internal_authority_failure' }
  | { kind: 'joinRequestV2'; protocolVersion: typeof VERSION; invite: PersistentLanInvite }
  | { kind: 'admittedV2'; protocolVersion: typeof VERSION; playerId: string; snapshot: RoomSnapshotV2;
      admissionId: string; resumeToken: string; resumeExpiresAt: number }
  | { kind: 'admissionAckV2' | 'admissionConfirmedV2'; protocolVersion: typeof VERSION;
      roomId: string; playerId: string; admissionId: string }
  | { kind: 'rejectedV2'; protocolVersion: typeof VERSION; error: PersistentAdmissionError }
  | { kind: 'roomClosedV2'; protocolVersion: typeof VERSION; roomId: string }
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

  if (value.kind === 'resumeHello') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'resumeToken')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.resumeToken)) return invalid()
    return { ok: true, frame: { kind: 'resumeHello', protocolVersion: VERSION, roomId: value.roomId,
      playerId: value.playerId, resumeToken: value.resumeToken } }
  }
  if (value.kind === 'rekeyOfferV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'rekeyId', 'resumeToken', 'resumeExpiresAt')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId)
      || !hexToken(value.rekeyId) || !hexToken(value.resumeToken)
      || !Number.isSafeInteger(value.resumeExpiresAt) || (value.resumeExpiresAt as number) <= 0) return invalid()
    return { ok: true, frame: { kind: 'rekeyOfferV2', protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, rekeyId: value.rekeyId,
      resumeToken: value.resumeToken, resumeExpiresAt: value.resumeExpiresAt as number } }
  }
  if (value.kind === 'rekeyAckV2' || value.kind === 'rekeyConfirmedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'rekeyId')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.rekeyId)) return invalid()
    return { ok: true, frame: { kind: value.kind, protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, rekeyId: value.rekeyId } }
  }
  if (value.kind === 'resumedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'playerId', 'snapshot', 'resumeToken', 'resumeExpiresAt', 'resumeId')
      || !nonEmpty(value.playerId) || !validSnapshot(value.snapshot)
      || !value.snapshot.roomState.members.some(member => member.playerId === value.playerId && member.role === 'guest')
      || !hexToken(value.resumeToken) || !hexToken(value.resumeId)
      || !Number.isSafeInteger(value.resumeExpiresAt) || (value.resumeExpiresAt as number) <= 0) return invalid()
    return { ok: true, frame: { kind: 'resumedV2', protocolVersion: VERSION, playerId: value.playerId,
      snapshot: value.snapshot, resumeToken: value.resumeToken, resumeExpiresAt: value.resumeExpiresAt as number,
      resumeId: value.resumeId } }
  }
  if (value.kind === 'resumeAckV2' || value.kind === 'resumeConfirmedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'resumeId')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.resumeId)) return invalid()
    return { ok: true, frame: { kind: value.kind, protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, resumeId: value.resumeId } }
  }
  if (value.kind === 'leaveRequestV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'commandId')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !nonEmpty(value.commandId)) return invalid()
    return { ok: true, frame: { kind: 'leaveRequestV2', protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, commandId: value.commandId } }
  }
  if (value.kind === 'leaveConfirmedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'commandId', 'revision')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !nonEmpty(value.commandId)
      || !revision(value.revision)) return invalid()
    return { ok: true, frame: { kind: 'leaveConfirmedV2', protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, commandId: value.commandId, revision: value.revision } }
  }
  if (value.kind === 'leaveRejectedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'commandId', 'error')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !nonEmpty(value.commandId)
      || (value.error !== 'revocation_failed' && value.error !== 'internal_authority_failure')) return invalid()
    return { ok: true, frame: { kind: 'leaveRejectedV2', protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, commandId: value.commandId,
      error: value.error } }
  }
  if (value.kind === 'joinRequestV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'invite')
      || !validPersistentLanInvite(value.invite)) return invalid()
    return { ok: true, frame: { kind: 'joinRequestV2', protocolVersion: VERSION, invite: value.invite } }
  }
  if (value.kind === 'admittedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'playerId', 'snapshot', 'admissionId', 'resumeToken', 'resumeExpiresAt')
      || !nonEmpty(value.playerId) || !validSnapshot(value.snapshot)
      || !value.snapshot.roomState.members.some(member => member.playerId === value.playerId && member.role === 'guest')
      || !hexToken(value.admissionId) || !hexToken(value.resumeToken)
      || !Number.isSafeInteger(value.resumeExpiresAt) || (value.resumeExpiresAt as number) <= 0) return invalid()
    return { ok: true, frame: { kind: 'admittedV2', protocolVersion: VERSION, playerId: value.playerId,
      snapshot: value.snapshot, admissionId: value.admissionId, resumeToken: value.resumeToken,
      resumeExpiresAt: value.resumeExpiresAt as number } }
  }
  if (value.kind === 'admissionAckV2' || value.kind === 'admissionConfirmedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId', 'playerId', 'admissionId')
      || !nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.admissionId)) return invalid()
    return { ok: true, frame: { kind: value.kind, protocolVersion: VERSION,
      roomId: value.roomId, playerId: value.playerId, admissionId: value.admissionId } }
  }
  if (value.kind === 'rejectedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'error') || !admissionError(value.error)) return invalid()
    return { ok: true, frame: { kind: 'rejectedV2', protocolVersion: VERSION, error: value.error } }
  }
  if (value.kind === 'roomClosedV2') {
    if (!fields(value, 'kind', 'protocolVersion', 'roomId') || !nonEmpty(value.roomId)) return invalid()
    return { ok: true, frame: { kind: 'roomClosedV2', protocolVersion: VERSION, roomId: value.roomId } }
  }
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

function fields(value: Record<string, unknown>, ...names: string[]): boolean {
  return Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name))
}
function hexToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
const admissionErrors: ReadonlySet<PersistentAdmissionError> = new Set([
  'invalid_invite', 'invite_expired', 'invite_used', 'too_many_attempts',
  'room_closed', 'room_full', 'coordinator_rejected',
])
function admissionError(value: unknown): value is PersistentAdmissionError {
  return admissionErrors.has(value as PersistentAdmissionError)
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function revision(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 }
function positiveSeq(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 1 }
