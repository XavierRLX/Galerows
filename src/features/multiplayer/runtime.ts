import { createId } from '../../lib/utils/createId'
import { completeBarrier, createBarrier } from './barrier'
import type { BarrierState } from './barrier'
import { systemClock } from './clock'
import type { Clock } from './clock'
import type { GameAdapter, GameAdapterContext, RoomEffect } from './gameAdapter'
import { parseCommand, parseResyncRequest, PROTOCOL_VERSION } from './protocol'
import type {
  Command,
  CommandErrorCode,
  CommandId,
  CommandResult,
  ConnectionId,
  Event,
  PlayerId,
  RoomId,
  RoomPublicState,
  Snapshot,
} from './protocol'

interface Membership {
  playerId: PlayerId
  connectionId: ConnectionId | null
}

interface ConnectedMembership {
  playerId: PlayerId
  connectionId: ConnectionId
}

interface DeduplicationEntry {
  playerId: PlayerId
  type: string
  payload: unknown
  result: CommandResult
}

export interface RuntimeDelivery<TGamePublic, TPrivate> {
  playerId: PlayerId
  connectionId: ConnectionId
  event: Event<TGamePublic, TPrivate>
}

export interface RuntimeCommandResult<TGamePublic, TPrivate> {
  result: CommandResult
  deliveries: readonly RuntimeDelivery<TGamePublic, TPrivate>[]
  deduplicated: boolean
}

export interface JoinResult<TGamePublic, TPrivate> {
  playerId: PlayerId
  snapshot: Snapshot<TGamePublic, TPrivate>
  deliveries: readonly RuntimeDelivery<TGamePublic, TPrivate>[]
}

export type ResyncSnapshotResult<TGamePublic, TPrivate> =
  | { ok: true; snapshot: Snapshot<TGamePublic, TPrivate> }
  | {
    ok: false
    error:
      | 'incompatible_protocol'
      | 'invalid_request'
      | 'room_not_found'
      | 'not_member'
      | 'unauthorized'
  }

export interface AuthoritativeRoomRuntimeOptions<
  TState,
  TGameCommand,
  TGamePublic,
  TPrivate,
> {
  roomId: RoomId
  adapter: GameAdapter<TState, TGameCommand, TGamePublic, TPrivate>
  clock?: Clock
  random?: () => number
  createPlayerId?: () => PlayerId
}

export class AuthoritativeRoomRuntime<
  TState,
  TGameCommand,
  TGamePublic,
  TPrivate,
