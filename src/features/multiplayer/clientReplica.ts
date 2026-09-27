import { PROTOCOL_VERSION } from './protocol'
import type {
  CommandId,
  CommandResult,
  Event,
  RoomId,
  RoomPublicState,
  Snapshot,
} from './protocol'

export type EventApplication =
  | 'applied'
  | 'duplicate'
  | 'stale'
  | 'gap'
  | 'awaiting_resync'
  | 'wrong_room'
  | 'incompatible_protocol'

export type SnapshotApplication =
  | 'applied'
  | 'stale'
  | 'wrong_room'
  | 'incompatible_protocol'

export class ClientReplica<TGamePublic, TPrivate> {
  private readonly roomId: RoomId
  private roomState: RoomPublicState
  private gamePublicState: TGamePublic
  private privateState: TPrivate | null
  private lastAppliedRevision: number
  private needsResync = false
  private readonly commandResults = new Map<CommandId, CommandResult>()

  constructor(roomId: RoomId, initial: Snapshot<TGamePublic, TPrivate>) {
    if (initial.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error('Cannot initialize replica from an incompatible protocol Snapshot.')
    }
    if (initial.roomId !== roomId) {
      throw new Error('Cannot initialize replica from a Snapshot for another room.')
    }

    this.roomId = roomId
    this.roomState = initial.roomState
    this.gamePublicState = initial.gamePublicState
    this.privateState = initial.privateState
    this.lastAppliedRevision = initial.revision
  }

  getState() {
    return {
      roomState: this.roomState,
      gamePublicState: this.gamePublicState,
      privateState: this.privateState,
      lastAppliedRevision: this.lastAppliedRevision,
      needsResync: this.needsResync,
    }
  }

  observeCommandResult(result: CommandResult): boolean {
    if (result.protocolVersion !== PROTOCOL_VERSION || result.roomId !== this.roomId) return false
    if (result.commandId) this.commandResults.set(result.commandId, result)
    return true
  }

  getCommandResult(commandId: CommandId) {
    return this.commandResults.get(commandId)
  }

  applyEvent(event: Event<TGamePublic, TPrivate>): EventApplication {
    if (event.protocolVersion !== PROTOCOL_VERSION) return 'incompatible_protocol'
    if (event.roomId !== this.roomId) return 'wrong_room'
    if (this.needsResync) return 'awaiting_resync'

    if (event.revision === this.lastAppliedRevision) return 'duplicate'
    if (event.revision < this.lastAppliedRevision) return 'stale'
    if (event.revision > this.lastAppliedRevision + 1) {
      this.needsResync = true
      return 'gap'
    }

    if (event.kind === 'projection') {
      this.roomState = event.roomState
      this.gamePublicState = event.gamePublicState
      this.privateState = event.privateState
    }
    this.lastAppliedRevision = event.revision
    return 'applied'
  }

  applySnapshot(snapshot: Snapshot<TGamePublic, TPrivate>): SnapshotApplication {
    if (snapshot.protocolVersion !== PROTOCOL_VERSION) return 'incompatible_protocol'
    if (snapshot.roomId !== this.roomId) return 'wrong_room'
    if (snapshot.revision < this.lastAppliedRevision) return 'stale'

    this.roomState = snapshot.roomState
    this.gamePublicState = snapshot.gamePublicState
    this.privateState = snapshot.privateState
    this.lastAppliedRevision = snapshot.revision
    this.needsResync = false
    return 'applied'
  }
}
