import { describe, expect, it } from 'vitest'
import { ClientReplica } from './clientReplica'
import type { Clock } from './clock'
import type {
  GameAdapter,
  GameAdapterContext,
  GameCommandParseResult,
  GameTransition,
} from './gameAdapter'
import { PROTOCOL_VERSION } from './protocol'
import type { Command, ConnectionId, PlayerId } from './protocol'
import { AuthoritativeRoomRuntime } from './runtime'

interface TestState {
  count: number
  secrets: Record<string, number>
  lastNow: number
}

interface TestPublicState {
  count: number
  lastNow: number
}

interface TestPrivateState {
  secret: number
}

type TestGameCommand =
  | { kind: 'increment'; amount: number }
  | { kind: 'secret'; playerId: PlayerId; amount: number }
  | { kind: 'noop' }
  | { kind: 'reject' }
  | { kind: 'stamp' }
  | {
    kind: 'openBarrier'
    id: string
    barrierType: string
    expectedPlayerIds: readonly PlayerId[]
  }
  | { kind: 'completeBarrier'; id: string; playerId: PlayerId }
  | {
    kind: 'incrementAndOpen'
    amount: number
    id: string
    barrierType: string
    expectedPlayerIds: readonly PlayerId[]
  }

interface Metrics {
  parseCalls: number
  applyCalls: number
}

type TestRuntime = AuthoritativeRoomRuntime<
  TestState,
  TestGameCommand,
  TestPublicState,
  TestPrivateState
>

