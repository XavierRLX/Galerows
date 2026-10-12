import { ClientReplicaV2 } from '../persistentReplica'
import { parseRoomCommandV2 } from '../persistentProtocol'
import type { RoomCommandResultV2, RoomCommandV2, RoomSnapshotV2 } from '../persistentProtocol'
import { hostVerificationCode } from './lanInvite'
import { decodePersistentLanInvite, encodePersistentLanInvite } from './lanPersistentInvite'
import type { PersistentLanInvite } from './lanPersistentInvite'
import { encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame } from './lanPersistentWire'
import type { LanSecureNativeClient } from './lanSecureNativeClient'

type NativeV2 = Pick<LanSecureNativeClient, 'connectV2' | 'connectResume' | 'sendV2' | 'storeResumeCredential'
  | 'rotateResumeCredential' | 'clearResumeCredential' | 'disconnect' | 'onV2Event'>
type NativeEvent = { type: string; frame?: PersistentLanFrame }
type Phase = 'idle' | 'connecting' | 'awaiting_admitted' | 'awaiting_confirmed'
  | 'awaiting_resume' | 'awaiting_resume_confirmed' | 'leaving' | 'admitted' | 'failed'
type Pending = { kind: PersistentLanFrame['kind']; resolve: (frame: PersistentLanFrame) => void;
  reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
type PendingCommand = { commandId: string; resolve: (result: RoomCommandResultV2) => void;
  reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
type PendingResync = { resolve: (snapshot: RoomSnapshotV2) => void;
  reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
export type GuestCommandInput = Pick<RoomCommandV2, 'scope' | 'type' | 'payload' | 'gameSessionId'>
  & { commandId?: string }

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_EARLY_EVENTS = 64

/** Pinned WSS v2 guest ingress, versioned resume, terminal leave and revision-safe replica. */
export class LanPersistentGuestAdmission {
  private readonly native: NativeV2
  private readonly timeoutMs: number
  private phase: Phase = 'idle'
  private listener: { remove: () => Promise<void> } | null = null
  private pending: Pending | null = null
  private pendingCommand: PendingCommand | null = null
  private pendingResync: PendingResync | null = null
  private invite: PersistentLanInvite | null = null
  private roomId: string | null = null
  private leaveCommandId: string | null = null
  private leaveConfirmed = false
  private playerId: string | null = null
  private replica: ClientReplicaV2 | null = null
  private nextClientSeq = 1
  private sequenceUnknown = false
  private earlyEvents: PersistentLanFrame[] = []
  private credentialExpiresAt = 0
  private latestRekeyId: string | null = null
  private persistedRekeyCount = 0
  private rekeyWork: Promise<void> | null = null

  constructor(native: NativeV2, options: { timeoutMs?: number } = {}) {
    this.native = native
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** Diagnostics: number of completed Android vault rotations, never a credential. */
  getRekeyCount() { return this.persistedRekeyCount }

  getState() {
    return this.phase === 'admitted' ? this.replica?.getState() ?? null : null
  }

  async connectInvite(invite: PersistentLanInvite, enterHostCode: () => string | Promise<string>):
    Promise<{ playerId: string; snapshot: RoomSnapshotV2 }> {
    if (this.phase !== 'idle') throw new Error('already_connecting')
    let parsed: ReturnType<typeof decodePersistentLanInvite>
    try { parsed = decodePersistentLanInvite(encodePersistentLanInvite(invite)) }
    catch { throw new Error('invalid_invite') }
    if (!parsed.ok) throw new Error(parsed.error)

    this.phase = 'connecting'
    this.invite = parsed.invite
    this.roomId = parsed.invite.roomId
    try {
      this.listener = await this.native.onV2Event(event => this.onEvent(event))
      await this.native.connectV2(invite.hostIp, invite.port, invite.fingerprint, invite.roomId, invite.capability)
      if (this.connectionFailed()) throw new Error('connection_lost')
      const entered = await enterHostCode()
      if (typeof entered !== 'string' || entered.trim().toUpperCase() !== hostVerificationCode(invite.fingerprint)) {
        throw new Error('host_identity_mismatch')
      }
      this.phase = 'awaiting_admitted'
      const offer = await this.exchange('admittedV2', () => this.native.sendV2({
        kind: 'joinRequestV2', protocolVersion: 2, invite,
      }))
      if (offer.kind !== 'admittedV2' || !this.validOffer(offer)) throw new Error('invalid_admission')
      this.playerId = offer.playerId
      this.replica = new ClientReplicaV2(invite.roomId, offer.snapshot)
      this.nextClientSeq = offer.snapshot.nextClientSeq
      this.credentialExpiresAt = offer.resumeExpiresAt
      // Native AES-GCM Keystore credential is durable BEFORE an admission ACK is allowed.
      await this.native.storeResumeCredential({
        roomId: invite.roomId, playerId: offer.playerId, resumeToken: offer.resumeToken,
        expiresAt: offer.resumeExpiresAt, host: invite.hostIp, port: invite.port,
        fingerprint: invite.fingerprint, protocolVersion: 2,
      })
      this.phase = 'awaiting_confirmed'
      const confirmation = await this.exchange('admissionConfirmedV2', () => this.native.sendV2({
        kind: 'admissionAckV2', protocolVersion: 2, roomId: invite.roomId,
        playerId: offer.playerId, admissionId: offer.admissionId,
      }))
      if (confirmation.kind !== 'admissionConfirmedV2'
        || confirmation.roomId !== invite.roomId || confirmation.playerId !== offer.playerId
        || confirmation.admissionId !== offer.admissionId) throw new Error('invalid_admission_confirmation')
      this.phase = 'admitted'
      for (const frame of this.earlyEvents.splice(0)) this.onRoomFrame(frame)
      return { playerId: offer.playerId, snapshot: offer.snapshot }
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'admission_failed')
      await this.native.disconnect().catch(() => undefined)
      await this.listener?.remove()
      this.listener = null
      throw error
    }
  }

  /** New instance recommended after a channel drop: native vault provides TLS pin and versioned token. */
  async resume(roomId: string, expectedPlayerId?: string, previous?: ClientReplicaV2):
    Promise<{ playerId: string; snapshot: RoomSnapshotV2 }> {
    if (this.phase !== 'idle') throw new Error('already_connecting')
    this.roomId = roomId
    this.phase = 'awaiting_resume'
    try {
      this.listener = await this.native.onV2Event(event => this.onEvent(event))
      // Native connectResume sends the versioned resumeHello during its WSS handshake.
      const offer = await this.exchange('resumedV2', () => this.native.connectResume(roomId))
      if (offer.kind !== 'resumedV2' || offer.snapshot.roomId !== roomId
        || (expectedPlayerId && offer.playerId !== expectedPlayerId)
        || !offer.snapshot.roomState.members.some(m => m.playerId === offer.playerId && m.role === 'guest')
        || (previous && offer.snapshot.revision < previous.getState().lastAppliedRevision)
        || offer.resumeExpiresAt <= Date.now()) throw new Error('invalid_resume')
      this.playerId = offer.playerId
      const replica = previous ?? new ClientReplicaV2(roomId, offer.snapshot)
      if (previous && replica.applySnapshot(offer.snapshot) !== 'applied') throw new Error('invalid_resume')
      this.replica = replica
      this.nextClientSeq = offer.snapshot.nextClientSeq
      this.credentialExpiresAt = offer.resumeExpiresAt
      // Persist rotated token in AES-GCM Keystore before acknowledging host's rotation.
      await this.native.rotateResumeCredential(roomId, offer.playerId, offer.resumeToken, offer.resumeExpiresAt)
      this.phase = 'awaiting_resume_confirmed'
      const confirmed = await this.exchange('resumeConfirmedV2', () => this.native.sendV2({
        kind: 'resumeAckV2', protocolVersion: 2, roomId, playerId: offer.playerId, resumeId: offer.resumeId,
      }))
      if (confirmed.kind !== 'resumeConfirmedV2' || confirmed.roomId !== roomId
        || confirmed.playerId !== offer.playerId || confirmed.resumeId !== offer.resumeId) {
        throw new Error('invalid_resume_confirmation')
      }
      this.phase = 'admitted'
      for (const frame of this.earlyEvents.splice(0)) this.onRoomFrame(frame)
      return { playerId: offer.playerId, snapshot: offer.snapshot }
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'resume_failed')
      await this.native.disconnect().catch(() => undefined)
      await this.listener?.remove()
      this.listener = null
      throw error
    }
  }

  /** Never clear the vault on an unconfirmed leave: the host may already have revoked the token. */
  async leaveRoom(commandId: string = crypto.randomUUID()): Promise<void> {
    if ((this.phase !== 'admitted' && this.phase !== 'leaving')
      || !this.roomId || !this.playerId || this.pendingCommand || this.pendingResync) {
      throw new Error('lan_disconnected')
    }
    if (this.pending) throw new Error('leave_in_flight')
    // A concurrent authenticated rekey must persist and ACK before leave revokes both tokens.
    if (this.rekeyWork) await this.rekeyWork
    if (this.phase !== 'admitted' && this.phase !== 'leaving') throw new Error('lan_disconnected')
    if (!this.leaveCommandId) this.leaveCommandId = commandId
    this.phase = 'leaving'
    const roomId = this.roomId
    const playerId = this.playerId
    let confirmed: PersistentLanFrame
    try {
      confirmed = await this.exchange('leaveConfirmedV2', () => this.native.sendV2({
        kind: 'leaveRequestV2', protocolVersion: 2, roomId, playerId,
        commandId: this.leaveCommandId!,
      }))
    } catch (error) {
      // revocation_failed can be retried on this same binding. Unknown outcome stays unconfirmed.
      if (error instanceof Error && error.message === 'revocation_failed') throw error
      this.fail('leave_unconfirmed')
      await this.native.disconnect().catch(() => undefined)
      throw new Error('leave_unconfirmed', { cause: error })
    }
    if (confirmed.kind !== 'leaveConfirmedV2' || confirmed.roomId !== roomId
      || confirmed.playerId !== playerId || confirmed.commandId !== this.leaveCommandId) {
      this.fail('invalid_leave_confirmation')
      throw new Error('invalid_leave_confirmation')
    }
    this.leaveConfirmed = true
    await this.native.clearResumeCredential(roomId)
    await this.disconnect().catch(() => undefined)
  }

  async sendCommand(input: GuestCommandInput): Promise<RoomCommandResultV2> {
    if (!this.canSend()) throw new Error('lan_disconnected')
    if (this.sequenceUnknown || this.pendingResync || this.replica!.getState().needsResync) {
      throw new Error('resync_required')
    }
    if (this.pendingCommand) throw new Error('command_in_flight')
    const command: RoomCommandV2 = {
      protocolVersion: 2, roomId: this.roomId!, playerId: this.playerId!,
      scope: input.scope, type: input.type, payload: input.payload,
      commandId: input.commandId ?? crypto.randomUUID(), clientSeq: this.nextClientSeq,
      ...(input.scope === 'game' ? { gameSessionId: input.gameSessionId } : {}),
    }
    if (!parseRoomCommandV2(command).ok) throw new Error('invalid_command')
    const frame: PersistentLanFrame = { kind: 'commandV2', protocolVersion: 2, command }
    encodePersistentLanFrame(frame)
    return new Promise<RoomCommandResultV2>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingCommand?.commandId === command.commandId) {
          this.pendingCommand = null
          this.sequenceUnknown = true
          reject(new Error('command_timeout'))
        }
      }, this.timeoutMs)
      this.pendingCommand = { commandId: command.commandId, resolve, reject, timeout }
      void this.native.sendV2(frame).catch(() => this.fail('send_failed'))
    })
  }

  requestResync(): Promise<RoomSnapshotV2> {
    if (!this.canSend()) return Promise.reject(new Error('lan_disconnected'))
    if (this.pendingResync) return Promise.reject(new Error('resync_in_flight'))
    return new Promise<RoomSnapshotV2>((resolve, reject) => {
      const timeout = setTimeout(() => this.fail('resync_timeout'), this.timeoutMs)
      this.pendingResync = { resolve, reject, timeout }
      void this.native.sendV2({ kind: 'resyncV2', protocolVersion: 2,
        request: { protocolVersion: 2, roomId: this.roomId!, playerId: this.playerId!,
          lastAppliedRevision: this.replica!.getState().lastAppliedRevision } })
        .catch(() => this.fail('resync_send_failed'))
    })
  }

  async disconnect(): Promise<void> {
    this.fail('disconnected')
    await this.native.disconnect()
    await this.listener?.remove()
    this.listener = null
  }

  private canSend(): boolean {
    return this.phase === 'admitted' && this.roomId !== null && this.playerId !== null && this.replica !== null
  }
  private connectionFailed(): boolean { return this.phase === 'failed' }

  private validOffer(offer: Extract<PersistentLanFrame, { kind: 'admittedV2' }>): boolean {
    return Boolean(this.invite && offer.snapshot.roomId === this.invite.roomId
      && offer.snapshot.protocolVersion === 2
      && offer.snapshot.roomState.members.some(member => member.playerId === offer.playerId && member.role === 'guest')
      && offer.resumeExpiresAt > Date.now())
  }

  private exchange(kind: PersistentLanFrame['kind'], send: () => Promise<void>): Promise<PersistentLanFrame> {
    return new Promise<PersistentLanFrame>((resolve, reject) => {
      const timeout = setTimeout(() => this.fail('admission_timeout'), this.timeoutMs)
      this.pending = { kind, resolve, reject, timeout }
      void send().catch(error => this.fail(error instanceof Error ? error.message : 'send_failed'))
    })
  }

  private onEvent(event: NativeEvent) {
    if (event.type === 'closed' && this.leaveConfirmed) return
    if (event.type === 'closed' || event.type === 'invalid_frame') {
      this.fail(event.type === 'closed' ? 'connection_lost' : 'invalid_frame')
      return
    }
    if (event.type !== 'message' || !event.frame) return
    const frame = event.frame
    if (frame.kind === 'rejectedV2') { this.fail(frame.error); return }
    if (frame.kind === 'roomClosedV2' && frame.roomId === this.roomId) {
      void this.native.clearResumeCredential(frame.roomId).catch(() => undefined)
      this.fail('room_closed')
      return
    }
    // Delayed in-flight rekey controls must not abort terminal leave.
    if (this.phase === 'leaving'
      && (frame.kind === 'rekeyOfferV2' || frame.kind === 'rekeyConfirmedV2')) return
    if (this.phase === 'admitted') {
      if (frame.kind === 'rekeyOfferV2') {
        if (!this.rekeyWork) {
          const work = this.handleRekeyOffer(frame)
          this.rekeyWork = work
          void work.finally(() => { if (this.rekeyWork === work) this.rekeyWork = null })
        }
        return
      }
      if (frame.kind === 'rekeyConfirmedV2') {
        if (frame.roomId !== this.roomId || frame.playerId !== this.playerId) this.fail('invalid_rekey')
        return
      }
      this.onRoomFrame(frame)
      return
    }
    const pending = this.pending
    if (!pending) return
    if (pending.kind === 'admittedV2' && frame.kind === 'admittedV2' && !this.validOffer(frame)) {
      this.fail('invalid_admission')
      return
    }
    if ((pending.kind === 'admissionConfirmedV2' || pending.kind === 'resumeConfirmedV2')
      && frame.kind === 'eventV2') {
      if (this.earlyEvents.length === MAX_EARLY_EVENTS) { this.fail('event_overflow'); return }
      this.earlyEvents.push(frame)
      return
    }
    if (pending.kind === 'leaveConfirmedV2' && frame.kind === 'leaveRejectedV2'
      && frame.roomId === this.roomId && frame.playerId === this.playerId
      && frame.commandId === this.leaveCommandId) {
      clearTimeout(pending.timeout)
      this.pending = null
      pending.reject(new Error(frame.error))
      return
    }
    if (frame.kind !== pending.kind) {
      this.fail('unexpected_frame')
      return
    }
    if (frame.kind === 'leaveConfirmedV2') this.leaveConfirmed = true
    clearTimeout(pending.timeout)
    this.pending = null
    pending.resolve(frame)
  }

  /** Persist to the native AES-GCM vault before acknowledging a freshly issued token. */
  private async handleRekeyOffer(frame: Extract<PersistentLanFrame, { kind: 'rekeyOfferV2' }>) {
    if (frame.roomId !== this.roomId || frame.playerId !== this.playerId
      || frame.resumeExpiresAt <= Date.now()) { this.fail('invalid_rekey'); return }
    if (frame.resumeExpiresAt < this.credentialExpiresAt) return // stale queued offer
    if (frame.resumeExpiresAt === this.credentialExpiresAt && frame.rekeyId !== this.latestRekeyId) return
    if (frame.resumeExpiresAt > this.credentialExpiresAt) {
      try {
        await this.native.rotateResumeCredential(frame.roomId, frame.playerId,
          frame.resumeToken, frame.resumeExpiresAt)
      } catch { return } // Host retries the same offer; never acknowledge an unpersisted credential.
      this.credentialExpiresAt = frame.resumeExpiresAt
      this.latestRekeyId = frame.rekeyId
      this.persistedRekeyCount++
    }
    if (this.phase !== 'admitted') return
    try {
      await this.native.sendV2({ kind: 'rekeyAckV2', protocolVersion: 2,
        roomId: frame.roomId, playerId: frame.playerId, rekeyId: frame.rekeyId })
    } catch { this.fail('rekey_send_failed') }
  }

  private onRoomFrame(frame: PersistentLanFrame) {
    if (!this.replica || !this.roomId || !this.playerId) return
    if (frame.kind === 'eventV2') {
      const status = this.replica.applyEvent(frame.event)
      if (status === 'wrong_room' || status === 'incompatible_protocol') {
        this.fail('invalid_event')
      } else if (status === 'gap' && !this.pendingResync) {
        void this.requestResync().catch(() => undefined)
      } else if (status === 'applied') {
        this.nextClientSeq = Math.max(this.nextClientSeq, this.replica.getState().nextClientSeq)
      }
    } else if (frame.kind === 'snapshotV2') {
      if (frame.snapshot.roomId !== this.roomId
        || !frame.snapshot.roomState.members.some(member => member.playerId === this.playerId)) {
        this.fail('invalid_snapshot')
        return
      }
      const status = this.replica.applySnapshot(frame.snapshot)
      if (status === 'stale') {
        if (this.pendingResync) this.fail('stale_resync')
        return
      }
      if (status !== 'applied') { this.fail('invalid_snapshot'); return }
      this.nextClientSeq = Math.max(this.nextClientSeq, frame.snapshot.nextClientSeq)
      this.sequenceUnknown = false
      const pending = this.pendingResync
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingResync = null
        pending.resolve(frame.snapshot)
      }
    } else if (frame.kind === 'commandResultV2') {
      const pending = this.pendingCommand
      if (!pending || frame.result.commandId !== pending.commandId) return
      if (frame.result.roomId !== this.roomId || frame.result.nextClientSeq === null) {
        this.fail('invalid_command_result')
        return
      }
      clearTimeout(pending.timeout)
      this.pendingCommand = null
      // A newer authorized snapshot can arrive before an older command result.
      this.nextClientSeq = Math.max(this.nextClientSeq, frame.result.nextClientSeq)
      pending.resolve(frame.result)
    } else {
      this.fail('unexpected_frame')
    }
  }

  private fail(reason: string) {
    this.phase = 'failed'
    this.replica = null
    this.earlyEvents = []
    if (this.pending) {
      clearTimeout(this.pending.timeout)
      this.pending.reject(new Error(reason))
      this.pending = null
    }
    if (this.pendingCommand) {
      clearTimeout(this.pendingCommand.timeout)
      this.pendingCommand.reject(new Error(reason))
      this.pendingCommand = null
    }
    if (this.pendingResync) {
      clearTimeout(this.pendingResync.timeout)
      this.pendingResync.reject(new Error(reason))
      this.pendingResync = null
    }
  }
}
