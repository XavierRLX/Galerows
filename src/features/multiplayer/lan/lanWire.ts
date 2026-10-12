import { parseCommand, parseResyncRequest, PROTOCOL_VERSION } from '../protocol'
import type { Command, CommandResult, Event, ResyncRequest, Snapshot } from '../protocol'
import { validInvite } from './lanInvite'
import type { LanAdmitted, LanJoinRequest, LanRejected, IngressError } from './lanAdmission'

/** Maximum UTF-8 JSON message size accepted by the 4A LAN bridge. */
export const LAN_MAX_FRAME_BYTES = 16 * 1024

export type LanFrame =
  | { kind: 'hello'; protocolVersion: number; roomId: string; inviteToken: string }
  | { kind: 'resumeHello'; protocolVersion: number; roomId: string; playerId: string; resumeToken: string }
  | { kind: 'resumed'; protocolVersion: number; playerId: string; snapshot: Snapshot<unknown, unknown>; resumeToken: string; resumeExpiresAt: number }
  | { kind: 'admissionAck'; protocolVersion: number; roomId: string; playerId: string; admissionId: string }
  | { kind: 'admissionConfirmed'; protocolVersion: number; roomId: string; playerId: string; admissionId: string }
  | { kind: 'resumeAck'; protocolVersion: number; roomId: string; playerId: string }
  | { kind: 'resumeRejected'; protocolVersion: number; error: 'unauthorized' | 'room_closed' | 'resume_expired' }
  | { kind: 'roomClosed'; protocolVersion: number; roomId: string }
  | { kind: 'leaveRequest'; protocolVersion: number; roomId: string; playerId: string; commandId: string }
  | { kind: 'leaveConfirmed'; protocolVersion: number; roomId: string; playerId: string; commandId: string; revision: number }
  | { kind: 'leaveRejected'; protocolVersion: number; roomId: string; playerId: string; commandId: string; error: 'revocation_failed' }
  | { kind: 'command'; command: Command }
  | { kind: 'resync'; request: ResyncRequest }
  | { kind: 'commandResult'; result: CommandResult }
  | { kind: 'event'; event: Event<unknown, unknown> }
  | { kind: 'snapshot'; snapshot: Snapshot<unknown, unknown> }
  | { kind: 'ping'; protocolVersion: number }
  | { kind: 'pong'; protocolVersion: number }
  | LanJoinRequest
  | LanAdmitted
  | LanRejected

export type LanDecodeResult =
  | { ok: true; frame: LanFrame }
  | { ok: false; error: 'invalid_frame' | 'frame_too_large' | 'incompatible_protocol' }

export function encodeLanFrame(frame: LanFrame): string {
  const encoded = JSON.stringify(frame)
  if (new TextEncoder().encode(encoded).length > LAN_MAX_FRAME_BYTES) {
    throw new Error('frame_too_large')
  }
  return encoded
}