describe('AuthoritativeRoomRuntime', () => {
  it('starts room revision at 0', () => {
    const { runtime } = createRuntime()
    expect(runtime.getRevision()).toBe(0)
  })

  it('advances exactly +1 for an accepted mutating transition', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(
      command(player1, 'c1', 'increment', { amount: 2 }),
      connection1,
    )

    expect(outcome.result).toMatchObject({ status: 'accepted', revision: before + 1 })
    expect(runtime.getRevision()).toBe(before + 1)
    expect(ownSnapshot(runtime, player1, connection1).gamePublicState.count).toBe(2)
  })

  it('does not advance revision when the adapter rejects a command', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(command(player1, 'c1', 'reject', null), connection1)

    expect(outcome.result).toMatchObject({
      status: 'rejected',
      error: 'invalid_phase',
      revision: before,
    })
    expect(runtime.getRevision()).toBe(before)
  })

  it('deduplicates the same commandId without reexecuting the effect', () => {
    const metrics = { parseCalls: 0, applyCalls: 0 }
    const { runtime, player1, connection1 } = createJoinedRuntime({ metrics })
    const first = runtime.processCommand(
      command(player1, 'same', 'increment', { amount: 1 }),
      connection1,
    )
    const revision = runtime.getRevision()
    const second = runtime.processCommand(
      command(player1, 'same', 'increment', { amount: 1 }),
      connection1,
    )

    expect(first.result.status).toBe('accepted')
    expect(second).toMatchObject({ deduplicated: true, result: first.result })
    expect(second.deliveries).toEqual([])
    expect(runtime.getRevision()).toBe(revision)
    expect(ownSnapshot(runtime, player1, connection1).gamePublicState.count).toBe(1)
    expect(metrics).toEqual({ parseCalls: 1, applyCalls: 1 })
  })

  it('rejects conflicting reuse of commandId', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    runtime.processCommand(command(player1, 'same', 'increment', { amount: 1 }), connection1)
    const revision = runtime.getRevision()

    const conflict = runtime.processCommand(
      command(player1, 'same', 'increment', { amount: 2 }),
      connection1,
    )

    expect(conflict.result).toMatchObject({
      status: 'rejected',
      error: 'command_conflict',
      revision,
    })
    expect(runtime.getRevision()).toBe(revision)
    expect(ownSnapshot(runtime, player1, connection1).gamePublicState.count).toBe(1)
  })

  it('accepts a no-op without advancing revision', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    const revision = runtime.getRevision()

    const result = runtime.processCommand(command(player1, 'noop', 'noop', null), connection1)

    expect(result.result).toMatchObject({ status: 'accepted', revision })
    expect(result.deliveries).toEqual([])
    expect(runtime.getRevision()).toBe(revision)
  })

  it('reconnects with a new connectionId without changing playerId', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()

    expect(runtime.disconnect(connection1)).toBe(player1)
    expect(runtime.hasMembership(player1)).toBe(true)
    expect(runtime.getConnectionId(player1)).toBeNull()

    expect(runtime.reassociate(player1, 'connection-new')).toBe(true)
    expect(runtime.getConnectionId(player1)).toBe('connection-new')
    expect(runtime.hasMembership(player1)).toBe(true)
  })

  it('does not remove membership on disconnect', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()

    runtime.disconnect(connection1)

    expect(runtime.hasMembership(player1)).toBe(true)
  })

  it('removes membership only on explicit leave', () => {
    const { runtime, player1 } = createJoinedRuntime()
    const revision = runtime.getRevision()

    runtime.leave(player1)

    expect(runtime.hasMembership(player1)).toBe(false)
    expect(runtime.getRevision()).toBe(revision + 1)
  })

  it('projects private state only to its owner and uses marker for unaffected clients', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')

    const outcome = runtime.processCommand(
      command(player1, 'secret', 'secret', { amount: 7 }),
      connection1,
    )
    const ownDelivery = outcome.deliveries.find((item) => item.playerId === player1)
    const otherDelivery = outcome.deliveries.find((item) => item.playerId === player2)

    expect(ownDelivery?.event).toMatchObject({
      kind: 'projection',
      privateState: { secret: 7 },
    })
    expect(otherDelivery?.event).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      revision: outcome.result.revision,
      kind: 'marker',
    })
    expect(otherDelivery?.event).not.toHaveProperty('privateState')
    expect(otherDelivery?.event).not.toHaveProperty('playerId')
    expect(otherDelivery?.event).not.toHaveProperty('type')
    expect(otherDelivery?.event).not.toHaveProperty('payload')
  })

  it('rejects incompatible protocol before the GameAdapter sees the command', () => {
    const metrics = { parseCalls: 0, applyCalls: 0 }
    const { runtime, player1, connection1 } = createJoinedRuntime({ metrics })
    const revision = runtime.getRevision()

    const outcome = runtime.processCommand({
      protocolVersion: 2,
      roomId: 'room-1',
      playerId: player1,
      commandId: 'bad-version',
      type: 'increment',
      payload: { amount: 1 },
    }, connection1)

    expect(outcome.result).toMatchObject({
      status: 'incompatible_protocol',
      error: 'incompatible_protocol',
      revision,
    })
    expect(metrics).toEqual({ parseCalls: 0, applyCalls: 0 })
    expect(runtime.getRevision()).toBe(revision)
  })

  it('uses the injected authoritative clock deterministically', () => {
    const clock: Clock = { now: () => 4242 }
    const { runtime, player1, connection1 } = createJoinedRuntime({ clock })

    runtime.processCommand(command(player1, 'stamp', 'stamp', null), connection1)

    expect(ownSnapshot(runtime, player1, connection1).gamePublicState.lastNow).toBe(4242)
  })

  it('returns an explicit successful resync result for the owning connection', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    const result = runtime.createResyncSnapshot(
      resyncRequest(player1, runtime.getRevision()),
      connection1,
    )

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        roomId: 'room-1',
        privateState: { secret: 0 },
      },
    })
  })

  it('returns unauthorized when one connection requests another player Snapshot', () => {
    const { runtime, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')

    expect(runtime.createResyncSnapshot(
      resyncRequest(player2, runtime.getRevision()),
      connection1,
    )).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('authorizes only the new connection after disconnect and reassociate', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()
    const newConnection = 'connection-new'

    runtime.disconnect(connection1)
    expect(runtime.reassociate(player1, newConnection)).toBe(true)

    expect(runtime.createResyncSnapshot(
      resyncRequest(player1, runtime.getRevision()),
      newConnection,
    ).ok).toBe(true)
    expect(runtime.createResyncSnapshot(
      resyncRequest(player1, runtime.getRevision()),
      connection1,
    )).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('distinguishes incompatible resync protocol explicitly', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()

    expect(runtime.createResyncSnapshot({
      ...resyncRequest(player1, runtime.getRevision()),
      protocolVersion: 2,
    }, connection1)).toEqual({
      ok: false,
      error: 'incompatible_protocol',
    })
  })

  it('distinguishes malformed resync request from incompatible protocol', () => {
    const { runtime, connection1 } = createJoinedRuntime()

    expect(runtime.createResyncSnapshot({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      lastAppliedRevision: 0,
    }, connection1)).toEqual({
      ok: false,
      error: 'invalid_request',
    })
  })

  it('distinguishes wrong room and missing membership in resync', () => {
    const { runtime, player1, connection1 } = createJoinedRuntime()

    expect(runtime.createResyncSnapshot({
      ...resyncRequest(player1, runtime.getRevision()),
      roomId: 'other-room',
    }, connection1)).toEqual({
      ok: false,
      error: 'room_not_found',
    })

    expect(runtime.createResyncSnapshot(
      resyncRequest('missing-player', runtime.getRevision()),
      connection1,
    )).toEqual({
      ok: false,
      error: 'not_member',
    })
  })

  it('does not include Snapshot or private state in resync failures', () => {
    const { runtime, player1 } = createJoinedRuntime()
    const result = runtime.createResyncSnapshot(
      resyncRequest(player1, runtime.getRevision()),
      'wrong-connection',
    )

    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(result).not.toHaveProperty('snapshot')
    expect(result).not.toHaveProperty('privateState')
  })

  it('does not allow one active connection to belong to two memberships', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')

    expect(runtime.join(connection1)).toBeNull()
    expect(runtime.reassociate(player2, connection1)).toBe(false)
    expect(runtime.getConnectionId(player1)).toBe(connection1)
    expect(runtime.getConnectionId(player2)).toBe('connection-2')
  })

  it('sends existing members a projection when join changes room public state', () => {
    const { runtime } = createRuntime()
    const first = requireJoin(runtime, 'connection-1')
    const replica = new ClientReplica('room-1', first.snapshot)
    const second = requireJoin(runtime, 'connection-2')
    const event = deliveryFor(second.deliveries, first.playerId).event

    expect(event.kind).toBe('projection')
    expect(replica.applyEvent(event)).toBe('applied')
    expect(replica.getState().roomState.playerIds).toEqual([first.playerId, second.playerId])
    expect(second.snapshot.roomState.playerIds).toEqual([first.playerId, second.playerId])
  })

  it('sends remaining members a projection when leave changes room public state', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')
    const replica = new ClientReplica('room-1', ownSnapshot(runtime, player1, connection1))

    const deliveries = runtime.leave(player2)
    const event = deliveryFor(deliveries, player1).event

    expect(event.kind).toBe('projection')
    expect(replica.applyEvent(event)).toBe('applied')
    expect(replica.getState().roomState.playerIds).toEqual([player1])
  })

  it('opens a barrier through processCommand and advances one revision', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(
      command(player1, 'open-1', 'openBarrier', {
        id: 'ready',
        barrierType: 'ready',
        expectedPlayerIds: [player1, player2],
      }),
      connection1,
    )

    expect(outcome.result).toMatchObject({ status: 'accepted', revision: before + 1 })
    expect(runtime.getRevision()).toBe(before + 1)
    expect(ownSnapshot(runtime, player1, connection1).roomState.barriers).toEqual([{
      id: 'ready',
      type: 'ready',
      expectedCount: 2,
      completedCount: 0,
      isComplete: false,
    }])
  })

  it('completes barrier participation through processCommand', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')
    openReadyBarrier(runtime, player1, player2, connection1)
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(
      command(player1, 'complete-1', 'completeBarrier', { id: 'ready' }),
      connection1,
    )

    expect(outcome.result).toMatchObject({ status: 'accepted', revision: before + 1 })
    expect(ownSnapshot(runtime, player1, connection1).roomState.barriers[0]).toMatchObject({
      completedCount: 1,
      isComplete: false,
    })
  })

  it('deduplicates a barrier-changing Command without applying the room effect twice', () => {
    const metrics = { parseCalls: 0, applyCalls: 0 }
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({
      twoPlayers: true,
      metrics,
    })
    if (!player2) throw new Error('Expected second player in test fixture.')

    const input = command(player1, 'barrier-once', 'openBarrier', {
      id: 'ready',
      barrierType: 'ready',
      expectedPlayerIds: [player1, player2],
    })

    const first = runtime.processCommand(input, connection1)
    const revision = runtime.getRevision()
    const retry = runtime.processCommand(input, connection1)

    expect(first.result).toMatchObject({ status: 'accepted', revision })
    expect(retry).toMatchObject({ deduplicated: true, result: first.result })
    expect(retry.deliveries).toEqual([])
    expect(runtime.getRevision()).toBe(revision)
    expect(metrics).toEqual({ parseCalls: 1, applyCalls: 1 })
    expect(ownSnapshot(runtime, player1, connection1).roomState.barriers).toHaveLength(1)
  })

  it('does not advance revision when a room effect has no effective change', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')

    openReadyBarrier(runtime, player1, player2, connection1)
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(
      command(player1, 'open-identical', 'openBarrier', {
        id: 'ready',
        barrierType: 'ready',
        expectedPlayerIds: [player1, player2],
      }),
      connection1,
    )

    expect(outcome.result).toMatchObject({ status: 'accepted', revision: before })
    expect(runtime.getRevision()).toBe(before)
    expect(outcome.deliveries).toEqual([])
  })

  it('applies game state and barrier state atomically in exactly one new revision', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')
    const before = runtime.getRevision()

    const outcome = runtime.processCommand(
      command(player1, 'combined', 'incrementAndOpen', {
        amount: 3,
        id: 'sync',
        barrierType: 'checkpoint',
        expectedPlayerIds: [player1, player2],
      }),
      connection1,
    )

    expect(outcome.result).toMatchObject({ status: 'accepted', revision: before + 1 })
    expect(runtime.getRevision()).toBe(before + 1)

    const event = deliveryFor(outcome.deliveries, player1).event
    expect(event).toMatchObject({
      kind: 'projection',
      revision: before + 1,
      gamePublicState: { count: 3, lastNow: 0 },
      roomState: {
        barriers: [{
          id: 'sync',
          type: 'checkpoint',
          expectedCount: 2,
          completedCount: 0,
          isComplete: false,
        }],
      },
    })
  })

  it('produces a Snapshot coherent with the atomic game + barrier Event', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')

    const outcome = runtime.processCommand(
      command(player1, 'combined-snapshot', 'incrementAndOpen', {
        amount: 4,
        id: 'sync',
        barrierType: 'checkpoint',
        expectedPlayerIds: [player1, player2],
      }),
      connection1,
    )
    const event = deliveryFor(outcome.deliveries, player1).event
    const snapshot = ownSnapshot(runtime, player1, connection1)

    expect(event.kind).toBe('projection')
    if (event.kind !== 'projection') throw new Error('Expected projection Event.')

    expect(snapshot.revision).toBe(event.revision)
    expect(snapshot.roomState).toEqual(event.roomState)
    expect(snapshot.gamePublicState).toEqual(event.gamePublicState)
    expect(snapshot.privateState).toEqual(event.privateState)
  })

  it('synchronizes barrier completion without exposing internal participant lists', () => {
    const { runtime, player1, player2, connection1 } = createJoinedRuntime({ twoPlayers: true })
    if (!player2) throw new Error('Expected second player in test fixture.')
    openReadyBarrier(runtime, player1, player2, connection1)

    const outcome = runtime.processCommand(
      command(player1, 'complete-safe', 'completeBarrier', { id: 'ready' }),
      connection1,
    )
    const event = deliveryFor(outcome.deliveries, player1).event

    expect(event).toMatchObject({
      kind: 'projection',
      roomState: {
        barriers: [{
          expectedCount: 2,
          completedCount: 1,
          isComplete: false,
        }],
      },
    })
    if (event.kind !== 'projection') throw new Error('Expected projection Event.')
    expect(event.roomState.barriers[0]).not.toHaveProperty('expectedPlayerIds')
    expect(event.roomState.barriers[0]).not.toHaveProperty('completedPlayerIds')
  })

  it('uses a test GameAdapter that returns new state without mutating its input', () => {
    const adapter = createTestAdapter({ parseCalls: 0, applyCalls: 0 })
    const original: Readonly<TestState> = Object.freeze({
      count: 0,
      secrets: Object.freeze({}),
      lastNow: 0,
    })
    const transition = adapter.applyCommand(
      original,
      { kind: 'increment', amount: 1 },
      { clock: { now: () => 0 }, random: () => 0 },
    )

    expect(original).toEqual({ count: 0, secrets: {}, lastNow: 0 })
    expect(transition).toMatchObject({ accepted: true, changed: true })
    if (!transition.accepted || !transition.changed) {
      throw new Error('Expected mutating transition.')
    }
    expect(transition.state).not.toBe(original)
    expect(transition.state.count).toBe(1)
  })
})

