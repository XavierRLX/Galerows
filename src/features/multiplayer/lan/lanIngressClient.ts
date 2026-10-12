import { PROTOCOL_VERSION } from '../protocol'
import type { Snapshot } from '../protocol'
import { decodeLanInvite, encodeLanInvite, hostVerificationCode } from './lanInvite'
import type { LanInvite } from './lanInvite'
import { LanSecureNativeClient } from './lanSecureNativeClient'
import type { LanFrame } from './lanWire'

type IngressState = 'idle' | 'socket_connected' | 'tls_verified' | 'ingress_requested' | 'admission_received' | 'resume_requested' | 'admitted' | 'rejected'
type Admission = { playerId: string; snapshot: Snapshot<unknown, unknown>; admissionId?: string; resumeToken?: string; resumeExpiresAt?: number }
type NativeEvent = { type: string; frame?: LanFrame }
export type AdmittedEvent = { type: 'message'; frame: LanFrame } | { type: 'closed' }
type SecureTransport = Pick<LanSecureNativeClient, 'connect' | 'connectResume' | 'send' | 'disconnect' | 'onEvent'>
const MAX_EARLY_FRAMES = 64

/** Task 2 guest state machine; only a future coordinator may turn admission into runtime membership. */
export class LanIngressClient {
  state: IngressState = 'idle'
  playerId: string | null = null
  verificationCode: string | null = null
  private invite: LanInvite | null = null
  private resumeRoomId: string | null = null
  private confirmed = false
  private listener: { remove: () => Promise<void> } | null = null
  private pending: { resolve: (value: Admission) => void; reject: (reason: Error) => void } | null = null
  private pendingConfirmation: { admissionId: string; resolve: () => void; reject: (reason: Error) => void } | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null
  private readonly admittedListeners = new Set<(event: AdmittedEvent) => void>()
  private readonly earlyFrames: AdmittedEvent[] = []
  private readonly transport: SecureTransport

  constructor(transport: SecureTransport = new LanSecureNativeClient()) { this.transport = transport }

  async connect(invite: LanInvite): Promise<void> {
    if (this.state !== 'idle') throw new Error('already_connecting')
    const parsed = decodeLanInvite(encodeLanInvite(invite))
    if (!parsed.ok) { this.state = 'rejected'; throw new Error(parsed.error) }
    this.invite = invite
    this.listener = await this.transport.onEvent(event => this.onEvent(event))
    try {
      // Native connect performs pin validation before sending the hello capability.
      await this.transport.connect(invite.hostIp, invite.port, invite.fingerprint, invite.roomId, invite.capability)
      this.assertSocketOpen()
      this.state = 'tls_verified'
      this.verificationCode = hostVerificationCode(invite.fingerprint)
    } catch (error) {
      this.state = 'rejected'
      await this.listener?.remove()
      this.listener = null
      throw error
    }
  }

  confirmHostCode(enteredCode: string): boolean {
    if (this.state !== 'tls_verified' || this.verificationCode === null) return false
    if (enteredCode.toUpperCase() !== this.verificationCode) {
      this.state = 'rejected'
      void this.transport.disconnect()
      return false
    }
    this.confirmed = true
    return true
  }

  requestAdmission(): Promise<Admission> {
    if (!this.confirmed || this.state !== 'tls_verified' || !this.invite) {
      return Promise.reject(new Error('confirmation_required'))
    }
    this.state = 'ingress_requested'
    return new Promise<Admission>((resolve, reject) => {
      this.pending = { resolve, reject }
      this.timeout = setTimeout(() => this.fail('admission_timeout'), 15_000)
      void this.transport.send({ kind: 'joinRequest', protocolVersion: PROTOCOL_VERSION, invite: this.invite! })
        .catch(() => this.fail('send_failed'))
    })
  }

  resume(roomId: string): Promise<Admission> {
    if (this.state !== 'idle' || !roomId) return Promise.reject(new Error('already_connecting'))
    this.resumeRoomId = roomId
    this.state = 'resume_requested'
    return new Promise<Admission>((resolve, reject) => {
      this.pending = { resolve, reject }
      this.timeout = setTimeout(() => this.fail('resume_timeout'), 15_000)
      void this.transport.onEvent(event => this.onEvent(event)).then(listener => {
        this.listener = listener
        return this.transport.connectResume(roomId)
      }).catch(error => this.fail(error instanceof Error ? error.message : 'resume_failed'))
    })
  }

