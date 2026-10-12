import { PROTOCOL_VERSION } from '../protocol'
import type { Snapshot } from '../protocol'
import { sameLanInvite } from './lanInvite'
import type { LanInvite } from './lanInvite'

export type IngressError =
  | 'invalid_invite' | 'invite_expired' | 'invite_used' | 'too_many_attempts'
  | 'incompatible_protocol' | 'room_closed' | 'coordinator_rejected'

export interface LanJoinRequest {
  kind: 'joinRequest'
  protocolVersion: number
  invite: LanInvite
}
export interface LanAdmitted {
  kind: 'admitted'
  protocolVersion: number
  playerId: string
  snapshot: Snapshot<unknown, unknown>
  admissionId?: string
  resumeToken?: string
  resumeExpiresAt?: number
}
export interface LanRejected {
  kind: 'rejected'
  protocolVersion: number
  error: IngressError
}
export type LanAdmissionReply = LanAdmitted | LanRejected
export type CoordinatorDecision =
  | { playerId: string; snapshot: Snapshot<unknown, unknown>; admissionId?: string; resumeToken?: string; resumeExpiresAt?: number }
  | { ok: false; error: 'room_closed' | 'coordinator_rejected' }

/** Reserves an invitation capability before calling the future runtime coordinator. */
export class LanAdmissionGate {
  readonly invite: LanInvite
  private reserved = false
  reservedBy: string | null = null
  private failedAttempts = 0
  private states = new Map<string, 'socket_connected' | 'ingress_requested' | 'admitted' | 'rejected'>()

  constructor(invite: LanInvite) { this.invite = invite }

  state(peerId: string) { return this.states.get(peerId) ?? 'socket_connected' }

  async request(
    peerId: string, frame: LanJoinRequest, now: number,
    coordinator: (peerId: string) => Promise<CoordinatorDecision>,
  ): Promise<LanAdmissionReply> {
    const reject = (error: IngressError): LanRejected => {
      this.states.set(peerId, 'rejected')
      return { kind: 'rejected', protocolVersion: PROTOCOL_VERSION, error }
    }
    if (this.failedAttempts >= 3) return reject('too_many_attempts')
    if (frame.protocolVersion !== PROTOCOL_VERSION) return reject('incompatible_protocol')
    if (now >= this.invite.expiresAt) return reject('invite_expired')
    if (this.reserved) return reject('invite_used')
    if (!sameLanInvite(this.invite, frame.invite)) {
      this.failedAttempts++
      return reject('invalid_invite')
    }
    this.reserved = true // JS event loop makes this reservation atomic before the first await.
    this.reservedBy = peerId
    this.states.set(peerId, 'ingress_requested')
    try {
      const decision = await coordinator(peerId)
      if ('ok' in decision) return reject(decision.error)
      if (!decision.playerId || decision.snapshot.roomId !== this.invite.roomId) return reject('coordinator_rejected')
      this.states.set(peerId, 'admitted')
      return { kind: 'admitted', protocolVersion: PROTOCOL_VERSION,
        playerId: decision.playerId, snapshot: decision.snapshot,
        ...(decision.admissionId ? { admissionId: decision.admissionId } : {}),
        ...(decision.resumeToken ? { resumeToken: decision.resumeToken, resumeExpiresAt: decision.resumeExpiresAt } : {}) }
    } catch {
      return reject('coordinator_rejected')
    }
  }
}