interface RuntimeFixtureOptions {
  metrics?: Metrics
  clock?: Clock
  twoPlayers?: boolean
}

function createRuntime(options: RuntimeFixtureOptions = {}) {
  let nextPlayer = 0
  const metrics = options.metrics ?? { parseCalls: 0, applyCalls: 0 }
  const runtime = new AuthoritativeRoomRuntime({
    roomId: 'room-1',
    adapter: createTestAdapter(metrics),
    clock: options.clock,
    random: () => 0.5,
    createPlayerId: () => 'player-' + (++nextPlayer),
  })
  return { runtime, metrics }
}

function createJoinedRuntime(options: RuntimeFixtureOptions = {}) {
  const fixture = createRuntime(options)
  const connection1 = 'connection-1'
  const first = requireJoin(fixture.runtime, connection1)
  let player2: PlayerId | undefined
  if (options.twoPlayers) {
    player2 = requireJoin(fixture.runtime, 'connection-2').playerId
  }
  return { ...fixture, player1: first.playerId, player2, connection1 }
}

function requireJoin(runtime: TestRuntime, connectionId: ConnectionId) {
  const result = runtime.join(connectionId)
  if (!result) throw new Error('Expected join to succeed.')
  return result
}

function ownSnapshot(runtime: TestRuntime, playerId: PlayerId, connectionId: ConnectionId) {
  const result = runtime.createResyncSnapshot(
    resyncRequest(playerId, runtime.getRevision()),
    connectionId,
  )
  if (!result.ok) throw new Error('Expected authorized Snapshot.')
  return result.snapshot
}

