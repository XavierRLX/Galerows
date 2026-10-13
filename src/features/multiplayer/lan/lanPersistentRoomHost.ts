import type { RoomCoordinatorV2, RoomDeliveryV2, RoomJoinV2 } from '../persistentRoom'
import type { RoomCommandV2, RoomCommandResultV2 } from '../persistentProtocol'
import { hostVerificationCode, newLanCapability } from './lanInvite'
import { codeRoomCapability, newShortRoomCode } from './lanShortRoomCode'
import type { LanNativeHost } from './lanNativeHost'
import { createPersistentLanInvite, samePersistentLanInvite } from './lanPersistentInvite'
import type { PersistentLanInvite } from './lanPersistentInvite'
import { encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame, PersistentAdmissionError } from './lanPersistentWire'

type NativeV2 = Pick<LanNativeHost, 'startSecureV2' | 'rotateInviteToken' | 'registerResumeToken'
  | 'revokeResumeToken' | 'closePeer' | 'sendV2' | 'stop' | 'onV2Event'>
  & Partial<Pick<LanNativeHost, 'setRoomCodeToken'>>
type NativeEvent = { type: string; peerId: string; frame?: PersistentLanFrame }
type Binding = { peerId: string; connectionId: string; playerId: string; resumeToken: string }
type Pending = { binding: Binding; joined: Extract<RoomJoinV2, { ok: true }>;
  admissionId: string; resumeExpiresAt: number; timeout?: ReturnType<typeof setTimeout> }
type Credential = { current: string; expiresAt: number; pending?: string; pendingExpiresAt?: number }
type PendingResume = { peerId: string; playerId: string; connectionId: string; resumeId: string;
  deliveries: readonly RoomDeliveryV2[]; timeout?: ReturnType<typeof setTimeout> }
type LeaveTombstone = { playerId: string; commandId: string; revision: number; expiresAt: number }
type PendingRekey = { rekeyId: string; token: string; expiresAt: number;
  retryTimer?: ReturnType<typeof setTimeout> }
const CREDENTIAL_TTL_MS = 2 * 60 * 60 * 1000
const DEFAULT_ACK_TIMEOUT_MS = 15_000
const DEFAULT_REKEY_AFTER_MS = 60 * 60 * 1000
const DEFAULT_REKEY_RETRY_MS = 30_000
/** Host WSS identity expires at 24h; guard closes the Room one hour earlier. */
export const PERSISTENT_V2_MAX_ROOM_AGE_MS = 23 * 60 * 60 * 1000

/** Versioned v2 host boundary: native hello is never membership; peer binding is authoritative.
 * Resume is rotated in two stages and terminal leave revokes the native credential first.
 */
export class LanPersistentRoomHost {
  currentInvite: PersistentLanInvite | null = null
  private shortCode: string | null = null
  private shortCodeToken: string | null = null
  private listener: { remove: () => Promise<void> } | null = null
  private readonly peers = new Set<string>()
  private readonly bindings = new Map<string, Binding>()
  private readonly consumed = new Set<string>()
  private readonly failedAttempts = new Map<string, number>()
  private readonly credentials = new Map<string, Credential>()
  private readonly pendingResumes = new Map<string, PendingResume>()
  private readonly rekeys = new Map<string, PendingRekey>()
  private readonly rekeyTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly leaving = new Set<string>()
  private readonly leaveTombstones = new Map<string, LeaveTombstone>()
  private pending: Pending | null = null
  private tail: Promise<void> = Promise.resolve()
  private roomId = ''
  private hostIp = ''
  private port = 0
  private fingerprint = ''
  private closed = false
  private roomAgeTimer: ReturnType<typeof setTimeout> | null = null
  private stopping: Promise<void> | null = null
  private readonly admissionTimeoutMs: number
  private readonly rekeyAfterMs: number
  private readonly rekeyRetryMs: number
  private readonly coordinator: RoomCoordinatorV2
  private readonly native: NativeV2

