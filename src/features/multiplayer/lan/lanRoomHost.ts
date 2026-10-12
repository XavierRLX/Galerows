import type { Command, ConnectionId, PlayerId } from '../protocol'
import { PROTOCOL_VERSION } from '../protocol'
import type { AuthoritativeRoomRuntime, JoinResult, RuntimeDelivery } from '../runtime'
import { LanIngressHost } from './lanIngressHost'
import type { LanNativeHost } from './lanNativeHost'
import { encodeLanFrame, type LanFrame } from './lanWire'

type SecureHost = Pick<LanNativeHost, 'startSecure' | 'rotateInviteToken' | 'registerResumeToken' | 'revokeResumeToken' | 'closePeer' | 'send' | 'stop' | 'onEvent'>
type Runtime<S, C, P, V> = AuthoritativeRoomRuntime<S, C, P, V>
type Binding = { peerId: string; connectionId: ConnectionId; playerId: PlayerId }
type Pending<P, V> = { binding: Binding; joined: JoinResult<P, V>; disconnected: boolean; admissionId: string;
  resumeToken: string; resumeExpiresAt: number;
  confirmationTimer?: ReturnType<typeof setTimeout> }
const MAX_OUTBOUND_MESSAGES = 64
const MAX_INBOUND_MESSAGES = 64
const DEFAULT_ADMISSION_CONFIRMATION_TIMEOUT_MS = 15_000

/** WebView-side authority boundary between verified native peers and the shared runtime. */
export class LanRoomHost<S, C, P, V> {
  private readonly runtime: Runtime<S, C, P, V>
  private readonly native: SecureHost
  private readonly ingress: LanIngressHost
  private readonly bindings = new Map<string, Binding>()
  private readonly credentials = new Map<PlayerId, { current: string; expiresAt: number; pending?: string; pendingExpiresAt?: number }>()
  private readonly awaitingAck = new Map<string, PlayerId>()
  private readonly leaving = new Set<PlayerId>()
  private readonly failedRevocations = new Set<PlayerId>()
  private readonly disconnected = new Set<string>()
  private readonly queued: Array<{ peerId: string; frame: LanFrame; leaveBinding?: Binding }> = []
  private outboundTail: Promise<void> = Promise.resolve()
  private outboundQueued = 0
  private processing = false
  private admitting = false
  private readonly idleWaiters: Array<() => void> = []
  private readonly admissionWaiters: Array<() => void> = []
  private pending: Pending<P, V> | null = null
  private local: Binding | null = null
  private closed = false
  private started = false
  private roomId = ''
  private readonly admissionConfirmationTimeoutMs: number

  constructor(runtime: Runtime<S, C, P, V>, native: SecureHost, options: { admissionConfirmationTimeoutMs?: number } = {}) {
    this.runtime = runtime
    this.native = native
    this.admissionConfirmationTimeoutMs = options.admissionConfirmationTimeoutMs ?? DEFAULT_ADMISSION_CONFIRMATION_TIMEOUT_MS
    this.ingress = new LanIngressHost(native, peerId => this.prepare(peerId), {
      onAdmitted: peerId => this.finish(peerId, true),
      onAdmissionFailed: peerId => this.finish(peerId, false),
      onFrame: (peerId, frame) => this.onFrame(peerId, frame),
      onDisconnected: peerId => this.onDisconnected(peerId),
    })
  }

  get currentInvite() { return this.ingress.currentInvite }
  hostCode() { return this.ingress.hostCode() }

  refreshInvite(hostIp?: string) {
    if (this.closed || !this.started) return Promise.reject(new Error('room_closed'))
    return this.ingress.refreshInvite(hostIp)
  }

  localSnapshot() {
    if (!this.local || this.closed) return null
    const outcome = this.runtime.createResyncSnapshot({ protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId, playerId: this.local.playerId, lastAppliedRevision: 0 }, this.local.connectionId)
    return outcome.ok ? outcome.snapshot : null
  }

  localMembers() {
    const snapshot = this.localSnapshot()
    return snapshot?.roomState.playerIds.map(playerId => ({ playerId,
      connected: this.runtime.getConnectionId(playerId) !== null })) ?? []
  }

