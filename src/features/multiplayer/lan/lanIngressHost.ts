import { LanAdmissionGate } from './lanAdmission'
import type { CoordinatorDecision } from './lanAdmission'
import { createLanInvite, hostVerificationCode, newLanCapability } from './lanInvite'
import type { LanInvite } from './lanInvite'
import type { LanNativeHost } from './lanNativeHost'
import type { LanFrame } from './lanWire'

type HostEvent = { type: string; peerId: string; frame?: LanFrame }
type SecureHost = Pick<LanNativeHost, 'startSecure' | 'rotateInviteToken' | 'send' | 'stop' | 'onEvent'>
export interface LanIngressLifecycle {
  onAdmitted?(peerId: string): void | Promise<void>
  onAdmissionFailed?(peerId: string): void | Promise<void>
  onFrame?(peerId: string, frame: LanFrame): void | Promise<void>
  onDisconnected?(peerId: string): void | Promise<void>
}

/** Secure socket ingress shell; the Task 3 coordinator owns actual runtime membership. */
export class LanIngressHost {
  currentInvite: LanInvite | null = null
  private readonly native: SecureHost
  private readonly coordinator: (peerId: string) => Promise<CoordinatorDecision>
  private readonly lifecycle: LanIngressLifecycle
  private listener: { remove: () => Promise<void> } | null = null
  private gate: LanAdmissionGate | null = null
  private roomId = ''
  private hostIp = ''
  private port = 0
  private fingerprint = ''

  constructor(native: SecureHost, coordinator: (peerId: string) => Promise<CoordinatorDecision>, lifecycle: LanIngressLifecycle = {}) {
    this.native = native
    this.coordinator = coordinator
    this.lifecycle = lifecycle
  }

  async start(roomId: string, hostIp: string): Promise<LanInvite> {
    if (this.gate) throw new Error('already_running')
    const capability = newLanCapability()
    this.listener = await this.native.onEvent(event => {
      void this.onEvent(event).catch(() => { void this.stop() })
    })
    try {
      const result = await this.native.startSecure(roomId, capability)
      this.roomId = roomId
      this.hostIp = hostIp
      this.port = result.port
      this.fingerprint = result.fingerprint
      const invite = this.issue(capability)
      this.gate = new LanAdmissionGate(invite)
      this.currentInvite = invite
      return invite
    } catch (error) {
      try { await this.native.stop() } catch { /* Preserve the original startup error. */ }
      await this.listener?.remove()
      this.listener = null
      this.currentInvite = null
      this.gate = null
      throw error
    }
  }

  hostCode(): string {
    if (!this.fingerprint) throw new Error('not_running')
    return hostVerificationCode(this.fingerprint)
  }

  async stop(): Promise<void> {
    await this.native.stop()
    await this.listener?.remove()
    this.listener = null
    this.gate = null
    this.currentInvite = null
  }

  async refreshInvite(hostIp = this.hostIp): Promise<LanInvite> {
    if (!this.gate) throw new Error('not_running')
    const next = newLanCapability()
    const invite = createLanInvite({ roomId: this.roomId, hostIp, port: this.port,
      fingerprint: this.fingerprint, capability: next })
    await this.native.rotateInviteToken(next)
    this.hostIp = hostIp
    this.gate = new LanAdmissionGate(invite)
    this.currentInvite = invite
    return invite
  }

  private issue(capability: string): LanInvite {
    return createLanInvite({ roomId: this.roomId, hostIp: this.hostIp, port: this.port,
      fingerprint: this.fingerprint, capability })
  }

  private async onEvent(event: HostEvent): Promise<void> {
    if (event.type === 'disconnected') { await this.lifecycle.onDisconnected?.(event.peerId); return }
    if (event.type !== 'message' || !event.frame) return
    if (event.frame.kind !== 'joinRequest') { await this.lifecycle.onFrame?.(event.peerId, event.frame); return }
    if (!this.gate) return
    const gate = this.gate
    const reply = await gate.request(event.peerId, event.frame, Date.now(), this.coordinator)
    try {
      await this.native.send(event.peerId, reply)
      if (reply.kind === 'admitted') await this.lifecycle.onAdmitted?.(event.peerId)
    } catch {
      if (reply.kind === 'admitted') await this.lifecycle.onAdmissionFailed?.(event.peerId)
    }
    if (gate.reservedBy === event.peerId && this.gate === gate) await this.refreshInvite()
  }
}