  constructor(coordinator: RoomCoordinatorV2, native: NativeV2,
    options: { admissionTimeoutMs?: number; rekeyAfterMs?: number; rekeyRetryMs?: number } = {}) {
    this.coordinator = coordinator
    this.native = native
    this.admissionTimeoutMs = options.admissionTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS
    this.rekeyAfterMs = options.rekeyAfterMs ?? DEFAULT_REKEY_AFTER_MS
    this.rekeyRetryMs = options.rekeyRetryMs ?? DEFAULT_REKEY_RETRY_MS
    if (!Number.isSafeInteger(this.rekeyAfterMs) || this.rekeyAfterMs <= 0
      || !Number.isSafeInteger(this.rekeyRetryMs) || this.rekeyRetryMs <= 0) throw new Error('invalid_rekey_interval')
  }

  playerForPeer(peerId: string): string | null {
    return this.bindings.get(peerId)?.playerId ?? null
  }

  /** Trusted local host path. Uses the same ordering and per-recipient projection fanout as guest frames. */
  processLocalCommand(command: RoomCommandV2, hostConnectionId: string): Promise<RoomCommandResultV2> {
    if (this.closed || !this.currentInvite) return Promise.reject(new Error('room_closed'))
    const scheduled = this.tail.then(async () => {
      if (this.closed) throw new Error('room_closed')
      if (this.pending || this.pendingResumes.size) throw new Error('transition_pending')
      const identity = await this.coordinator.snapshotFor(command.playerId, hostConnectionId)
      if (!identity.ok || identity.snapshot.roomState.hostPlayerId !== command.playerId
        || command.roomId !== this.roomId) throw new Error('unauthorized_host')
      const outcome = await this.coordinator.processCommand(command, hostConnectionId)
      try { await this.deliver(outcome.deliveries) }
      catch (error) {
        queueMicrotask(() => { void this.stop().catch(() => undefined) })
        throw error
      }
      return outcome.result
    })
    this.tail = scheduled.then(() => undefined, () => undefined)
    return scheduled
  }

  publicRoomCode() { return this.shortCode }

  hostCode() {
    if (!this.fingerprint) throw new Error('not_running')
    return hostVerificationCode(this.fingerprint)
  }

  async start(roomId: string, hostIp: string): Promise<PersistentLanInvite> {
    if (this.listener || this.closed) throw new Error('already_running')
    this.listener = await this.native.onV2Event(event => this.enqueue(() => this.handle(event)))
    try {
      const capability = newLanCapability()
      const shortCode = newShortRoomCode()
      const shortCodeToken = await codeRoomCapability(roomId, shortCode)
      const result = await this.native.startSecureV2(roomId, capability)
      const invite = createPersistentLanInvite({ roomId, hostIp,
        port: result.port, fingerprint: result.fingerprint, capability })
      this.roomId = roomId; this.hostIp = hostIp; this.port = result.port
      this.fingerprint = result.fingerprint; this.currentInvite = invite
      this.shortCode = shortCode
      this.shortCodeToken = shortCodeToken
      // Initialize room authority BEFORE NSD makes the short-code endpoint visible.
      if (this.native.setRoomCodeToken) await this.native.setRoomCodeToken(roomId, shortCode, shortCodeToken)
      this.roomAgeTimer = setTimeout(() => { void this.stop().catch(() => undefined) }, PERSISTENT_V2_MAX_ROOM_AGE_MS)
      return invite
    } catch (error) {
      this.closed = true
      await this.native.stop().catch(() => undefined)
      await this.listener.remove()
      this.listener = null
      throw error
    }
  }