  async start(roomId: string, hostIp: string) {
    if (this.started || this.closed) throw new Error('room_closed')
    const invite = await this.ingress.start(roomId, hostIp)
    this.roomId = roomId
    this.started = true
    return invite
  }

  joinLocal(): JoinResult<P, V> {
    if (!this.started || this.closed || this.local) throw new Error('room_closed')
    if (this.pending || this.admitting) throw new Error('admission_pending')
    if (this.outboundQueued + this.bindings.size > MAX_OUTBOUND_MESSAGES) throw new Error('delivery_queue_full')
    const connectionId = this.newConnectionId()
    const joined = this.runtime.join(connectionId)
    if (!joined) throw new Error('join_failed')
    if (joined.snapshot.roomId !== this.roomId) {
      this.runtime.leave(joined.playerId)
      throw new Error('room_mismatch')
    }
    this.local = { peerId: '', connectionId, playerId: joined.playerId }
    void this.deliver(joined.deliveries)
    return joined
  }

  processLocalCommand(command: Command) {
    if (!this.local || this.closed) throw new Error('room_closed')
    if (this.pending || this.admitting) throw new Error('admission_pending')
    if (this.outboundQueued + this.bindings.size > MAX_OUTBOUND_MESSAGES) throw new Error('delivery_queue_full')
    const outcome = this.runtime.processCommand(command, this.local.connectionId)
    void this.deliver(outcome.deliveries)
    return outcome.result
  }

  async stop(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.queued.length = 0
    if (this.admitting) await new Promise<void>(resolve => this.admissionWaiters.push(resolve))
    if (this.processing) await new Promise<void>(resolve => this.idleWaiters.push(resolve))
    const terminalPeers = [...this.bindings.keys()]
    await this.outboundTail
    const terminal: LanFrame = { kind: 'roomClosed', protocolVersion: PROTOCOL_VERSION, roomId: this.roomId }
    await Promise.all(terminalPeers.map(peerId => this.native.send(peerId, terminal).catch(() => undefined)))
    if (this.pending) {
      await this.compensateAdmission(this.pending)
    }
    for (const binding of this.bindings.values()) this.runtime.leave(binding.playerId)
    for (const [playerId, credential] of this.credentials) {
      await this.native.revokeResumeToken(playerId, credential.current).catch(() => undefined)
      if (credential.pending) await this.native.revokeResumeToken(playerId, credential.pending).catch(() => undefined)
      this.runtime.leave(playerId)
    }
    this.credentials.clear()
    this.awaitingAck.clear()
    if (this.local) this.runtime.leave(this.local.playerId)
    this.bindings.clear()
    this.local = null
    await this.ingress.stop()
  }

  private async prepare(peerId: string) {
    if (this.closed || !this.started || this.disconnected.has(peerId) || this.bindings.has(peerId) || this.pending || this.admitting) {
      return { ok: false as const, error: 'room_closed' as const }
    }
    this.admitting = true
    try {
      if (this.processing) await new Promise<void>(resolve => this.idleWaiters.push(resolve))
      if (this.closed || this.disconnected.has(peerId)) return { ok: false as const, error: 'room_closed' as const }
      const connectionId = this.newConnectionId()
      const joined = this.runtime.join(connectionId)
      if (!joined) return { ok: false as const, error: 'coordinator_rejected' as const }
      if (joined.snapshot.roomId !== this.roomId) {
        const departure = this.runtime.leave(joined.playerId)
        await this.deliver(joined.deliveries)
        await this.deliver(departure)
        return { ok: false as const, error: 'coordinator_rejected' as const }
      }
      const binding = { peerId, connectionId, playerId: joined.playerId }
      const admissionId = this.newResumeToken()
      const resumeToken = this.newResumeToken()
      const resumeExpiresAt = Date.now() + 2 * 60 * 60 * 1000
      const admitted = { kind: 'admitted' as const, protocolVersion: PROTOCOL_VERSION,
        playerId: joined.playerId, snapshot: joined.snapshot, admissionId, resumeToken, resumeExpiresAt }
      try { encodeLanFrame(admitted) }
      catch {
        const departure = this.runtime.leave(joined.playerId)
        this.pending = null
        await this.deliver(joined.deliveries)
        await this.deliver(departure)
        return { ok: false as const, error: 'coordinator_rejected' as const }
      }
      try { await this.native.registerResumeToken(joined.playerId, resumeToken, resumeExpiresAt) }
      catch {
        const departure = this.runtime.leave(joined.playerId)
        await this.deliver(joined.deliveries)
        await this.deliver(departure)
        return { ok: false as const, error: 'coordinator_rejected' as const }
      }
      if (this.closed || this.disconnected.has(peerId)) {
        await this.native.revokeResumeToken(joined.playerId, resumeToken)
        const departure = this.runtime.leave(joined.playerId)
        await this.deliver(joined.deliveries)
        await this.deliver(departure)
        return { ok: false as const, error: 'room_closed' as const }
      }
      this.pending = { binding, joined, disconnected: false, admissionId, resumeToken, resumeExpiresAt }
      return { playerId: joined.playerId, snapshot: joined.snapshot, admissionId, resumeToken, resumeExpiresAt }
    } finally {
      this.admitting = false
      for (const resolve of this.admissionWaiters.splice(0)) resolve()
      void this.drain()
    }
  }