> {
  private readonly roomId: RoomId
  private readonly adapter: GameAdapter<TState, TGameCommand, TGamePublic, TPrivate>
  private readonly context: GameAdapterContext
  private readonly createPlayerId: () => PlayerId
  private canonicalState: TState
  private revision = 0
  private readonly memberships = new Map<PlayerId, Membership>()
  private readonly deduplication = new Map<CommandId, DeduplicationEntry>()
  private barriers = new Map<string, BarrierState>()

  constructor(options: AuthoritativeRoomRuntimeOptions<TState, TGameCommand, TGamePublic, TPrivate>) {
    this.roomId = options.roomId
    this.adapter = options.adapter
    this.context = {
      clock: options.clock ?? systemClock,
      random: options.random ?? Math.random,
    }
    this.createPlayerId = options.createPlayerId ?? (() => createId('player'))
    this.canonicalState = this.adapter.createInitialState(this.context)
  }

  getRevision() {
    return this.revision
  }

  join(connectionId: ConnectionId): JoinResult<TGamePublic, TPrivate> | null {
    if (this.membershipForConnection(connectionId)) return null

    const recipients = this.connectedMemberships()
    const beforeRoomState = this.projectRoomState()
    const playerId = this.createUniquePlayerId()
    this.memberships.set(playerId, { playerId, connectionId })
    this.revision += 1
    const afterRoomState = this.projectRoomState()

    return {
      playerId,
      snapshot: this.createSnapshotFor(playerId),
      deliveries: this.projectedDeliveries(
        recipients,
        beforeRoomState,
        this.canonicalState,
        afterRoomState,
        this.canonicalState,
      ),
    }
  }

  leave(playerId: PlayerId): readonly RuntimeDelivery<TGamePublic, TPrivate>[] {
    if (!this.memberships.has(playerId)) return []

    const beforeRoomState = this.projectRoomState()
    this.memberships.delete(playerId)
    this.revision += 1
    const afterRoomState = this.projectRoomState()

    return this.projectedDeliveries(
      this.connectedMemberships(),
      beforeRoomState,
      this.canonicalState,
      afterRoomState,
      this.canonicalState,
    )
  }

  disconnect(connectionId: ConnectionId): PlayerId | null {
    const membership = this.membershipForConnection(connectionId)
    if (!membership) return null
    membership.connectionId = null
    return membership.playerId
  }

  reassociate(playerId: PlayerId, connectionId: ConnectionId): boolean {
    const membership = this.memberships.get(playerId)
    if (!membership) return false

    const connectionOwner = this.membershipForConnection(connectionId)
    if (connectionOwner && connectionOwner.playerId !== playerId) return false

    membership.connectionId = connectionId
    return true
  }

  hasMembership(playerId: PlayerId) {
    return this.memberships.has(playerId)
  }

  getConnectionId(playerId: PlayerId) {
    return this.memberships.get(playerId)?.connectionId ?? null
  }

  createResyncSnapshot(
    input: unknown,
    connectionId: ConnectionId,
  ): ResyncSnapshotResult<TGamePublic, TPrivate> {
    const parsed = parseResyncRequest(input)
    if (!parsed.ok) {
      return {
        ok: false,
        error: parsed.error === 'incompatible_protocol'
          ? 'incompatible_protocol'
          : 'invalid_request',
      }
    }

    const request = parsed.request
    if (request.roomId !== this.roomId) return { ok: false, error: 'room_not_found' }

    const membership = this.memberships.get(request.playerId)
    if (!membership) return { ok: false, error: 'not_member' }
    if (membership.connectionId !== connectionId) return { ok: false, error: 'unauthorized' }

    return { ok: true, snapshot: this.createSnapshotFor(request.playerId) }
  }

  processCommand(
    input: unknown,
    connectionId: ConnectionId,
  ): RuntimeCommandResult<TGamePublic, TPrivate> {
    const parsed = parseCommand(input)
    if (!parsed.ok) {
      const revision = parsed.roomId === this.roomId ? this.revision : undefined
      return this.commandFailure(
        parsed.error === 'incompatible_protocol' ? 'incompatible_protocol' : 'rejected',
        parsed.error,
        parsed.roomId,
        parsed.commandId,
        revision,
      )
    }

    const command = parsed.command
    if (command.roomId !== this.roomId) {
      return this.commandFailure('rejected', 'room_not_found', command.roomId, command.commandId)
    }

    const membership = this.memberships.get(command.playerId)
    if (!membership) {
      return this.commandFailure(
        'rejected',
        'not_member',
        this.roomId,
        command.commandId,
        this.revision,
      )
    }
    if (membership.connectionId !== connectionId) {
      return this.commandFailure(
        'rejected',
        'unauthorized',
        this.roomId,
        command.commandId,
        this.revision,
      )
    }

    const previous = this.deduplication.get(command.commandId)
    if (previous) {
      if (sameIntent(previous, command)) {
        return { result: previous.result, deliveries: [], deduplicated: true }
      }
      return this.commandFailure(
        'rejected',
        'command_conflict',
        this.roomId,
        command.commandId,
        this.revision,
      )
    }

    const gameCommand = this.adapter.parseCommand(command)
    if (!gameCommand.ok) return this.rememberFailure(command, gameCommand.error)

    const transition = this.adapter.applyCommand(
      this.canonicalState,
      gameCommand.command,
      this.context,
    )
    if (!transition.accepted) return this.rememberFailure(command, transition.error)

    const beforeState = this.canonicalState
    const beforeRoomState = this.projectRoomState()
    const nextState = transition.changed ? transition.state : this.canonicalState
    const roomEffects = this.applyRoomEffects(transition.roomEffects ?? [])
    const synchronizedChanged = transition.changed || roomEffects.changed

    if (!synchronizedChanged) {
      const result = acceptedResult(this.roomId, command.commandId, this.revision)
      this.remember(command, result)
      return { result, deliveries: [], deduplicated: false }
    }

    this.canonicalState = nextState
    this.barriers = roomEffects.barriers
    this.revision += 1

    const deliveries = this.projectedDeliveries(
      this.connectedMemberships(),
      beforeRoomState,
      beforeState,
      this.projectRoomState(),
      this.canonicalState,
    )
    const result = acceptedResult(this.roomId, command.commandId, this.revision)
    this.remember(command, result)
    return { result, deliveries, deduplicated: false }
  }

  private applyRoomEffects(
    effects: readonly RoomEffect[],
  ): { barriers: Map<string, BarrierState>; changed: boolean } {
    if (effects.length === 0) return { barriers: this.barriers, changed: false }

    const nextBarriers = new Map(this.barriers)

    for (const effect of effects) {
      if (effect.type === 'open_barrier') {
        nextBarriers.set(
          effect.id,
          createBarrier(effect.id, effect.barrierType, effect.expectedPlayerIds),
        )
        continue
      }

      const barrier = nextBarriers.get(effect.id)
      if (!barrier) continue

      const update = completeBarrier(barrier, effect.playerId)
      if (update.changed) nextBarriers.set(effect.id, update.barrier)
    }

    return {
      barriers: nextBarriers,
      changed: !deepEqual(
        projectBarrierStates(this.barriers),
        projectBarrierStates(nextBarriers),
      ),
    }
  }

  private createSnapshotFor(playerId: PlayerId): Snapshot<TGamePublic, TPrivate> {
    if (!this.memberships.has(playerId)) {
      throw new Error('Cannot project snapshot for a non-member player.')
    }

    return {
      protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId,
      revision: this.revision,
      roomState: this.projectRoomState(),
      gamePublicState: this.adapter.projectPublic(this.canonicalState),
      privateState: this.adapter.projectPrivate(this.canonicalState, playerId),
    }
  }

  private projectRoomState(): RoomPublicState {
    return {
      playerIds: [...this.memberships.keys()],
      barriers: [...this.barriers.values()].map((barrier) => ({
        id: barrier.id,
        type: barrier.type,
        expectedCount: barrier.expectedPlayerIds.length,
        completedCount: barrier.completedPlayerIds.length,
        isComplete: barrier.isComplete,
      })),
    }
  }

  private projectedDeliveries(
    recipients: readonly ConnectedMembership[],
    beforeRoomState: RoomPublicState,
    beforeGameState: Readonly<TState>,
    afterRoomState: RoomPublicState,
    afterGameState: Readonly<TState>,
  ): readonly RuntimeDelivery<TGamePublic, TPrivate>[] {
    const beforeGamePublicState = this.adapter.projectPublic(beforeGameState)
    const afterGamePublicState = this.adapter.projectPublic(afterGameState)

    return recipients.map((membership) => {
      const beforePrivateState = this.adapter.projectPrivate(beforeGameState, membership.playerId)
      const afterPrivateState = this.adapter.projectPrivate(afterGameState, membership.playerId)
      const unchanged = deepEqual(beforeRoomState, afterRoomState)
        && deepEqual(beforeGamePublicState, afterGamePublicState)
        && deepEqual(beforePrivateState, afterPrivateState)

      const event: Event<TGamePublic, TPrivate> = unchanged
        ? {
          protocolVersion: PROTOCOL_VERSION,
          roomId: this.roomId,
          revision: this.revision,
          kind: 'marker',
        }
        : {
          protocolVersion: PROTOCOL_VERSION,
          roomId: this.roomId,
          revision: this.revision,
          kind: 'projection',
          roomState: afterRoomState,
          gamePublicState: afterGamePublicState,
          privateState: afterPrivateState,
        }

      return {
        playerId: membership.playerId,
        connectionId: membership.connectionId,
        event,
      }
    })
  }

  private connectedMemberships(): ConnectedMembership[] {
    const memberships: ConnectedMembership[] = []
    for (const membership of this.memberships.values()) {
      if (!membership.connectionId) continue
      memberships.push({
        playerId: membership.playerId,
        connectionId: membership.connectionId,
      })
    }
    return memberships
  }

  private membershipForConnection(connectionId: ConnectionId): Membership | null {
    for (const membership of this.memberships.values()) {
      if (membership.connectionId === connectionId) return membership
    }
    return null
  }

  private rememberFailure(
    command: Command,
    error: Extract<CommandErrorCode, 'invalid_payload' | 'unauthorized' | 'invalid_phase'>,
  ): RuntimeCommandResult<TGamePublic, TPrivate> {
    const result: CommandResult = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId,
      commandId: command.commandId,
      status: 'rejected',
      revision: this.revision,
      error,
    }
    this.remember(command, result)
    return { result, deliveries: [], deduplicated: false }
  }

  private remember(command: Command, result: CommandResult) {
    this.deduplication.set(command.commandId, {
      playerId: command.playerId,
      type: command.type,
      payload: command.payload,
      result,
    })
  }

  private commandFailure(
    status: Extract<CommandResult['status'], 'rejected' | 'incompatible_protocol'>,
    error: CommandErrorCode,
    roomId: RoomId | null,
    commandId: CommandId | null,
    revision?: number,
  ): RuntimeCommandResult<TGamePublic, TPrivate> {
    return {
      result: {
        protocolVersion: PROTOCOL_VERSION,
        roomId,
        commandId,
        status,
        revision,
        error,
      },
      deliveries: [],
      deduplicated: false,
    }
  }

  private createUniquePlayerId(): PlayerId {
    let playerId = this.createPlayerId()
    while (this.memberships.has(playerId)) playerId = this.createPlayerId()
    return playerId
  }
}

function projectBarrierStates(barriers: ReadonlyMap<string, BarrierState>) {
  return [...barriers.values()]
}

function acceptedResult(
  roomId: RoomId,
  commandId: CommandId,
  revision: number,
): CommandResult {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId,
    commandId,
    status: 'accepted',
    revision,
  }
}

function sameIntent(entry: DeduplicationEntry, command: Command) {
  return entry.playerId === command.playerId
    && entry.type === command.type
    && deepEqual(entry.payload, command.payload)
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((item, index) => deepEqual(item, right[index]))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