  async refreshInvite(hostIp = this.hostIp): Promise<PersistentLanInvite> {
    if (!this.currentInvite || this.closed || this.pending) throw new Error('invite_unavailable')
    const capability = newLanCapability()
    const next = createPersistentLanInvite({
      roomId: this.roomId, hostIp, port: this.port, fingerprint: this.fingerprint, capability,
    })
    await this.native.rotateInviteToken(capability)
    this.consumed.add(this.currentInvite.capability)
    this.hostIp = hostIp; this.currentInvite = next
    return next
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping
    this.closed = true
    for (const timer of this.rekeyTimers.values()) clearTimeout(timer)
    this.rekeyTimers.clear()
    for (const entry of this.rekeys.values()) if (entry.retryTimer) clearTimeout(entry.retryTimer)
    this.rekeys.clear()
    if (this.roomAgeTimer) clearTimeout(this.roomAgeTimer)
    this.roomAgeTimer = null
    this.stopping = this.finishStop()
    return this.stopping
  }

  private async finishStop(): Promise<void> {
    await this.tail
    const pending = this.pending
    if (pending) await this.compensate(pending, false)
    await Promise.all([...this.bindings.values()].map(async binding => {
      await this.native.sendV2(binding.peerId, { kind: 'roomClosedV2', protocolVersion: 2,
        roomId: this.roomId }).catch(() => undefined)
    }))
    // This includes disconnected members: room closure must not preserve their valid native tokens.
    await Promise.all([...this.credentials].flatMap(([playerId, credential]) =>
      [credential.current, credential.pending].filter((t): t is string => Boolean(t))
        .map(token => this.native.revokeResumeToken(playerId, token).catch(() => undefined))))
    this.bindings.clear()
    this.credentials.clear()
    for (const resume of this.pendingResumes.values()) if (resume.timeout) clearTimeout(resume.timeout)
    this.pendingResumes.clear()
    this.leaving.clear()
    this.leaveTombstones.clear()
    this.peers.clear()
    try { await this.native.stop() }
    finally {
      await this.listener?.remove()
      this.listener = null
      this.currentInvite = null
      this.shortCode = null
      this.shortCodeToken = null
    }
  }

  private enqueue(operation: () => Promise<void>) {
    this.tail = this.tail.then(operation).catch(() => {
      // An unexpected authority/native failure must not leave a usable socket open.
      queueMicrotask(() => { void this.stop().catch(() => undefined) })
    })
  }

  private async handle(event: NativeEvent): Promise<void> {
    if (this.closed) return
    if (event.type === 'room_expired') { this.failClose(); return }
    if (event.type === 'connected') { this.peers.add(event.peerId); return }
    if (event.type === 'disconnected') {
      this.peers.delete(event.peerId)
      const pendingResume = this.pendingResumes.get(event.peerId)
      if (pendingResume?.timeout) clearTimeout(pendingResume.timeout)
      this.pendingResumes.delete(event.peerId)
      if (this.pending?.binding.peerId === event.peerId) await this.compensate(this.pending, false)
      const binding = this.bindings.get(event.peerId)
      if (binding) {
        this.cancelRekey(binding.playerId)
        this.bindings.delete(event.peerId)
        const outcome = await this.coordinator.disconnect(binding.connectionId)
        if (outcome.ok) await this.deliver(outcome.deliveries)
        if (this.leaving.has(binding.playerId)) {
          // The last authorized retry path vanished while native revocation was uncertain.
          // Close the entire WSS authority rather than retain a resumable orphan membership.
          this.failClose()
        }
      }
      return
    }
    if (!this.peers.has(event.peerId)) return
    if (event.type !== 'message' || !event.frame) {
      await this.dropPeer(event.peerId)
      return
    }
    if (event.frame.kind === 'resumeHello') {
      await this.resume(event.peerId, event.frame)
    } else if (event.frame.kind === 'rekeyAckV2') {
      await this.rekeyAck(event.peerId, event.frame)
    } else if (event.frame.kind === 'resumeAckV2') {
      await this.resumeAck(event.peerId, event.frame)
    } else if (event.frame.kind === 'leaveRequestV2') {
      await this.leave(event.peerId, event.frame)
    } else if (event.frame.kind === 'joinRequestV2') {
      await this.join(event.peerId, event.frame.invite)
    } else if (event.frame.kind === 'admissionAckV2') {
      await this.ack(event.peerId, event.frame)
    } else if (event.frame.kind === 'commandV2' || event.frame.kind === 'resyncV2') {
      await this.authorizedFrame(event.peerId, event.frame)
    } else {
      // Unknown controls and replayed admission messages are terminal.
      await this.dropPeer(event.peerId)
    }
  }