  private async finish(peerId: string, sent: boolean) {
    const pending = this.pending
    if (!pending || pending.binding.peerId !== peerId) return
    if (sent && !pending.disconnected && !this.closed) {
      pending.confirmationTimer = setTimeout(() => {
        void this.compensateAdmission(pending, true)
      }, this.admissionConfirmationTimeoutMs)
      return
    } else {
      await this.compensateAdmission(pending)
    }
  }

  private onDisconnected(peerId: string) {
    this.disconnected.add(peerId)
    this.awaitingAck.delete(peerId)
    if (this.pending?.binding.peerId === peerId) {
      this.pending.disconnected = true
      void this.compensateAdmission(this.pending)
    }
    const binding = this.bindings.get(peerId)
    if (binding) {
      this.bindings.delete(peerId)
      this.runtime.disconnect(binding.connectionId)
      if (this.failedRevocations.has(binding.playerId)) this.failClose()
    }
  }

  private async onFrame(peerId: string, frame: LanFrame) {
    if (this.closed) return
    if (frame.kind === 'resumeHello') {
      try { await this.resume(peerId, frame) }
      catch { await this.native.closePeer(peerId).catch(() => undefined) }
      return
    }
    if (frame.kind === 'admissionAck') {
      await this.confirmAdmission(peerId, frame)
      return
    }
    const binding = this.bindings.get(peerId)
    if (!binding) return
    if (this.queued.length >= MAX_INBOUND_MESSAGES) { this.onDisconnected(peerId); return }
    if (frame.kind === 'leaveRequest' && frame.roomId === this.roomId
      && frame.playerId === binding.playerId && binding.playerId !== this.local?.playerId
      && this.runtime.getConnectionId(binding.playerId) === binding.connectionId) {
      if (this.queued.some(item => item.leaveBinding?.playerId === binding.playerId)) return
      this.leaving.add(binding.playerId)
      this.queued.push({ peerId, frame, leaveBinding: binding })
    } else this.queued.push({ peerId, frame })
    await this.drain()
  }

  private async confirmAdmission(peerId: string, frame: Extract<LanFrame, { kind: 'admissionAck' }>): Promise<void> {
    const pending = this.pending
    if (!pending || pending.binding.peerId !== peerId || pending.disconnected || this.closed
      || frame.roomId !== this.roomId || frame.playerId !== pending.binding.playerId) return
    if (frame.admissionId !== pending.admissionId) return
    if (pending.confirmationTimer) clearTimeout(pending.confirmationTimer)
    this.pending = null
    this.bindings.set(peerId, pending.binding)
    this.credentials.set(pending.binding.playerId, { current: pending.resumeToken, expiresAt: pending.resumeExpiresAt })
    await this.send(peerId, { kind: 'admissionConfirmed', protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId, playerId: pending.binding.playerId, admissionId: pending.admissionId })
    await this.deliver(pending.joined.deliveries)
    await this.drain()
  }

  private async compensateAdmission(pending: Pending<P, V>, closePeer = false): Promise<void> {
    if (this.pending !== pending) return
    if (pending.confirmationTimer) clearTimeout(pending.confirmationTimer)
    this.pending = null
    await this.native.revokeResumeToken(pending.binding.playerId, pending.resumeToken)
    const departure = this.runtime.leave(pending.binding.playerId)
    await this.deliver(pending.joined.deliveries)
    await this.deliver(departure)
    if (closePeer) await this.native.closePeer(pending.binding.peerId).catch(() => undefined)
    await this.drain()
  }

