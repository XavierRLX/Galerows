import { describe, expect, it } from 'vitest'
import { ClientReplica } from './clientReplica'
import { PROTOCOL_VERSION } from './protocol'
import type {
  CommandResult,
  Event,
  RoomPublicState,
  Snapshot,
} from './protocol'

interface PublicState {
  count: number
}

interface PrivateState {
  secret: number
}

describe('ClientReplica', () => {
  it('keeps lastAppliedRevision unchanged when observing CommandResult', () => {
    const replica = createReplica(10)
    replica.observeCommandResult(commandResult(11))

    expect(replica.getState()).toMatchObject({
      lastAppliedRevision: 10,
      gamePublicState: { count: 10 },
      privateState: { secret: 10 },
      needsResync: false,
    })
    expect(replica.getCommandResult('c1')?.status).toBe('accepted')
  })

  it('applies Event N+1 even when CommandResult N+1 arrived first', () => {
    const replica = createReplica(10)
    replica.observeCommandResult(commandResult(11))

    expect(replica.applyEvent(projectionEvent(11, 11))).toBe('applied')
    expect(replica.getState().lastAppliedRevision).toBe(11)
    expect(replica.getState().gamePublicState).toEqual({ count: 11 })
  })

  it('does not treat a future CommandResult revision as a replica gap', () => {
    const replica = createReplica(10)
    replica.observeCommandResult(commandResult(12))

    expect(replica.getState()).toMatchObject({
      lastAppliedRevision: 10,
      needsResync: false,
    })
  })

  it('applies the next incremental Event', () => {
    const replica = createReplica(4)

    expect(replica.applyEvent(projectionEvent(5, 5))).toBe('applied')
    expect(replica.getState().lastAppliedRevision).toBe(5)
  })

  it('does not reapply a duplicate Event', () => {
    const replica = createReplica(5)

    expect(replica.applyEvent(projectionEvent(5, 99))).toBe('duplicate')
    expect(replica.getState().gamePublicState).toEqual({ count: 5 })
  })

  it('ignores an older Event', () => {
    const replica = createReplica(5)

    expect(replica.applyEvent(projectionEvent(4, 99))).toBe('stale')
    expect(replica.getState().lastAppliedRevision).toBe(5)
  })

  it('detects a gap and pauses incremental application until resync', () => {
    const replica = createReplica(5)

    expect(replica.applyEvent(projectionEvent(7, 7))).toBe('gap')
    expect(replica.getState().needsResync).toBe(true)
    expect(replica.applyEvent(projectionEvent(6, 6))).toBe('awaiting_resync')
    expect(replica.getState().lastAppliedRevision).toBe(5)
  })

  it('uses an accepted Snapshot to recover from a gap', () => {
    const replica = createReplica(5)
    replica.applyEvent(projectionEvent(7, 7))

    expect(replica.applySnapshot(snapshot(8, 8))).toBe('applied')
    expect(replica.getState()).toEqual({
      roomState: roomState(['player-1']),
      gamePublicState: { count: 8 },
      privateState: { secret: 8 },
      lastAppliedRevision: 8,
      needsResync: false,
    })
  })

  it('does not regress to an older Snapshot', () => {
    const replica = createReplica(8)

    expect(replica.applySnapshot(snapshot(7, 7))).toBe('stale')
    expect(replica.getState().lastAppliedRevision).toBe(8)
  })

  it('applies a marker by advancing only sequencing', () => {
    const replica = createReplica(10)
    const marker: Event<PublicState, PrivateState> = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      revision: 11,
      kind: 'marker',
    }

    expect(replica.applyEvent(marker)).toBe('applied')
    expect(replica.getState()).toEqual({
      roomState: roomState(['player-1']),
      gamePublicState: { count: 10 },
      privateState: { secret: 10 },
      lastAppliedRevision: 11,
      needsResync: false,
    })
  })

  it('rejects an incompatible Event without changing replica state', () => {
    const replica = createReplica(5)
    const before = replica.getState()

    expect(replica.applyEvent({
      ...projectionEvent(6, 6),
      protocolVersion: 2,
    })).toBe('incompatible_protocol')
    expect(replica.getState()).toEqual(before)
  })

  it('rejects an incompatible Snapshot without clearing resync state', () => {
    const replica = createReplica(5)
    replica.applyEvent(projectionEvent(7, 7))

    expect(replica.applySnapshot({
      ...snapshot(8, 8),
      protocolVersion: 2,
    })).toBe('incompatible_protocol')
    expect(replica.getState()).toMatchObject({
      lastAppliedRevision: 5,
      needsResync: true,
      gamePublicState: { count: 5 },
    })
  })

  it('rejects initialization from an incompatible protocol Snapshot', () => {
    expect(() => new ClientReplica('room-1', {
      ...snapshot(0, 0),
      protocolVersion: 2,
    })).toThrow(/incompatible protocol/i)
  })

  it('rejects initialization from a Snapshot for another room', () => {
    expect(() => new ClientReplica('room-1', {
      ...snapshot(0, 0),
      roomId: 'room-2',
    })).toThrow(/another room/i)
  })
})

function createReplica(revision: number) {
  return new ClientReplica<PublicState, PrivateState>('room-1', snapshot(revision, revision))
}

function roomState(playerIds: readonly string[]): RoomPublicState {
  return { playerIds, barriers: [] }
}

function snapshot(revision: number, value: number): Snapshot<PublicState, PrivateState> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: 'room-1',
    revision,
    roomState: roomState(['player-1']),
    gamePublicState: { count: value },
    privateState: { secret: value },
  }
}

function projectionEvent(revision: number, value: number): Event<PublicState, PrivateState> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: 'room-1',
    revision,
    kind: 'projection',
    roomState: roomState(['player-1']),
    gamePublicState: { count: value },
    privateState: { secret: value },
  }
}

function commandResult(revision: number): CommandResult {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: 'room-1',
    commandId: 'c1',
    status: 'accepted',
    revision,
  }
}