  private async join(peerId: string, invite: PersistentLanInvite) {
    if (this.bindings.has(peerId) || this.pending?.binding.peerId === peerId) {
      await this.dropPeer(peerId)
      return
    }
    const issued = this.currentInvite
    if (!issued) return
    const reject = async (error: PersistentAdmissionError) =>
      this.native.sendV2(peerId, { kind: 'rejectedV2', protocolVersion: 2, error }).catch(() => this.dropPeer(peerId))
    if ((this.failedAttempts.get(peerId) ?? 0) >= 3) { await reject('too_many_attempts'); return }
    const byShortCode = this.shortCodeToken !== null && invite.capability === this.shortCodeToken
      && invite.roomId === this.roomId && invite.port === this.port
      && invite.fingerprint === this.fingerprint && invite.hostIp === this.hostIp
      && invite.issuedAt <= Date.now() + 5_000 && invite.expiresAt > Date.now()
    if (!byShortCode && Date.now() >= issued.expiresAt) { await reject('invite_expired'); return }
    if (this.pending || (!byShortCode && this.consumed.has(invite.capability))) { await reject('invite_used'); return }
    if (!byShortCode && !samePersistentLanInvite(issued, invite)) {
      this.failedAttempts.set(peerId, (this.failedAttempts.get(peerId) ?? 0) + 1)
      await reject('invalid_invite')
      return
    }

    // QR remains one-use; short code stays available for friends joining later.
    if (!byShortCode) {
      try { await this.refreshInvite() }
      catch { await this.dropPeer(peerId); throw new Error('invite_rotation_failed') }
    }

    const connectionId = `lan-v2-${crypto.randomUUID()}`
    const joined = await this.coordinator.joinGuest(connectionId)
    if (!joined.ok) { await reject(joined.error === 'room_full' ? 'room_full' : 'coordinator_rejected'); return }
    const binding: Binding = { peerId, connectionId, playerId: joined.playerId, resumeToken: newLanCapability() }
    const admissionId = newLanCapability()
    const resumeExpiresAt = Date.now() + CREDENTIAL_TTL_MS
    const offer: PersistentLanFrame = { kind: 'admittedV2', protocolVersion: 2, playerId: binding.playerId,
      snapshot: joined.snapshot, admissionId, resumeToken: binding.resumeToken, resumeExpiresAt }
    const pending: Pending = { binding, joined, admissionId, resumeExpiresAt }
    this.pending = pending
    try {
      if (joined.snapshot.roomId !== this.roomId) throw new Error('room_mismatch')
      encodePersistentLanFrame(offer)
      await this.native.registerResumeToken(binding.playerId, binding.resumeToken, resumeExpiresAt)
      if (!this.peers.has(peerId) || this.closed) throw new Error('peer_disconnected')
      await this.native.sendV2(peerId, offer)
      pending.timeout = setTimeout(() => this.enqueue(() => this.compensate(pending, true)), this.admissionTimeoutMs)
    } catch {
      await this.compensate(pending, true)
    }
  }

  private async ack(peerId: string, frame: Extract<PersistentLanFrame, { kind: 'admissionAckV2' | 'admissionConfirmedV2' }>) {
    const pending = this.pending
    if (!pending || peerId !== pending.binding.peerId || !this.peers.has(peerId)
      || frame.kind !== 'admissionAckV2' || frame.roomId !== this.roomId
      || frame.playerId !== pending.binding.playerId || frame.admissionId !== pending.admissionId) {
      await this.dropPeer(peerId)
      return
    }
    if (pending.timeout) clearTimeout(pending.timeout)
    try {
      await this.native.sendV2(peerId, { kind: 'admissionConfirmedV2', protocolVersion: 2,
        roomId: this.roomId, playerId: pending.binding.playerId, admissionId: pending.admissionId })
      if (!this.peers.has(peerId) || this.closed) throw new Error('peer_disconnected')
      this.pending = null
      this.credentials.set(pending.binding.playerId, { current: pending.binding.resumeToken,
        expiresAt: pending.resumeExpiresAt })
      this.bindings.set(peerId, pending.binding)
      this.scheduleRekey(pending.binding.playerId)
      await this.deliver(pending.joined.deliveries)
    } catch {
      await this.compensate(pending, true)
    }
  }