  private async resume(peerId: string, frame: Extract<LanFrame, { kind: 'resumeHello' }>): Promise<void> {
    if (this.disconnected.has(peerId) || this.bindings.has(peerId) || this.admitting || this.pending) return
    if (frame.roomId !== this.roomId) return
    const credential = this.credentials.get(frame.playerId)
    if (!credential || this.leaving.has(frame.playerId) || !this.runtime.hasMembership(frame.playerId)) return
    const now = Date.now()
    const current = frame.resumeToken === credential.current && now < credential.expiresAt
    const pending = frame.resumeToken === credential.pending && now < (credential.pendingExpiresAt ?? 0)
    if (!current && !pending) return
    this.admitting = true
    try {
      if (this.processing) await new Promise<void>(resolve => this.idleWaiters.push(resolve))
      if (this.closed || this.disconnected.has(peerId) || this.leaving.has(frame.playerId)) return
      // A valid pending token proves that the previous rotation response was received.
      if (pending) {
        await this.native.revokeResumeToken(frame.playerId, credential.current)
        credential.current = credential.pending!
        credential.expiresAt = credential.pendingExpiresAt!
        credential.pending = undefined
        credential.pendingExpiresAt = undefined
      }
      if (!credential.pending) {
        const next = this.newResumeToken()
        const expiresAt = Date.now() + 2 * 60 * 60 * 1000
        await this.native.registerResumeToken(frame.playerId, next, expiresAt)
        credential.pending = next
        credential.pendingExpiresAt = expiresAt
      }
      if (this.closed || this.disconnected.has(peerId)) return
      const oldConnection = this.runtime.getConnectionId(frame.playerId)
      const connectionId = this.newConnectionId()
      if (!this.runtime.reassociate(frame.playerId, connectionId)) return
      const outcome = this.runtime.createResyncSnapshot({ protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId, playerId: frame.playerId, lastAppliedRevision: 0 }, connectionId)
      if (!outcome.ok) {
        if (oldConnection) this.runtime.reassociate(frame.playerId, oldConnection)
        else this.runtime.disconnect(connectionId)
        return
      }
      const response: LanFrame = { kind: 'resumed', protocolVersion: PROTOCOL_VERSION,
        playerId: frame.playerId, snapshot: outcome.snapshot,
        resumeToken: credential.pending, resumeExpiresAt: credential.pendingExpiresAt! }
      try { encodeLanFrame(response) }
      catch {
        if (oldConnection) this.runtime.reassociate(frame.playerId, oldConnection)
        else this.runtime.disconnect(connectionId)
        return
      }
      const oldBinding = [...this.bindings.values()].find(binding => binding.playerId === frame.playerId)
      if (oldBinding) {
        this.bindings.delete(oldBinding.peerId)
        void this.native.closePeer(oldBinding.peerId).catch(() => undefined)
      }
      this.bindings.set(peerId, { peerId, playerId: frame.playerId, connectionId })
      await this.send(peerId, response)
      if (this.bindings.has(peerId)) this.awaitingAck.set(peerId, frame.playerId)
    } finally {
      this.admitting = false
      for (const resolve of this.admissionWaiters.splice(0)) resolve()
      void this.drain()
    }
  }

  private async drain() {
    if (this.processing) return
    this.processing = true
    try {
      while (!this.pending && !this.admitting && !this.closed && this.queued.length) {
        const item = this.queued.shift()!
        if (item.leaveBinding && item.frame.kind === 'leaveRequest') await this.leaveGuest(item.leaveBinding, item.frame)
        else if (this.bindings.has(item.peerId)) await this.process(item.peerId, item.frame)
      }
    } finally {
      this.processing = false
      for (const resolve of this.idleWaiters.splice(0)) resolve()
    }
  }