export function decodeLanFrame(raw: string): LanDecodeResult {
  if (new TextEncoder().encode(raw).length > LAN_MAX_FRAME_BYTES) {
    return { ok: false, error: 'frame_too_large' }
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'invalid_frame' }
  }
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return { ok: false, error: 'invalid_frame' }
  }
  if (value.kind === 'hello') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId) || !nonEmpty(value.inviteToken)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: value.roomId, inviteToken: value.inviteToken } }
  }
  if (value.kind === 'resumeHello') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.resumeToken)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'resumeHello', protocolVersion: PROTOCOL_VERSION,
      roomId: value.roomId, playerId: value.playerId, resumeToken: value.resumeToken } }
  }
  if (value.kind === 'resumed') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    const snapshot = value.snapshot
    if (!nonEmpty(value.playerId) || !hexToken(value.resumeToken)
      || !Number.isSafeInteger(value.resumeExpiresAt) || (value.resumeExpiresAt as number) <= 0
      || !isRecord(snapshot) || snapshot.protocolVersion !== PROTOCOL_VERSION || !nonEmpty(snapshot.roomId)
      || !Number.isSafeInteger(snapshot.revision) || (snapshot.revision as number) < 0
      || !isRecord(snapshot.roomState) || !Array.isArray(snapshot.roomState.playerIds)
      || !Array.isArray(snapshot.roomState.barriers) || !Object.hasOwn(snapshot, 'gamePublicState')
      || !Object.hasOwn(snapshot, 'privateState')) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'resumed', protocolVersion: PROTOCOL_VERSION,
      playerId: value.playerId, snapshot: snapshot as unknown as Snapshot<unknown, unknown>,
      resumeToken: value.resumeToken, resumeExpiresAt: value.resumeExpiresAt as number } }
  }
  if (value.kind === 'resumeAck') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId) || !nonEmpty(value.playerId)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'resumeAck', protocolVersion: PROTOCOL_VERSION,
      roomId: value.roomId, playerId: value.playerId } }
  }
  if (value.kind === 'admissionAck' || value.kind === 'admissionConfirmed') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !hexToken(value.admissionId)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: value.kind, protocolVersion: PROTOCOL_VERSION,
      roomId: value.roomId, playerId: value.playerId, admissionId: value.admissionId } }
  }
  if (value.kind === 'resumeRejected') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (value.error !== 'unauthorized' && value.error !== 'room_closed' && value.error !== 'resume_expired') return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'resumeRejected', protocolVersion: PROTOCOL_VERSION, error: value.error } }
  }
  if (value.kind === 'roomClosed') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'roomClosed', protocolVersion: PROTOCOL_VERSION, roomId: value.roomId } }
  }
  if (value.kind === 'leaveRequest' || value.kind === 'leaveConfirmed' || value.kind === 'leaveRejected') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!nonEmpty(value.roomId) || !nonEmpty(value.playerId) || !nonEmpty(value.commandId)) return { ok: false, error: 'invalid_frame' }
    if (value.kind === 'leaveConfirmed') {
      if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) return { ok: false, error: 'invalid_frame' }
      return { ok: true, frame: { kind: 'leaveConfirmed', protocolVersion: PROTOCOL_VERSION,
        roomId: value.roomId, playerId: value.playerId, commandId: value.commandId, revision: value.revision as number } }
    }
    if (value.kind === 'leaveRejected') {
      if (value.error !== 'revocation_failed') return { ok: false, error: 'invalid_frame' }
      return { ok: true, frame: { kind: 'leaveRejected', protocolVersion: PROTOCOL_VERSION,
        roomId: value.roomId, playerId: value.playerId, commandId: value.commandId, error: value.error } }
    }
    return { ok: true, frame: { kind: 'leaveRequest', protocolVersion: PROTOCOL_VERSION,
      roomId: value.roomId, playerId: value.playerId, commandId: value.commandId } }
  }
  if (value.kind === 'joinRequest') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!isRecord(value.invite) || !validInvite(value.invite)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'joinRequest', protocolVersion: PROTOCOL_VERSION, invite: value.invite } }
  }
  if (value.kind === 'rejected') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    if (!ingressError(value.error)) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'rejected', protocolVersion: PROTOCOL_VERSION, error: value.error } }
  }
  if (value.kind === 'admitted') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    const snapshot = value.snapshot
    if (!nonEmpty(value.playerId) || !isRecord(snapshot) || snapshot.protocolVersion !== PROTOCOL_VERSION
      || !nonEmpty(snapshot.roomId) || !Number.isSafeInteger(snapshot.revision) || (snapshot.revision as number) < 0
      || !isRecord(snapshot.roomState) || !Array.isArray(snapshot.roomState.playerIds)
      || !Array.isArray(snapshot.roomState.barriers) || !Object.hasOwn(snapshot, 'gamePublicState')
      || !Object.hasOwn(snapshot, 'privateState')
      || (value.admissionId !== undefined && !hexToken(value.admissionId))
      || (value.resumeToken !== undefined && (!hexToken(value.resumeToken)
        || !Number.isSafeInteger(value.resumeExpiresAt) || (value.resumeExpiresAt as number) <= 0))) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'admitted', protocolVersion: PROTOCOL_VERSION,
      playerId: value.playerId, snapshot: snapshot as unknown as LanAdmitted['snapshot'],
      ...(value.admissionId === undefined ? {} : { admissionId: value.admissionId as string }),
      ...(value.resumeToken === undefined ? {} : { resumeToken: value.resumeToken as string,
        resumeExpiresAt: value.resumeExpiresAt as number }) } }
  }
  if (value.kind === 'command') {
    if (!isRecord(value.command) || !Object.hasOwn(value.command, 'protocolVersion')) return { ok: false, error: 'invalid_frame' }
    const parsed = parseCommand(value.command)
    return parsed.ok ? { ok: true, frame: { kind: 'command', command: parsed.command } } : { ok: false, error: parsed.error === 'incompatible_protocol' ? 'incompatible_protocol' : 'invalid_frame' }
  }
  if (value.kind === 'commandResult') {
    const result = value.result
    if (!isRecord(result) || result.protocolVersion !== PROTOCOL_VERSION
      || (result.roomId !== null && !nonEmpty(result.roomId))
      || (result.commandId !== null && !nonEmpty(result.commandId))
      || !['accepted', 'rejected', 'recoverable_error', 'incompatible_protocol'].includes(String(result.status))) {
      return { ok: false, error: 'invalid_frame' }
    }
    return { ok: true, frame: { kind: 'commandResult', result: result as unknown as CommandResult } }
  }
  if (value.kind === 'event') {
    const event = value.event
    if (!isRecord(event) || event.protocolVersion !== PROTOCOL_VERSION || !nonEmpty(event.roomId)
      || !Number.isSafeInteger(event.revision) || (event.revision as number) < 0
      || (event.kind !== 'marker' && event.kind !== 'projection')) return { ok: false, error: 'invalid_frame' }
    if (event.kind === 'projection' && (!isRecord(event.roomState)
      || !Array.isArray(event.roomState.playerIds) || !Array.isArray(event.roomState.barriers)
      || !Object.hasOwn(event, 'gamePublicState') || !Object.hasOwn(event, 'privateState'))) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'event', event: event as unknown as Event<unknown, unknown> } }
  }
  if (value.kind === 'snapshot') {
    const snapshot = value.snapshot
    if (!isRecord(snapshot) || snapshot.protocolVersion !== PROTOCOL_VERSION || !nonEmpty(snapshot.roomId)
      || !Number.isSafeInteger(snapshot.revision) || (snapshot.revision as number) < 0
      || !isRecord(snapshot.roomState) || !Array.isArray(snapshot.roomState.playerIds)
      || !Array.isArray(snapshot.roomState.barriers) || !Object.hasOwn(snapshot, 'gamePublicState')
      || !Object.hasOwn(snapshot, 'privateState')) return { ok: false, error: 'invalid_frame' }
    return { ok: true, frame: { kind: 'snapshot', snapshot: snapshot as unknown as Snapshot<unknown, unknown> } }
  }
  if (value.kind === 'resync') {
    if (!isRecord(value.request) || !Object.hasOwn(value.request, 'protocolVersion')) return { ok: false, error: 'invalid_frame' }
    const parsed = parseResyncRequest(value.request)
    return parsed.ok ? { ok: true, frame: { kind: 'resync', request: parsed.request } } : { ok: false, error: parsed.error === 'incompatible_protocol' ? 'incompatible_protocol' : 'invalid_frame' }
  }
  if (value.kind === 'ping' || value.kind === 'pong') {
    if (value.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'incompatible_protocol' }
    return { ok: true, frame: { kind: value.kind, protocolVersion: PROTOCOL_VERSION } }
  }
  return { ok: false, error: 'invalid_frame' }
}

function ingressError(value: unknown): value is IngressError {
  return value === 'invalid_invite' || value === 'invite_expired' || value === 'invite_used'
    || value === 'too_many_attempts' || value === 'incompatible_protocol' || value === 'room_closed'
    || value === 'coordinator_rejected'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function hexToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