  private async authorizedFrame(peerId: string,
    frame: Extract<PersistentLanFrame, { kind: 'commandV2' | 'resyncV2' }>) {
    const binding = this.bindings.get(peerId)
    if (!binding || !this.peers.has(peerId) || this.pendingResumes.has(peerId)
      || this.leaving.has(binding.playerId)
      || this.coordinator.runtime.getConnectionId(binding.playerId) !== binding.connectionId) {
      await this.dropPeer(peerId)
      return
    }
    const requested = frame.kind === 'commandV2' ? frame.command : frame.request
    // Frame-declared identities are never authority. Reject before touching clientSeq.
    if (requested.roomId !== this.roomId || requested.playerId !== binding.playerId) {
      await this.dropPeer(peerId)
      return
    }
    if (frame.kind === 'commandV2') {
      const outcome = await this.coordinator.processCommand(frame.command, binding.connectionId)
      await this.native.sendV2(peerId, { kind: 'commandResultV2', protocolVersion: 2, result: outcome.result })
      await this.deliver(outcome.deliveries)
    } else {
      const outcome = await this.coordinator.snapshotFor(binding.playerId, binding.connectionId)
      if (!outcome.ok) {
        await this.dropPeer(peerId)
        return
      }
      await this.native.sendV2(peerId, { kind: 'snapshotV2', protocolVersion: 2, snapshot: outcome.snapshot })
    }
  }

  /** Offer rotation over an already authenticated WSS peer. Never advance host authority before vault ACK. */
  private scheduleRekey(playerId: string) {
    const previous = this.rekeyTimers.get(playerId)
    if (previous) clearTimeout(previous)
    this.rekeyTimers.delete(playerId)
    const credential = this.credentials.get(playerId)
    if (this.closed || !credential || this.leaving.has(playerId)) return
    const remaining = credential.expiresAt - Date.now()
    if (remaining <= 0) { this.failClose(); return }
    const delay = Math.min(this.rekeyAfterMs, Math.max(0, remaining - this.rekeyRetryMs))
    this.rekeyTimers.set(playerId, setTimeout(() => {
      this.rekeyTimers.delete(playerId)
      this.enqueue(() => this.rekeyFor(playerId))
    }, delay))
  }

  private cancelRekey(playerId: string) {
    const timer = this.rekeyTimers.get(playerId)
    if (timer) clearTimeout(timer)
    this.rekeyTimers.delete(playerId)
    const pending = this.rekeys.get(playerId)
    if (pending?.retryTimer) clearTimeout(pending.retryTimer)
    this.rekeys.delete(playerId)
  }