function resyncRequest(playerId: PlayerId, lastAppliedRevision: number) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: 'room-1',
    playerId,
    lastAppliedRevision,
  }
}

function deliveryFor<TPublic, TPrivate>(
  deliveries: readonly { playerId: PlayerId; event: import('./protocol').Event<TPublic, TPrivate> }[],
  playerId: PlayerId,
) {
  const delivery = deliveries.find((item) => item.playerId === playerId)
  if (!delivery) throw new Error('Expected delivery for player.')
  return delivery
}

function openReadyBarrier(
  runtime: TestRuntime,
  player1: PlayerId,
  player2: PlayerId,
  connection1: ConnectionId,
) {
  const outcome = runtime.processCommand(
    command(player1, 'setup-open-ready', 'openBarrier', {
      id: 'ready',
      barrierType: 'ready',
      expectedPlayerIds: [player1, player2],
    }),
    connection1,
  )
  expect(outcome.result.status).toBe('accepted')
  return outcome
}

function command(
  playerId: PlayerId,
  commandId: string,
  type: string,
  payload: unknown,
): Command {
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: 'room-1',
    playerId,
    commandId,
    type,
    payload,
  }
}

function createTestAdapter(metrics: Metrics): GameAdapter<
  TestState,
  TestGameCommand,
  TestPublicState,
  TestPrivateState
