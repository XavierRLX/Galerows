import { ClientReplica } from '../clientReplica'
import type { AuthoritativeMessage, Snapshot } from '../protocol'
import { PROTOCOL_VERSION } from '../protocol'
import { LanIngressClient } from './lanIngressClient'
import type { LanInvite } from './lanInvite'
import { LanRoomTransport, type LanClosureReason } from './lanRoomTransport'
import { LanSecureNativeClient } from './lanSecureNativeClient'

type NativeClient = Pick<LanSecureNativeClient, 'connect' | 'connectResume' | 'storeResumeCredential'
  | 'rotateResumeCredential' | 'clearResumeCredential' | 'send' | 'disconnect' | 'onEvent'>

export interface LanRoomBootstrap<TPublic, TPrivate> {
  playerId: string
  snapshot: Snapshot<TPublic, TPrivate>
  transport: LanRoomTransport<TPublic, TPrivate>
  replica: ClientReplica<TPublic, TPrivate>
}

export type LanJoinPhase = 'connecting' | 'verifying_host' | 'joining' | 'confirming_credential' | 'in_room'

/** Guest bootstrap; membership begins only after pinned WSS, human code and admitted. */
export class LanRoomSession<TPublic = unknown, TPrivate = unknown> {
  private readonly native: NativeClient
  private started = false
  private transport: LanRoomTransport<TPublic, TPrivate> | null = null
  private ingress: LanIngressClient | null = null
  private membership: { roomId: string; playerId: string } | null = null
  lastClosureReason: LanClosureReason | null = null

  constructor(native: NativeClient = new LanSecureNativeClient()) { this.native = native }

  async connectInvite(
    invite: LanInvite,
    enterHostCode: () => string | Promise<string>,
    onPhase?: (phase: LanJoinPhase) => void,
  ): Promise<LanRoomBootstrap<TPublic, TPrivate>> {
    if (this.started) throw new Error('already_connecting')
    this.started = true
    const ingress = new LanIngressClient(this.native)
    this.ingress = ingress
    try {
      onPhase?.('connecting')
      await ingress.connect(invite)
      onPhase?.('verifying_host')
      const entered = await enterHostCode()
      if (!ingress.confirmHostCode(entered)) throw new Error('host_identity_mismatch')
      onPhase?.('joining')
      const admission = await ingress.requestAdmission()
      if (admission.snapshot.protocolVersion !== PROTOCOL_VERSION
        || admission.snapshot.roomId !== invite.roomId
        || !admission.snapshot.roomState.playerIds.includes(admission.playerId)
        || !validCredential(admission.admissionId, admission.resumeExpiresAt)
        || !validCredential(admission.resumeToken, admission.resumeExpiresAt)) {
        throw new Error('invalid_admission')
      }
      await this.native.storeResumeCredential({ roomId: invite.roomId, playerId: admission.playerId,
        resumeToken: admission.resumeToken!, expiresAt: admission.resumeExpiresAt!,
        host: invite.hostIp, port: invite.port, fingerprint: invite.fingerprint })
      onPhase?.('confirming_credential')
      await ingress.confirmAdmission(invite.roomId, admission.playerId, admission.admissionId!)
      const snapshot = admission.snapshot as Snapshot<TPublic, TPrivate>
      const bootstrap = this.bootstrap(ingress, invite.roomId, admission.playerId, snapshot,
        new ClientReplica<TPublic, TPrivate>(invite.roomId, snapshot))
      onPhase?.('in_room')
      return bootstrap
    } catch (error) {
      await ingress.disconnect()
      throw error
    }
  }

  async resume(roomId: string, expectedPlayerId?: string, replica?: ClientReplica<TPublic, TPrivate>): Promise<LanRoomBootstrap<TPublic, TPrivate>> {
    if (this.started) throw new Error('already_connecting')
    this.started = true
    const ingress = new LanIngressClient(this.native)
    this.ingress = ingress
    try {
      const resumed = await ingress.resume(roomId)
      const playerId = expectedPlayerId ?? resumed.playerId
      if (resumed.playerId !== playerId || resumed.snapshot.protocolVersion !== PROTOCOL_VERSION
        || resumed.snapshot.roomId !== roomId
        || !resumed.snapshot.roomState.playerIds.includes(playerId)
        || (replica && resumed.snapshot.revision < replica.getState().lastAppliedRevision)
        || !validCredential(resumed.resumeToken, resumed.resumeExpiresAt)) throw new Error('invalid_resume')
      const snapshot = resumed.snapshot as Snapshot<TPublic, TPrivate>
      const activeReplica = replica ?? new ClientReplica<TPublic, TPrivate>(roomId, snapshot)
      if (replica && replica.applySnapshot(snapshot) !== 'applied') throw new Error('invalid_resume')
      await this.native.rotateResumeCredential(roomId, playerId, resumed.resumeToken!, resumed.resumeExpiresAt!)
      await ingress.sendFrame({ kind: 'resumeAck', protocolVersion: PROTOCOL_VERSION, roomId, playerId })
      return this.bootstrap(ingress, roomId, playerId, snapshot, activeReplica)
    } catch (error) {
      await ingress.disconnect()
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) await this.transport.disconnect()
    else await this.ingress?.disconnect()
    this.transport = null
    this.ingress = null
  }

  async leaveRoom(commandId: string = crypto.randomUUID(), timeoutMs?: number): Promise<void> {
    const membership = this.membership
    const transport = this.transport
    if (!membership || !transport) throw new Error('lan_disconnected')
    await transport.requestLeave(commandId, timeoutMs)
    await this.native.clearResumeCredential(membership.roomId)
    await this.disconnect().catch(() => undefined)
    this.membership = null
  }

  private bootstrap(
    ingress: LanIngressClient, roomId: string, playerId: string,
    snapshot: Snapshot<TPublic, TPrivate>, replica: ClientReplica<TPublic, TPrivate>,
  ): LanRoomBootstrap<TPublic, TPrivate> {
    const transport = new LanRoomTransport<TPublic, TPrivate>(ingress, roomId, playerId, reason => {
      this.lastClosureReason = reason
      if (reason === 'room_closed') void this.native.clearResumeCredential(roomId).catch(() => undefined)
    })
    transport.subscribe(message => this.applyMessage(message, replica, transport, roomId, playerId))
    transport.connect()
    this.transport = transport
    this.membership = { roomId, playerId }
    return { playerId, snapshot, transport, replica }
  }

  private applyMessage(
    message: AuthoritativeMessage<TPublic, TPrivate>,
    replica: ClientReplica<TPublic, TPrivate>,
    transport: LanRoomTransport<TPublic, TPrivate>,
    roomId: string,
    playerId: string,
  ): void {
    if ('status' in message) {
      replica.observeCommandResult(message)
      return
    }
    if ('kind' in message) {
      const application = replica.applyEvent(message)
      if (application === 'gap') {
        void transport.sendResyncRequest({ protocolVersion: PROTOCOL_VERSION, roomId, playerId,
          lastAppliedRevision: replica.getState().lastAppliedRevision }).catch(() => undefined)
      }
      return
    }
    replica.applySnapshot(message)
  }
}

function validCredential(token: unknown, expiresAt: unknown): boolean {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)
    && typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt) && expiresAt > Date.now()
}