  private async rekeyFor(playerId: string) {
    if (this.closed || this.leaving.has(playerId)) return
    const credential = this.credentials.get(playerId)
    const binding = [...this.bindings.values()].find(b => b.playerId === playerId)
    if (!credential || !binding || !this.peers.has(binding.peerId)
      || this.pendingResumes.has(binding.peerId)) return
    if (Date.now() >= credential.expiresAt) { this.failClose(); return }
    let pending = this.rekeys.get(playerId)
    if (!pending) {
      // Never overwrite an unfinished resume rotation with a third native token.
      if (credential.pending) return
      const token = newLanCapability()
      const expiresAt = Date.now() + CREDENTIAL_TTL_MS
      try { await this.native.registerResumeToken(playerId, token, expiresAt) }
      catch { this.failClose(); return }
      // The host may have begun teardown while native registration was pending.
      // Never offer the new token to a guest after room authority has closed.
      if (this.closed) {
        await this.native.revokeResumeToken(playerId, token).catch(() => undefined)
        return
      }
      credential.pending = token
      credential.pendingExpiresAt = expiresAt
      pending = { rekeyId: newLanCapability(), token, expiresAt }
      this.rekeys.set(playerId, pending)
    }
    try {
      await this.native.sendV2(binding.peerId, {
        kind: 'rekeyOfferV2', protocolVersion: 2, roomId: this.roomId,
        playerId, rekeyId: pending.rekeyId, resumeToken: pending.token,
        resumeExpiresAt: pending.expiresAt,
      })
    } catch { this.failClose(); return }
    pending.retryTimer = setTimeout(() => {
      this.enqueue(() => this.rekeyFor(playerId))
    }, this.rekeyRetryMs)
  }

  private async rekeyAck(peerId: string, frame: Extract<PersistentLanFrame, { kind: 'rekeyAckV2' | 'rekeyConfirmedV2' }>) {
    const binding = this.bindings.get(peerId)
    const pending = binding && this.rekeys.get(binding.playerId)
    const credential = binding && this.credentials.get(binding.playerId)
    if (!binding || !pending || !credential || !this.peers.has(peerId)
      || frame.roomId !== this.roomId || frame.playerId !== binding.playerId
      || frame.rekeyId !== pending.rekeyId || credential.pending !== pending.token
      || this.coordinator.runtime.getConnectionId(binding.playerId) !== binding.connectionId
      || this.leaving.has(binding.playerId)) {
      await this.dropPeer(peerId); return
    }
    try { await this.native.revokeResumeToken(binding.playerId, credential.current) }
    catch { this.failClose(); return }
    credential.current = pending.token
    credential.expiresAt = pending.expiresAt
    credential.pending = undefined
    credential.pendingExpiresAt = undefined
    binding.resumeToken = credential.current
    this.cancelRekey(binding.playerId)
    this.scheduleRekey(binding.playerId)
    try {
      await this.native.sendV2(peerId, { kind: 'rekeyConfirmedV2', protocolVersion: 2,
        roomId: this.roomId, playerId: binding.playerId, rekeyId: pending.rekeyId })
    } catch { await this.dropPeer(peerId) }
  }