> {
  return {
    createInitialState: () => ({ count: 0, secrets: {}, lastNow: 0 }),

    parseCommand(command): GameCommandParseResult<TestGameCommand> {
      metrics.parseCalls += 1

      if (command.type === 'increment') {
        const amount = readAmount(command.payload)
        return amount === null
          ? { ok: false, error: 'invalid_payload' }
          : { ok: true, command: { kind: 'increment', amount } }
      }
      if (command.type === 'secret') {
        const amount = readAmount(command.payload)
        return amount === null
          ? { ok: false, error: 'invalid_payload' }
          : { ok: true, command: { kind: 'secret', playerId: command.playerId, amount } }
      }
      if (command.type === 'noop') return { ok: true, command: { kind: 'noop' } }
      if (command.type === 'reject') return { ok: true, command: { kind: 'reject' } }
      if (command.type === 'stamp') return { ok: true, command: { kind: 'stamp' } }

      if (command.type === 'openBarrier') {
        const barrier = readBarrierPayload(command.payload)
        return barrier
          ? { ok: true, command: { kind: 'openBarrier', ...barrier } }
          : { ok: false, error: 'invalid_payload' }
      }

      if (command.type === 'completeBarrier') {
        const id = readStringField(command.payload, 'id')
        return id
          ? { ok: true, command: { kind: 'completeBarrier', id, playerId: command.playerId } }
          : { ok: false, error: 'invalid_payload' }
      }

      if (command.type === 'incrementAndOpen') {
        const amount = readAmount(command.payload)
        const barrier = readBarrierPayload(command.payload)
        return amount !== null && barrier
          ? {
            ok: true,
            command: {
              kind: 'incrementAndOpen',
              amount,
              ...barrier,
            },
          }
          : { ok: false, error: 'invalid_payload' }
      }

      return { ok: false, error: 'invalid_payload' }
    },

    applyCommand(
      state: Readonly<TestState>,
      gameCommand: TestGameCommand,
      context: GameAdapterContext,
    ): GameTransition<TestState> {
      metrics.applyCalls += 1

      if (gameCommand.kind === 'increment') {
        return {
          accepted: true,
          changed: true,
          state: { ...state, count: state.count + gameCommand.amount },
        }
      }

      if (gameCommand.kind === 'secret') {
        return {
          accepted: true,
          changed: true,
          state: {
            ...state,
            secrets: {
              ...state.secrets,
              [gameCommand.playerId]: (state.secrets[gameCommand.playerId] ?? 0)
                + gameCommand.amount,
            },
          },
        }
      }

      if (gameCommand.kind === 'stamp') {
        return {
          accepted: true,
          changed: true,
          state: { ...state, lastNow: context.clock.now() },
        }
      }

      if (gameCommand.kind === 'openBarrier') {
        return {
          accepted: true,
          changed: false,
          roomEffects: [{
            type: 'open_barrier',
            id: gameCommand.id,
            barrierType: gameCommand.barrierType,
            expectedPlayerIds: gameCommand.expectedPlayerIds,
          }],
        }
      }

      if (gameCommand.kind === 'completeBarrier') {
        return {
          accepted: true,
          changed: false,
          roomEffects: [{
            type: 'complete_barrier',
            id: gameCommand.id,
            playerId: gameCommand.playerId,
          }],
        }
      }

      if (gameCommand.kind === 'incrementAndOpen') {
        return {
          accepted: true,
          changed: true,
          state: { ...state, count: state.count + gameCommand.amount },
          roomEffects: [{
            type: 'open_barrier',
            id: gameCommand.id,
            barrierType: gameCommand.barrierType,
            expectedPlayerIds: gameCommand.expectedPlayerIds,
          }],
        }
      }

      if (gameCommand.kind === 'reject') {
        return { accepted: false, error: 'invalid_phase' }
      }

      return { accepted: true, changed: false }
    },

    projectPublic: (state) => ({ count: state.count, lastNow: state.lastNow }),

    projectPrivate: (state, playerId) => ({
      secret: state.secrets[playerId] ?? 0,
    }),
  }
}

function readAmount(payload: unknown): number | null {
  if (!isRecord(payload)) return null
  return typeof payload.amount === 'number' && Number.isFinite(payload.amount)
    ? payload.amount
    : null
}

function readBarrierPayload(payload: unknown) {
  if (!isRecord(payload)) return null

  const id = readStringField(payload, 'id')
  const barrierType = readStringField(payload, 'barrierType')
  const expectedPlayerIds = payload.expectedPlayerIds

  if (
    !id
    || !barrierType
    || !Array.isArray(expectedPlayerIds)
    || expectedPlayerIds.some((value) => typeof value !== 'string')
  ) {
    return null
  }

  return {
    id,
    barrierType,
    expectedPlayerIds,
  }
}

function readStringField(payload: unknown, field: string) {
  if (!isRecord(payload)) return null
  const value = payload[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
