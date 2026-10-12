import { PERSISTENT_ROOM_PROTOCOL_VERSION } from './persistentProtocol'
import type { RoomEventV2, RoomSnapshotV2 } from './persistentProtocol'

/** PL-02A replica. A gap hides private data until an authorized snapshot replaces it. */
export class ClientReplicaV2 {
  private readonly roomId: string
  private snapshot: RoomSnapshotV2
  private needsResync = false

  constructor(roomId: string, initial: RoomSnapshotV2) {
    if (initial.protocolVersion !== PERSISTENT_ROOM_PROTOCOL_VERSION || initial.roomId !== roomId) {
      throw new Error('invalid_initial_snapshot')
    }
    this.roomId = roomId
    this.snapshot = structuredClone(initial)
  }

  getState() {
    return { ...structuredClone(this.snapshot), needsResync: this.needsResync,
      lastAppliedRevision: this.snapshot.revision }
  }

  applyEvent(event: RoomEventV2): 'applied' | 'duplicate' | 'stale' | 'gap' | 'awaiting_resync' | 'wrong_room' | 'incompatible_protocol' {
    if (event.protocolVersion !== PERSISTENT_ROOM_PROTOCOL_VERSION) return 'incompatible_protocol'
    if (event.roomId !== this.roomId) return 'wrong_room'
    if (this.needsResync) return 'awaiting_resync'
    if (event.revision === this.snapshot.revision) return 'duplicate'
    if (event.revision < this.snapshot.revision) return 'stale'
    if (event.revision > this.snapshot.revision + 1) {
      this.needsResync = true
      this.snapshot = { ...this.snapshot, gamePublicState: null, privateState: null }
      return 'gap'
    }
    if (event.kind === 'projection') {
      const { kind: _kind, ...snapshot } = event
      void _kind
      this.snapshot = structuredClone(snapshot)
    } else this.snapshot = { ...this.snapshot, revision: event.revision }
    return 'applied'
  }

  applySnapshot(snapshot: RoomSnapshotV2): 'applied' | 'stale' | 'wrong_room' | 'incompatible_protocol' {
    if (snapshot.protocolVersion !== PERSISTENT_ROOM_PROTOCOL_VERSION) return 'incompatible_protocol'
    if (snapshot.roomId !== this.roomId) return 'wrong_room'
    if (snapshot.revision < this.snapshot.revision) return 'stale'
    this.snapshot = structuredClone(snapshot)
    this.needsResync = false
    return 'applied'
  }
}