  private async resume(peerId: string, frame: Extract<PersistentLanFrame, { kind: 'resumeHello' }>) {
    if (frame.roomId !== this.roomId || this.pending || this.bindings.has(peerId)
      || this.pendingResumes.has(peerId) || this.leaving.has(frame.playerId)) {
      await this.dropPeer(peerId); return
    }
    const credential = this.credentials.get(frame.playerId)
    const now = Date.now()
    if (!credential || !this.coordinator.runtime.hasMembership(frame.playerId)) {
      await this.dropPeer(peerId); return
    }
    const isCurrent = frame.resumeToken === credential.current && now < credential.expiresAt
    const isPending = frame.resumeToken === credential.pending && now < (credential.pendingExpiresAt ?? 0)
    if (!isCurrent && !isPending) { await this.dropPeer(peerId); return }
    this.cancelRekey(frame.playerId)
    // The registered rekey token was not persisted on a client that resumes with the old token.
    if (isCurrent && credential.pending) {
      try { await this.native.revokeResumeToken(frame.playerId, credential.pending) }
      catch { this.failClose(); return }
      credential.pending = undefined
      credential.pendingExpiresAt = undefined
    }

    // A pending credential already persisted by the guest proves that the prior response arrived.
    if (isPending) {
      try { await this.native.revokeResumeToken(frame.playerId, credential.current) }
      catch { this.failClose(); return }
      credential.current = credential.pending!
      credential.expiresAt = credential.pendingExpiresAt!
      credential.pending = undefined
      credential.pendingExpiresAt = undefined
    }
    if (!credential.pending) {
      const token = newLanCapability()
      const expiresAt = Date.now() + CREDENTIAL_TTL_MS
      try { await this.native.registerResumeToken(frame.playerId, token, expiresAt) }
      catch { this.failClose(); return }
      credential.pending = token
      credential.pendingExpiresAt = expiresAt
    }
    const oldBinding = [...this.bindings.values()].find(b => b.playerId === frame.playerId)
    const connectionId = `lan-v2-${crypto.randomUUID()}`
    const outcome = await this.coordinator.reassociate(frame.playerId, connectionId)
    if (!outcome.ok || !outcome.snapshot) { await this.dropPeer(peerId); return }
    const resumeId = newLanCapability()
    const response: PersistentLanFrame = { kind: 'resumedV2', protocolVersion: 2,
      playerId: frame.playerId, snapshot: outcome.snapshot, resumeId,
      resumeToken: credential.pending!, resumeExpiresAt: credential.pendingExpiresAt! }
    try { encodePersistentLanFrame(response) }
    catch { await this.coordinator.disconnect(connectionId); await this.dropPeer(peerId); return }
    if (oldBinding) {
      this.bindings.delete(oldBinding.peerId)
      const obsolete = this.pendingResumes.get(oldBinding.peerId)
      if (obsolete?.timeout) clearTimeout(obsolete.timeout)
      this.pendingResumes.delete(oldBinding.peerId)
      await this.native.closePeer(oldBinding.peerId).catch(() => undefined)
    }
    // Old connectionId is now unauthorized even if the old socket delivers late frames.
    this.bindings.set(peerId, { peerId, connectionId, playerId: frame.playerId,
      resumeToken: credential.pending! })
    const pending: PendingResume = { peerId, playerId: frame.playerId, connectionId, resumeId,
      deliveries: outcome.deliveries }
    pending.timeout = setTimeout(() => this.enqueue(async () => {
      if (this.pendingResumes.get(peerId) === pending) await this.dropPeer(peerId)
    }), this.admissionTimeoutMs)
    this.pendingResumes.set(peerId, pending)
    try { await this.native.sendV2(peerId, response) }
    catch { await this.dropPeer(peerId) }
  }

  private async resumeAck(peerId: string, frame: Extract<PersistentLanFrame, { kind: 'resumeAckV2' | 'resumeConfirmedV2' }>) {
    const pending = this.pendingResumes.get(peerId)
    const binding = this.bindings.get(peerId)
    const credential = pending && this.credentials.get(pending.playerId)
    if (!pending || !binding || !credential || !credential.pending
      || frame.roomId !== this.roomId || frame.playerId !== pending.playerId
      || frame.resumeId !== pending.resumeId
      || binding.connectionId !== pending.connectionId
      || this.coordinator.runtime.getConnectionId(binding.playerId) !== binding.connectionId) {
      await this.dropPeer(peerId); return
    }
    try { await this.native.revokeResumeToken(pending.playerId, credential.current) }
    catch { this.failClose(); return }
    credential.current = credential.pending
    credential.expiresAt = credential.pendingExpiresAt!
    credential.pending = undefined
    credential.pendingExpiresAt = undefined
    binding.resumeToken = credential.current
    if (pending.timeout) clearTimeout(pending.timeout)
    this.pendingResumes.delete(peerId)
    this.scheduleRekey(pending.playerId)
    try {
      await this.native.sendV2(peerId, { kind: 'resumeConfirmedV2', protocolVersion: 2,
        roomId: this.roomId, playerId: pending.playerId, resumeId: pending.resumeId })
      await this.deliver(pending.deliveries)
    } catch { await this.dropPeer(peerId) }
  }

