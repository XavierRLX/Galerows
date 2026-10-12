import type { AuthoritativeMessage, Command, ResyncRequest } from '../protocol'
import { PROTOCOL_VERSION } from '../protocol'
import type { RoomTransport } from '../roomTransport'
import type { AdmittedEvent, LanIngressClient } from './lanIngressClient'
import type { LanFrame } from './lanWire'

const MAX_BUFFERED_MESSAGES = 64
type Ingress = Pick<LanIngressClient, 'subscribeAdmitted' | 'sendFrame' | 'disconnect'>
export type LanClosureReason = 'room_closed' | 'connection_lost'

/** Transport over an already admitted, TLS-pinned native LAN connection. */
export class LanRoomTransport<TPublic = unknown, TPrivate = unknown>
implements RoomTransport<TPublic, TPrivate> {
  private readonly ingress: Ingress
  private readonly roomId: string
  private readonly playerId: string
  private readonly listeners = new Set<(message: AuthoritativeMessage<TPublic, TPrivate>) => void>()
  private readonly buffered: AuthoritativeMessage<TPublic, TPrivate>[] = []
  private unsubscribeIngress: (() => void) | null = null
  private connected = false
  private closed = false
  private disconnecting: Promise<void> | null = null
  private readonly onClose?: (reason: LanClosureReason) => void
  private closureReason: LanClosureReason | null = null
  private pendingLeave: { commandId: string; resolve: () => void; reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout> } | null = null

  constructor(ingress: Ingress, roomId: string, playerId: string, onClose?: (reason: LanClosureReason) => void) {
    this.ingress = ingress
    this.roomId = roomId
    this.playerId = playerId
    this.onClose = onClose
    this.unsubscribeIngress = ingress.subscribeAdmitted(event => this.onAdmitted(event))
    if (this.closed) this.unsubscribeIngress()
  }

  connect(): void {
    if (this.closed) throw new Error('lan_disconnected')
    this.connected = true
    this.flush()
  }

  disconnect(): Promise<void> {
    if (this.disconnecting) return this.disconnecting
    this.closed = true
    this.finishLeave(new Error('leave_unconfirmed'))
    this.connected = false
    this.buffered.length = 0
    this.listeners.clear()
    this.unsubscribeIngress?.()
    this.disconnecting = this.ingress.disconnect()
    return this.disconnecting
  }

  async sendCommand(command: Command): Promise<void> {
    this.assertConnected()
    this.validate(command)
    await this.ingress.sendFrame({ kind: 'command', command })
  }

  async sendResyncRequest(request: ResyncRequest): Promise<void> {
    this.assertConnected()
    this.validate(request)
    await this.ingress.sendFrame({ kind: 'resync', request })
  }

  requestLeave(commandId: string, timeoutMs = 5_000): Promise<void> {
    this.assertConnected()
    if (!commandId.trim() || this.pendingLeave) return Promise.reject(new Error('leave_pending'))
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.finishLeave(new Error('leave_unconfirmed')), timeoutMs)
      this.pendingLeave = { commandId, resolve, reject, timer }
      void this.ingress.sendFrame({ kind: 'leaveRequest', protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId, playerId: this.playerId, commandId })
        .catch(() => this.finishLeave(new Error('leave_unconfirmed')))
    })
  }

  subscribe(listener: (message: AuthoritativeMessage<TPublic, TPrivate>) => void): () => void {
    if (this.closed) return () => undefined
    this.listeners.add(listener)
    this.flush()
    return () => this.listeners.delete(listener)
  }

  private onAdmitted(event: AdmittedEvent): void {
    if (this.closed) return
    if (event.type === 'closed') {
      this.finishLeave(new Error('leave_unconfirmed'))
      this.markClosed('connection_lost')
      void this.disconnect().catch(() => undefined)
      return
    }
    if (event.frame.kind === 'roomClosed') {
      if (event.frame.protocolVersion !== PROTOCOL_VERSION || event.frame.roomId !== this.roomId) return
      this.markClosed('room_closed')
      void this.disconnect().catch(() => undefined)
      return
    }
    if (event.frame.kind === 'leaveConfirmed' || event.frame.kind === 'leaveRejected') {
      if (event.frame.protocolVersion !== PROTOCOL_VERSION || event.frame.roomId !== this.roomId
        || event.frame.playerId !== this.playerId || event.frame.commandId !== this.pendingLeave?.commandId) return
      this.finishLeave(event.frame.kind === 'leaveRejected' ? new Error(event.frame.error) : undefined)
      return
    }
    const message = authoritativeMessage<TPublic, TPrivate>(event.frame)
    if (!message) return
    if (message.protocolVersion !== PROTOCOL_VERSION || message.roomId !== this.roomId) return
    if (!this.connected || this.listeners.size === 0) {
      if (this.buffered.length >= MAX_BUFFERED_MESSAGES) {
        void this.disconnect().catch(() => undefined)
        return
      }
      this.buffered.push(message)
      return
    }
    for (const listener of this.listeners) listener(message)
  }

  private finishLeave(error?: Error): void {
    const pending = this.pendingLeave
    if (!pending) return
    this.pendingLeave = null
    clearTimeout(pending.timer)
    if (error) pending.reject(error)
    else pending.resolve()
  }

  private markClosed(reason: LanClosureReason): void {
    if (this.closureReason) return
    this.closureReason = reason
    this.onClose?.(reason)
  }

  private flush(): void {
    if (!this.connected || !this.listeners.size) return
    for (const message of this.buffered.splice(0)) {
      for (const listener of this.listeners) listener(message)
    }
  }

  private assertConnected(): void {
    if (!this.connected || this.closed) throw new Error('lan_disconnected')
  }

  private validate(value: Command | ResyncRequest): void {
    if (value.protocolVersion !== PROTOCOL_VERSION) throw new Error('incompatible_protocol')
    if (value.roomId !== this.roomId) throw new Error('wrong_room')
    if (value.playerId !== this.playerId) throw new Error('unauthorized')
  }
}

function authoritativeMessage<TPublic, TPrivate>(frame: LanFrame): AuthoritativeMessage<TPublic, TPrivate> | null {
  if (frame.kind === 'commandResult') return frame.result
  if (frame.kind === 'event') return frame.event as AuthoritativeMessage<TPublic, TPrivate>
  if (frame.kind === 'snapshot') return frame.snapshot as AuthoritativeMessage<TPublic, TPrivate>
  return null
}