  private async process(peerId: string, frame: LanFrame) {
    const binding = this.bindings.get(peerId)
    if (!binding || this.runtime.getConnectionId(binding.playerId) !== binding.connectionId) return
    if (frame.kind === 'leaveRequest') {
      await this.leaveGuest(binding, frame)
    } else if (this.leaving.has(binding.playerId)) {
      return
    } else if (frame.kind === 'resumeAck') {
      if (frame.roomId !== this.roomId || frame.playerId !== binding.playerId
        || this.awaitingAck.get(peerId) !== binding.playerId) return
      const credential = this.credentials.get(binding.playerId)
      if (!credential?.pending) return
      await this.native.revokeResumeToken(binding.playerId, credential.current)
      credential.current = credential.pending
      credential.expiresAt = credential.pendingExpiresAt!
      credential.pending = undefined
      credential.pendingExpiresAt = undefined
      this.awaitingAck.delete(peerId)
    } else if (frame.kind === 'command') {
      const outcome = this.runtime.processCommand(frame.command, binding.connectionId)
      await this.send(peerId, { kind: 'commandResult', result: outcome.result })
      await this.deliver(outcome.deliveries)
    } else if (frame.kind === 'resync') {
      const outcome = this.runtime.createResyncSnapshot(frame.request, binding.connectionId)
      if (outcome.ok) await this.send(peerId, { kind: 'snapshot', snapshot: outcome.snapshot })
    }
  }

  private async leaveGuest(binding: Binding, frame: Extract<LanFrame, { kind: 'leaveRequest' }>) {
    if (frame.roomId !== this.roomId || frame.playerId !== binding.playerId
      || binding.playerId === this.local?.playerId || this.closed) return
    this.leaving.add(binding.playerId)
    const credential = this.credentials.get(binding.playerId)
    if (!credential) return
    const tokens = [credential.current, credential.pending].filter((token): token is string => Boolean(token))
    const revoked = await Promise.allSettled(tokens.map(token => this.native.revokeResumeToken(binding.playerId, token)))
    if (revoked.some(result => result.status === 'rejected')) {
      this.failedRevocations.add(binding.playerId)
      await this.send(binding.peerId, { kind: 'leaveRejected', protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId, playerId: binding.playerId, commandId: frame.commandId, error: 'revocation_failed' })
      if (!this.bindings.has(binding.peerId)) this.failClose()
      return
    }
    this.failedRevocations.delete(binding.playerId)
    this.credentials.delete(binding.playerId)
    this.awaitingAck.delete(binding.peerId)
    const deliveries = this.runtime.leave(binding.playerId)
    await this.deliver(deliveries)
    try {
      const confirmation: LanFrame = { kind: 'leaveConfirmed', protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId, playerId: binding.playerId, commandId: frame.commandId,
        revision: this.runtime.getRevision() }
      encodeLanFrame(confirmation)
      await this.native.send(binding.peerId, confirmation)
    } catch { /* The committed leave cannot be rolled back if its ACK is lost. */ }
    this.bindings.delete(binding.peerId)
    this.leaving.delete(binding.playerId)
    await this.native.closePeer(binding.peerId).catch(() => undefined)
  }

  private failClose() {
    queueMicrotask(() => { void this.stop().catch(() => undefined) })
  }

  private async deliver(deliveries: readonly RuntimeDelivery<P, V>[]) {
    const sends: Promise<void>[] = []
    for (const delivery of deliveries) {
      const binding = [...this.bindings.values()].find(item => item.playerId === delivery.playerId
        && item.connectionId === delivery.connectionId)
      if (binding) sends.push(this.send(binding.peerId, { kind: 'event', event: delivery.event }))
    }
    await Promise.all(sends)
  }

  private send(peerId: string, frame: LanFrame): Promise<void> {
    if (this.outboundQueued >= MAX_OUTBOUND_MESSAGES) {
      this.onDisconnected(peerId)
      return Promise.resolve()
    }
    this.outboundQueued++
    const write = this.outboundTail.then(async () => {
      if (this.closed || !this.bindings.has(peerId)) return
      try {
        encodeLanFrame(frame)
        await this.native.send(peerId, frame)
      } catch {
        this.onDisconnected(peerId)
      }
    })
    this.outboundTail = write.finally(() => { this.outboundQueued-- })
    return write
  }

  private newConnectionId(): ConnectionId { return `lan-${crypto.randomUUID()}` }
  private newResumeToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  }
}