  confirmAdmission(roomId: string, playerId: string, admissionId: string): Promise<void> {
    if (this.state !== 'admission_received' || !this.invite || this.invite.roomId !== roomId
      || this.playerId !== playerId || !hexToken(admissionId) || this.pendingConfirmation) {
      return Promise.reject(new Error('invalid_admission_confirmation'))
    }
    return new Promise<void>((resolve, reject) => {
      this.pendingConfirmation = { admissionId, resolve, reject }
      this.timeout = setTimeout(() => this.fail('admission_confirmation_timeout'), 15_000)
      void this.transport.send({ kind: 'admissionAck', protocolVersion: PROTOCOL_VERSION, roomId, playerId, admissionId })
        .catch(() => this.fail('admission_ack_failed'))
    })
  }

  async disconnect(): Promise<void> {
    this.fail('disconnected')
    this.state = 'rejected'
    await this.transport.disconnect()
    await this.listener?.remove()
    this.listener = null
    this.earlyFrames.length = 0
    this.admittedListeners.clear()
  }

  sendFrame(frame: LanFrame): Promise<void> {
    if (this.state !== 'admitted') return Promise.reject(new Error('lan_disconnected'))
    return this.transport.send(frame)
  }

  subscribeAdmitted(listener: (event: AdmittedEvent) => void): () => void {
    this.admittedListeners.add(listener)
    for (const event of this.earlyFrames.splice(0)) listener(event)
    return () => this.admittedListeners.delete(listener)
  }

  private onEvent(event: NativeEvent): void {
    if (event.type === 'socket_connected' && this.state === 'idle') this.state = 'socket_connected'
    if (event.type === 'closed') {
      if (this.state === 'admitted') {
        this.publish({ type: 'closed' })
        this.state = 'rejected'
      } else this.fail(this.state === 'resume_requested' ? 'connection_lost' : 'room_closed')
      return
    }
    if (event.type === 'message' && this.state === 'admission_received') {
      if (event.frame?.kind === 'roomClosed' && event.frame.roomId === this.invite?.roomId) {
        this.fail('room_closed')
        return
      }
      if (event.frame?.kind !== 'admissionConfirmed' || !this.invite
        || event.frame.roomId !== this.invite.roomId || event.frame.playerId !== this.playerId
        || event.frame.admissionId !== this.pendingConfirmation?.admissionId) return
      this.clearTimeout()
      this.state = 'admitted'
      this.pendingConfirmation?.resolve()
      this.pendingConfirmation = null
      return
    }
    if (event.type === 'message' && this.state === 'admitted' && event.frame) {
      this.publish({ type: 'message', frame: event.frame })
      return
    }
    if (event.type === 'message' && this.state === 'resume_requested') {
      if (event.frame?.kind === 'resumeRejected') { this.fail(event.frame.error); return }
      if (event.frame?.kind !== 'resumed' || event.frame.snapshot.roomId !== this.resumeRoomId) return
      this.clearTimeout()
      this.playerId = event.frame.playerId
      this.state = 'admitted'
      this.pending?.resolve({ playerId: event.frame.playerId, snapshot: event.frame.snapshot,
        resumeToken: event.frame.resumeToken, resumeExpiresAt: event.frame.resumeExpiresAt })
      this.pending = null
      return
    }
    if (event.type !== 'message' || this.state !== 'ingress_requested') return
    const frame = event.frame
    if (frame?.kind === 'rejected') { this.fail(frame.error); return }
    if (frame?.kind !== 'admitted' || !this.invite || frame.snapshot.roomId !== this.invite.roomId) return
    this.clearTimeout()
    this.playerId = frame.playerId
    this.state = 'admission_received'
    this.pending?.resolve({ playerId: frame.playerId, snapshot: frame.snapshot,
      admissionId: frame.admissionId, resumeToken: frame.resumeToken, resumeExpiresAt: frame.resumeExpiresAt })
    this.pending = null
  }

  private publish(event: AdmittedEvent): void {
    if (this.admittedListeners.size) {
      for (const listener of this.admittedListeners) listener(event)
      return
    }
    if (this.earlyFrames.length >= MAX_EARLY_FRAMES) {
      this.earlyFrames.length = 0
      this.earlyFrames.push({ type: 'closed' })
      this.state = 'rejected'
      void this.transport.disconnect().catch(() => undefined)
      return
    }
    this.earlyFrames.push(event)
  }

  private fail(reason: string): void {
    if (this.state === 'admitted') return
    this.state = 'rejected'
    this.clearTimeout()
    this.pending?.reject(new Error(reason))
    this.pending = null
    this.pendingConfirmation?.reject(new Error(reason))
    this.pendingConfirmation = null
  }

  private clearTimeout(): void {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
  }

  private assertSocketOpen(): void {
    if (this.state === 'rejected') throw new Error('room_closed')
  }
}

function hexToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