  private async leave(peerId: string, frame: Extract<PersistentLanFrame, { kind: 'leaveRequestV2' }>) {
    const tombstone = this.leaveTombstones.get(peerId)
    if (tombstone && tombstone.playerId === frame.playerId && tombstone.commandId === frame.commandId
      && frame.roomId === this.roomId && Date.now() < tombstone.expiresAt) {
      await this.native.sendV2(peerId, { kind: 'leaveConfirmedV2', protocolVersion: 2,
        roomId: this.roomId, playerId: frame.playerId, commandId: frame.commandId,
        revision: tombstone.revision }).catch(() => undefined)
      return
    }
    const binding = this.bindings.get(peerId)
    if (!binding || this.pendingResumes.has(peerId) || frame.roomId !== this.roomId
      || frame.playerId !== binding.playerId
      || this.coordinator.runtime.getConnectionId(binding.playerId) !== binding.connectionId) {
      await this.dropPeer(peerId); return
    }
    this.leaving.add(binding.playerId)
    this.cancelRekey(binding.playerId)
    const credential = this.credentials.get(binding.playerId)
    if (!credential) { this.failClose(); return }
    const tokens = [credential.current, credential.pending].filter((token): token is string => Boolean(token))
    const revoked = await Promise.allSettled(tokens.map(token =>
      this.native.revokeResumeToken(binding.playerId, token)))
    if (revoked.some(result => result.status === 'rejected')) {
      await this.native.sendV2(peerId, { kind: 'leaveRejectedV2', protocolVersion: 2,
        roomId: this.roomId, playerId: binding.playerId,
        commandId: frame.commandId, error: 'revocation_failed' }).catch(() => undefined)
      return // Keep membership locked against commands/resume until a successful retry.
    }
    const result = await this.coordinator.leaveGuest(binding.playerId, binding.connectionId)
    if (!result.ok) { this.failClose(); return }
    this.credentials.delete(binding.playerId)
    this.leaving.delete(binding.playerId)
    this.bindings.delete(peerId)
    const pendingResume = this.pendingResumes.get(peerId)
    if (pendingResume?.timeout) clearTimeout(pendingResume.timeout)
    this.pendingResumes.delete(peerId)
    this.leaveTombstones.set(peerId, { playerId: binding.playerId, commandId: frame.commandId,
      revision: this.coordinator.runtime.getRevision(), expiresAt: Date.now() + 120_000 })
    await this.deliver(result.deliveries)
    await this.native.sendV2(peerId, { kind: 'leaveConfirmedV2', protocolVersion: 2,
      roomId: this.roomId, playerId: binding.playerId, commandId: frame.commandId,
      revision: this.coordinator.runtime.getRevision() }).catch(() => undefined)
    await this.native.closePeer(peerId).catch(() => undefined)
    this.peers.delete(peerId)
  }

  private failClose() { queueMicrotask(() => { void this.stop().catch(() => undefined) }) }

  private async compensate(pending: Pending, closePeer: boolean) {
    if (this.pending !== pending) return
    this.pending = null
    if (pending.timeout) clearTimeout(pending.timeout)
    try {
      await this.native.revokeResumeToken(pending.binding.playerId, pending.binding.resumeToken)
    } catch {
      // Unknown native revocation outcome: terminate the WSS server, not just the peer.
      await this.native.stop().catch(() => undefined)
      this.closed = true
      this.failClose() // Always finish listener, timer and credential cleanup.
    }
    const outcome = await this.coordinator.leaveGuest(pending.binding.playerId, pending.binding.connectionId)
    if (!outcome.ok) {
      await this.native.stop().catch(() => undefined)
      this.closed = true
      this.failClose()
    } else await this.deliver(outcome.deliveries)
    if (closePeer) await this.native.closePeer(pending.binding.peerId).catch(() => undefined)
  }

  private async dropPeer(peerId: string) {
    await this.native.closePeer(peerId).catch(() => undefined)
    await this.handle({ type: 'disconnected', peerId })
  }

  private async deliver(deliveries: readonly RoomDeliveryV2[]) {
    for (const delivery of deliveries) {
      const binding = [...this.bindings.values()].find(b =>
        b.playerId === delivery.playerId && b.connectionId === delivery.connectionId)
      if (binding) {
        await this.native.sendV2(binding.peerId, { kind: 'eventV2', protocolVersion: 2, event: delivery.event })
      }
    }
  }
}
