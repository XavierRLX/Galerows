import { describe, expect, it } from 'vitest'
import { ClientReplica } from '../clientReplica'
import type {
  GameAdapter,
  GameCommandParseResult,
  GameTransition,
} from '../gameAdapter'
import { PROTOCOL_VERSION } from '../protocol'
import type {
  AuthoritativeMessage,
  Command,
  CommandResult,
  ConnectionId,
  Event,
  PlayerId,
  ResyncRequest,
  Snapshot,
} from '../protocol'
import type { RoomTransport } from '../roomTransport'
import { AuthoritativeRoomRuntime } from '../runtime'
import {
  InMemoryRoomNetwork,
} from './inMemoryRoomTransport'
import type {
  InMemoryBootstrap,
  InMemoryPacket,
} from './inMemoryRoomTransport'

interface TestState {
  count: number
  secrets: Record<string, number>
}

interface TestPublicState {
  count: number
}

interface TestPrivateState {
  secret: number
}

type TestGameCommand =
  | { kind: 'increment'; amount: number }
  | { kind: 'secret'; playerId: PlayerId; amount: number }
  | {
    kind: 'incrementAndOpen'
    amount: number
    id: string
    barrierType: string
    expectedPlayerIds: readonly PlayerId[]
  }

type TestRuntime = AuthoritativeRoomRuntime<
  TestState,
  TestGameCommand,
  TestPublicState,
  TestPrivateState
>

type TestNetwork = InMemoryRoomNetwork<
  TestState,
  TestGameCommand,
  TestPublicState,
  TestPrivateState
>

type TestPacket = InMemoryPacket<TestPublicState, TestPrivateState>

interface ReceivedApplication {
  message: AuthoritativeMessage<TestPublicState, TestPrivateState>
  result: boolean | string
}

class TestClient {
  readonly playerId: PlayerId
  private connectionId: ConnectionId
  private transport: RoomTransport<TestPublicState, TestPrivateState>
  readonly replica: ClientReplica<TestPublicState, TestPrivateState>
  readonly received: ReceivedApplication[] = []
  private unsubscribe: () => void

  constructor(bootstrap: InMemoryBootstrap<TestPublicState, TestPrivateState>) {
    this.playerId = bootstrap.playerId
    this.connectionId = bootstrap.connectionId
    this.transport = bootstrap.transport
    this.replica = new ClientReplica('room-1', bootstrap.snapshot)
    this.unsubscribe = this.subscribeTransport()
  }

  send(commandId: string, type: string, payload: unknown): Command {
    const command: Command = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      playerId: this.playerId,
      commandId,
      type,
      payload,
    }
    this.transport.sendCommand(command)
    return command
  }

  retry(command: Command): void {
    this.transport.sendCommand(command)
  }

  requestResync(): void {
    const state = this.replica.getState()
    const request: ResyncRequest = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      playerId: this.playerId,
      lastAppliedRevision: state.lastAppliedRevision,
    }
    this.transport.sendResyncRequest(request)
  }

  disconnect(): void {
    this.transport.disconnect()
  }

  reconnect(
    connectionId: ConnectionId,
    transport: RoomTransport<TestPublicState, TestPrivateState>,
  ): void {
    this.unsubscribe()
    this.connectionId = connectionId
    this.transport = transport
    this.unsubscribe = this.subscribeTransport()
  }

  getConnectionId(): ConnectionId {
    return this.connectionId
  }

  private subscribeTransport(): () => void {
    return this.transport.subscribe((message) => {
      if (isCommandResult(message)) {
        this.received.push({
          message,
          result: this.replica.observeCommandResult(message),
        })
        return
      }

      if (isEvent(message)) {
        this.received.push({
          message,
          result: this.replica.applyEvent(message),
        })
        return
      }

      this.received.push({
        message,
        result: this.replica.applySnapshot(message),
      })
    })
  }
}

describe('in-memory multiplayer integration harness', () => {
  it('synchronizes the same public projection across two clients', () => {
    const { runtime, network, a, b } = setupTwoClients()

    a.send('c1', 'increment', { amount: 2 })
    network.deliverAll()

    expect(runtime.getRevision()).toBe(3)
    expect(a.replica.getState()).toMatchObject({
      lastAppliedRevision: 3,
      gamePublicState: { count: 2 },
    })
    expect(b.replica.getState()).toMatchObject({
      lastAppliedRevision: 3,
      gamePublicState: { count: 2 },
    })
  })

  it('keeps private projection restricted to the intended recipient packet', () => {
    const { network, a, b } = setupTwoClients()

    a.send('secret-a', 'secret', { amount: 777 })
    deliverClientCommand(network, 'secret-a')

    const aEvent = authorityEventPacket(network, a.getConnectionId(), 3)
    const bEvent = authorityEventPacket(network, b.getConnectionId(), 3)

    expect(eventMessage(aEvent)).toMatchObject({
      kind: 'projection',
      privateState: { secret: 777 },
    })
    expect(eventMessage(bEvent)).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      revision: 3,
      kind: 'marker',
    })
    expect(JSON.stringify(bEvent)).not.toContain('777')
  })

  it('keeps another player private state out of a resync Snapshot packet', () => {
    const { network, a, b } = setupTwoClients()

    a.send('secret-before-b-resync', 'secret', { amount: 777 })
    deliverClientCommand(network, 'secret-before-b-resync')

    const aEvent = authorityEventPacket(network, a.getConnectionId(), 3)
    network.deliverPacket(aEvent.id)
    expect(a.replica.getState().privateState).toEqual({ secret: 777 })

    b.requestResync()
    const request = resyncPacket(network, b.getConnectionId())
    expect(request).toMatchObject({
      direction: 'client_to_authority',
      connectionId: b.getConnectionId(),
      payload: { kind: 'resync' },
    })
    network.deliverPacket(request.id)

    const packet = snapshotPacket(network, b.getConnectionId())
    const snapshot = snapshotMessage(packet)

    expect(packet).toMatchObject({
      direction: 'authority_to_client',
      connectionId: b.getConnectionId(),
    })
    expect(snapshot.privateState).toEqual({ secret: 0 })
    expect(snapshot.privateState).not.toEqual({ secret: 777 })
    expect(JSON.stringify(packet)).not.toContain('777')

    network.deliverPacket(packet.id)
    expect(b.replica.getState().privateState).toEqual({ secret: 0 })
  })

  it('allows CommandResult before Event without advancing replica revision early', () => {
    const { network, a } = setupTwoClients()

    a.send('result-first', 'increment', { amount: 1 })
    deliverClientCommand(network, 'result-first')

    const result = commandResultPacket(network, a.getConnectionId(), 'result-first')
    const event = authorityEventPacket(network, a.getConnectionId(), 3)

    network.deliverPacket(result.id)
    expect(a.replica.getState().lastAppliedRevision).toBe(2)

    network.deliverPacket(event.id)
    expect(a.replica.getState().lastAppliedRevision).toBe(3)
  })

  it('allows Event before CommandResult because the result is only correlational', () => {
    const { network, a } = setupTwoClients()

    a.send('event-first', 'increment', { amount: 1 })
    deliverClientCommand(network, 'event-first')

    const event = authorityEventPacket(network, a.getConnectionId(), 3)
    const result = commandResultPacket(network, a.getConnectionId(), 'event-first')

    network.deliverPacket(event.id)
    expect(a.replica.getState().lastAppliedRevision).toBe(3)

    network.deliverPacket(result.id)
    expect(a.replica.getState().lastAppliedRevision).toBe(3)
  })

  it('identifies a duplicated Event without applying the projection twice', () => {
    const { network, a } = setupTwoClients()

    a.send('duplicate-event', 'increment', { amount: 1 })
    deliverClientCommand(network, 'duplicate-event')

    const event = authorityEventPacket(network, a.getConnectionId(), 3)
    const duplicateId = network.duplicatePacket(event.id)
    if (!duplicateId) throw new Error('Expected duplicated packet.')

    network.deliverPacket(event.id)
    network.deliverPacket(duplicateId)

    const eventApplications = a.received
      .filter((entry) => isEvent(entry.message))
      .map((entry) => entry.result)

    expect(eventApplications.slice(-2)).toEqual(['applied', 'duplicate'])
    expect(a.replica.getState().gamePublicState.count).toBe(1)
  })

  it('deduplicates a duplicated Command at the authority', () => {
    const { runtime, network, a } = setupTwoClients()

    a.send('duplicate-command', 'increment', { amount: 1 })
    const original = clientCommandPacket(network, 'duplicate-command')
    const duplicateId = network.duplicatePacket(original.id)
    if (!duplicateId) throw new Error('Expected duplicated Command packet.')

    network.deliverPacket(original.id)
    const revision = runtime.getRevision()
    network.deliverPacket(duplicateId)

    expect(revision).toBe(3)
    expect(runtime.getRevision()).toBe(3)

    const results = pendingCommandResults(network, a.getConnectionId(), 'duplicate-command')
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ status: 'accepted', revision: 3 })
    expect(results[1]).toEqual(results[0])
  })

  it('recovers a lost CommandResult by retrying the same Command without another effect', () => {
    const { runtime, network, a } = setupTwoClients()

    const command = a.send('lost-result', 'increment', { amount: 1 })
    deliverClientCommand(network, 'lost-result')

    const result = commandResultPacket(network, a.getConnectionId(), 'lost-result')
    network.dropPacket(result.id)
    deliverAllAuthorityPackets(network)

    expect(a.replica.getState()).toMatchObject({
      lastAppliedRevision: 3,
      gamePublicState: { count: 1 },
    })

    const revision = runtime.getRevision()
    a.retry(command)
    deliverClientCommand(network, 'lost-result')
    expect(runtime.getRevision()).toBe(revision)

    const retryResult = commandResultPacket(network, a.getConnectionId(), 'lost-result')
    network.deliverPacket(retryResult.id)
    expect(a.replica.getCommandResult('lost-result')).toMatchObject({
      status: 'accepted',
      revision,
    })
  })

  it('detects a lost Event as a gap when a later revision arrives', () => {
    const { network, a } = setupTwoClients()

    a.send('lost-event-1', 'increment', { amount: 1 })
    deliverClientCommand(network, 'lost-event-1')
    network.dropPacket(authorityEventPacket(network, a.getConnectionId(), 3).id)
    deliverAllAuthorityPackets(network)

    expect(a.replica.getState().lastAppliedRevision).toBe(2)

    a.send('lost-event-2', 'increment', { amount: 1 })
    deliverClientCommand(network, 'lost-event-2')
    network.deliverPacket(authorityEventPacket(network, a.getConnectionId(), 4).id)

    expect(a.replica.getState()).toMatchObject({
      lastAppliedRevision: 2,
      needsResync: true,
    })
  })

  it('keeps waiting for resync when Event N+2 arrives before N+1', () => {
    const { network, a } = setupTwoClients()

    a.send('reorder-1', 'increment', { amount: 1 })
    deliverClientCommand(network, 'reorder-1')

    a.send('reorder-2', 'increment', { amount: 1 })
    deliverClientCommand(network, 'reorder-2')

    const event3 = authorityEventPacket(network, a.getConnectionId(), 3)
    const event4 = authorityEventPacket(network, a.getConnectionId(), 4)

    network.deliverPacket(event4.id)
    expect(a.replica.getState().needsResync).toBe(true)

    network.deliverPacket(event3.id)
    expect(a.replica.getState()).toMatchObject({
      lastAppliedRevision: 2,
      needsResync: true,
    })
    expect(lastEventApplication(a)).toBe('awaiting_resync')
  })

  it('recovers gap through ResyncRequest and Snapshot crossing the queue', () => {
    const { runtime, network, a } = setupTwoClients()

    createGapAtRevision4(network, a)
    expect(a.replica.getState().needsResync).toBe(true)

    a.requestResync()
    const request = resyncPacket(network, a.getConnectionId())
    network.deliverPacket(request.id)

    const snapshot = snapshotPacket(network, a.getConnectionId())
    network.deliverPacket(snapshot.id)

    expect(a.replica.getState()).toMatchObject({
      lastAppliedRevision: runtime.getRevision(),
      needsResync: false,
      gamePublicState: { count: 2 },
    })
  })

  it('disconnect preserves logical membership', () => {
    const { runtime, b } = setupTwoClients()
    const playerId = b.playerId

    b.disconnect()

    expect(runtime.hasMembership(playerId)).toBe(true)
    expect(runtime.getConnectionId(playerId)).toBeNull()
  })

  it('does not enqueue later authority deliveries to a disconnected client', () => {
    const { network, a, b } = setupTwoClients()

    b.disconnect()
    a.send('while-b-offline', 'increment', { amount: 1 })
    deliverClientCommand(network, 'while-b-offline')

    expect(network.pending().some(
      (packet) => packet.direction === 'authority_to_client'
        && packet.connectionId === b.getConnectionId(),
    )).toBe(false)
  })

  it('reconnects the same player with a new connectionId', () => {
    const { runtime, network, b } = setupTwoClients()
    const playerId = b.playerId

    b.disconnect()
    const transport = network.reconnectPlayer(playerId, 'connection-b-new')
    if (!transport) throw new Error('Expected reconnect transport.')

    b.reconnect('connection-b-new', transport)

    expect(b.playerId).toBe(playerId)
    expect(b.getConnectionId()).toBe('connection-b-new')
    expect(runtime.getConnectionId(playerId)).toBe('connection-b-new')
  })

  it('rejects a stale queued Command from the old connection after reassociation', () => {
    const { runtime, network, b } = setupTwoClients()

    b.send('stale-old-command', 'increment', { amount: 9 })
    const stalePacket = clientCommandPacket(network, 'stale-old-command')
    b.disconnect()

    const transport = network.reconnectPlayer(b.playerId, 'connection-b-new')
    if (!transport) throw new Error('Expected reconnect transport.')
    b.reconnect('connection-b-new', transport)

    const before = runtime.getRevision()
    network.deliverPacket(stalePacket.id)

    expect(runtime.getRevision()).toBe(before)
    expect(currentSnapshot(runtime, network, b).gamePublicState.count).toBe(0)
  })

  it('rejects a stale resync request from the old connection after reassociation', () => {
    const { network, b } = setupTwoClients()

    b.requestResync()
    const staleRequest = resyncPacket(network, b.getConnectionId())
    b.disconnect()

    const transport = network.reconnectPlayer(b.playerId, 'connection-b-new')
    if (!transport) throw new Error('Expected reconnect transport.')
    b.reconnect('connection-b-new', transport)

    network.deliverPacket(staleRequest.id)

    expect(network.observedResyncAttempts().at(-1)?.result).toEqual({
      ok: false,
      error: 'unauthorized',
    })
  })

  it('authorizes resync through the new connection after reassociation', () => {
    const { runtime, network, b } = setupTwoClients()

    b.disconnect()
    const transport = network.reconnectPlayer(b.playerId, 'connection-b-new')
    if (!transport) throw new Error('Expected reconnect transport.')
    b.reconnect('connection-b-new', transport)

    b.requestResync()
    network.deliverPacket(resyncPacket(network, 'connection-b-new').id)
    network.deliverPacket(snapshotPacket(network, 'connection-b-new').id)

    expect(b.replica.getState()).toMatchObject({
      lastAppliedRevision: runtime.getRevision(),
      needsResync: false,
    })
  })

  it('recovers multiple offline mutations from a current Snapshot without replay', () => {
    const { runtime, network, a, b } = setupTwoClients()

    b.disconnect()

    a.send('offline-1', 'increment', { amount: 2 })
    deliverClientCommand(network, 'offline-1')
    deliverAllAuthorityPackets(network)

    a.send('offline-2', 'increment', { amount: 3 })
    deliverClientCommand(network, 'offline-2')
    deliverAllAuthorityPackets(network)

    expect(runtime.getRevision()).toBe(4)
    expect(b.replica.getState().lastAppliedRevision).toBe(2)

    const transport = network.reconnectPlayer(b.playerId, 'connection-b-new')
    if (!transport) throw new Error('Expected reconnect transport.')
    b.reconnect('connection-b-new', transport)
    b.requestResync()
    network.deliverAll()

    expect(b.replica.getState()).toMatchObject({
      lastAppliedRevision: 4,
      needsResync: false,
      gamePublicState: { count: 5 },
    })
  })

  it('processes A and B Commands in the authority order selected by the queue', () => {
    const { runtime, network, a, b } = setupTwoClients()

    a.send('from-a', 'increment', { amount: 1 })
    b.send('from-b', 'increment', { amount: 10 })

    const aPacket = clientCommandPacket(network, 'from-a')
    const bPacket = clientCommandPacket(network, 'from-b')
    expect(network.movePacket(bPacket.id, 0)).toBe(true)

    network.deliverNext()
    expect(runtime.getRevision()).toBe(3)
    network.deliverPacket(aPacket.id)
    expect(runtime.getRevision()).toBe(4)

    expect(commandResultMessage(
      commandResultPacket(network, b.getConnectionId(), 'from-b'),
    ).revision).toBe(3)
    expect(commandResultMessage(
      commandResultPacket(network, a.getConnectionId(), 'from-a'),
    ).revision).toBe(4)

    network.deliverAll()
    expect(a.replica.getState().gamePublicState.count).toBe(11)
    expect(b.replica.getState().gamePublicState.count).toBe(11)
  })

  it('keeps global revisions monotonic for sequential authority processing', () => {
    const { runtime, network, a } = setupTwoClients()

    const revisions: number[] = []
    for (const [id, amount] of [['r1', 1], ['r2', 1], ['r3', 1]] as const) {
      a.send(id, 'increment', { amount })
      deliverClientCommand(network, id)
      revisions.push(runtime.getRevision())
    }

    expect(revisions).toEqual([3, 4, 5])
  })

  it('carries game state and barrier roomEffect end to end under one revision', () => {
    const { runtime, network, a, b } = setupTwoClients()

    const command = a.send('barrier-atomic', 'incrementAndOpen', {
      amount: 4,
      id: 'checkpoint',
      barrierType: 'checkpoint',
      expectedPlayerIds: [a.playerId, b.playerId],
    })
    deliverClientCommand(network, 'barrier-atomic')
    const revision = runtime.getRevision()

    const eventA = authorityEventPacket(network, a.getConnectionId(), revision)
    const eventB = authorityEventPacket(network, b.getConnectionId(), revision)
    expect(eventMessage(eventA)).toMatchObject({
      kind: 'projection',
      gamePublicState: { count: 4 },
      roomState: {
        barriers: [{
          id: 'checkpoint',
          expectedCount: 2,
          completedCount: 0,
        }],
      },
    })
    expect(eventMessage(eventB)).toMatchObject({
      kind: 'projection',
      gamePublicState: { count: 4 },
    })

    network.deliverAll()
    expect(a.replica.getState().lastAppliedRevision).toBe(revision)
    expect(b.replica.getState().lastAppliedRevision).toBe(revision)

    const snapshot = requestSnapshot(network, a)
    expect(snapshot.revision).toBe(revision)
    expect(snapshot.roomState).toEqual(a.replica.getState().roomState)
    expect(snapshot.gamePublicState).toEqual(a.replica.getState().gamePublicState)

    const beforeRetry = runtime.getRevision()
    a.retry(command)
    deliverClientCommand(network, 'barrier-atomic')
    expect(runtime.getRevision()).toBe(beforeRetry)
  })

  it('uses marker for a client whose authorized projection did not change', () => {
    const { network, a, b } = setupTwoClients()

    a.send('secret-marker', 'secret', { amount: 5 })
    deliverClientCommand(network, 'secret-marker')

    const bPacket = authorityEventPacket(network, b.getConnectionId(), 3)
    expect(eventMessage(bPacket)).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      revision: 3,
      kind: 'marker',
    })

    network.deliverAll()
    expect(b.replica.getState()).toMatchObject({
      lastAppliedRevision: 3,
      privateState: { secret: 0 },
    })
  })

  it('supports deterministic inspect, drop, duplicate, selected delivery and reorder operations', () => {
    const { network, a, b } = setupTwoClients()

    a.send('network-a', 'increment', { amount: 1 })
    b.send('network-b', 'increment', { amount: 1 })

    const pending = network.pending()
    expect(pending).toHaveLength(2)

    const aPacket = clientCommandPacket(network, 'network-a')
    const bPacket = clientCommandPacket(network, 'network-b')
    const duplicate = network.duplicatePacket(aPacket.id)
    expect(duplicate).not.toBeNull()

    expect(network.movePacket(bPacket.id, 0)).toBe(true)
    expect(network.deliverNext()?.id).toBe(bPacket.id)

    if (!duplicate) throw new Error('Expected duplicate packet id.')
    expect(network.dropPacket(duplicate)?.id).toBe(duplicate)
    expect(network.deliverPacket(aPacket.id)?.id).toBe(aPacket.id)
  })
})

function setupTwoClients() {
  const runtime = createRuntime()
  const network = new InMemoryRoomNetwork(runtime)

  const bootstrapA = requireBootstrap(network, 'connection-a')
  const a = new TestClient(bootstrapA)

  const bootstrapB = requireBootstrap(network, 'connection-b')
  const b = new TestClient(bootstrapB)

  network.deliverAll()

  expect(runtime.getRevision()).toBe(2)
  expect(a.replica.getState().lastAppliedRevision).toBe(2)
  expect(b.replica.getState().lastAppliedRevision).toBe(2)

  return { runtime, network, a, b }
}

function createRuntime(): TestRuntime {
  let nextPlayer = 0
  return new AuthoritativeRoomRuntime({
    roomId: 'room-1',
    adapter: createAdapter(),
    random: () => 0.5,
    clock: { now: () => 1000 },
    createPlayerId: () => 'player-' + (++nextPlayer),
  })
}

function createAdapter(): GameAdapter<
  TestState,
  TestGameCommand,
  TestPublicState,
  TestPrivateState
> {
  return {
    createInitialState: () => ({ count: 0, secrets: {} }),

    parseCommand(command): GameCommandParseResult<TestGameCommand> {
      if (command.type === 'increment') {
        const amount = numberField(command.payload, 'amount')
        return amount === null
          ? { ok: false, error: 'invalid_payload' }
          : { ok: true, command: { kind: 'increment', amount } }
      }

      if (command.type === 'secret') {
        const amount = numberField(command.payload, 'amount')
        return amount === null
          ? { ok: false, error: 'invalid_payload' }
          : {
            ok: true,
            command: { kind: 'secret', playerId: command.playerId, amount },
          }
      }

      if (command.type === 'incrementAndOpen') {
        const amount = numberField(command.payload, 'amount')
        const id = stringField(command.payload, 'id')
        const barrierType = stringField(command.payload, 'barrierType')
        const expectedPlayerIds = stringArrayField(command.payload, 'expectedPlayerIds')

        return amount === null || !id || !barrierType || !expectedPlayerIds
          ? { ok: false, error: 'invalid_payload' }
          : {
            ok: true,
            command: {
              kind: 'incrementAndOpen',
              amount,
              id,
              barrierType,
              expectedPlayerIds,
            },
          }
      }

      return { ok: false, error: 'invalid_payload' }
    },

    applyCommand(
      state: Readonly<TestState>,
      command: TestGameCommand,
    ): GameTransition<TestState> {
      if (command.kind === 'increment') {
        return {
          accepted: true,
          changed: true,
          state: { ...state, count: state.count + command.amount },
        }
      }

      if (command.kind === 'secret') {
        return {
          accepted: true,
          changed: true,
          state: {
            ...state,
            secrets: {
              ...state.secrets,
              [command.playerId]: (state.secrets[command.playerId] ?? 0) + command.amount,
            },
          },
        }
      }

      return {
        accepted: true,
        changed: true,
        state: { ...state, count: state.count + command.amount },
        roomEffects: [{
          type: 'open_barrier',
          id: command.id,
          barrierType: command.barrierType,
          expectedPlayerIds: command.expectedPlayerIds,
        }],
      }
    },

    projectPublic: (state) => ({ count: state.count }),

    projectPrivate: (state, playerId) => ({
      secret: state.secrets[playerId] ?? 0,
    }),
  }
}

function requireBootstrap(
  network: TestNetwork,
  connectionId: ConnectionId,
): InMemoryBootstrap<TestPublicState, TestPrivateState> {
  const bootstrap = network.bootstrapClient(connectionId)
  if (!bootstrap) throw new Error('Expected bootstrap to succeed.')
  return bootstrap
}

function deliverClientCommand(network: TestNetwork, commandId: string): void {
  network.deliverPacket(clientCommandPacket(network, commandId).id)
}

function deliverAllAuthorityPackets(network: TestNetwork): void {
  const ids = network.pending()
    .filter((packet) => packet.direction === 'authority_to_client')
    .map((packet) => packet.id)
  for (const id of ids) network.deliverPacket(id)
}

function createGapAtRevision4(network: TestNetwork, a: TestClient): void {
  a.send('gap-1', 'increment', { amount: 1 })
  deliverClientCommand(network, 'gap-1')
  network.dropPacket(authorityEventPacket(network, a.getConnectionId(), 3).id)
  deliverAllAuthorityPackets(network)

  a.send('gap-2', 'increment', { amount: 1 })
  deliverClientCommand(network, 'gap-2')
  network.deliverPacket(authorityEventPacket(network, a.getConnectionId(), 4).id)
}

function requestSnapshot(network: TestNetwork, client: TestClient) {
  client.requestResync()
  network.deliverPacket(resyncPacket(network, client.getConnectionId()).id)
  const packet = snapshotPacket(network, client.getConnectionId())
  const message = snapshotMessage(packet)
  network.deliverPacket(packet.id)
  return message
}

function currentSnapshot(
  runtime: TestRuntime,
  network: TestNetwork,
  client: TestClient,
): Snapshot<TestPublicState, TestPrivateState> {
  const snapshot = requestSnapshot(network, client)
  expect(snapshot.revision).toBe(runtime.getRevision())
  return snapshot
}

function clientCommandPacket(network: TestNetwork, commandId: string): TestPacket {
  return requirePacket(network, (packet) =>
    packet.direction === 'client_to_authority'
    && packet.payload.kind === 'command'
    && packet.payload.command.commandId === commandId)
}

function resyncPacket(network: TestNetwork, connectionId: ConnectionId): TestPacket {
  return requirePacket(network, (packet) =>
    packet.direction === 'client_to_authority'
    && packet.connectionId === connectionId
    && packet.payload.kind === 'resync')
}

function commandResultPacket(
  network: TestNetwork,
  connectionId: ConnectionId,
  commandId: string,
): TestPacket {
  return requirePacket(network, (packet) => {
    if (packet.direction !== 'authority_to_client') return false
    if (packet.connectionId !== connectionId) return false
    const message = packet.payload.message
    return isCommandResult(message) && message.commandId === commandId
  })
}

function authorityEventPacket(
  network: TestNetwork,
  connectionId: ConnectionId,
  revision: number,
): TestPacket {
  return requirePacket(network, (packet) => {
    if (packet.direction !== 'authority_to_client') return false
    if (packet.connectionId !== connectionId) return false
    const message = packet.payload.message
    return isEvent(message) && message.revision === revision
  })
}

function snapshotPacket(
  network: TestNetwork,
  connectionId: ConnectionId,
): TestPacket {
  return requirePacket(network, (packet) => {
    if (packet.direction !== 'authority_to_client') return false
    if (packet.connectionId !== connectionId) return false
    return isSnapshot(packet.payload.message)
  })
}

function pendingCommandResults(
  network: TestNetwork,
  connectionId: ConnectionId,
  commandId: string,
): CommandResult[] {
  return network.pending().flatMap((packet) => {
    if (packet.direction !== 'authority_to_client') return []
    if (packet.connectionId !== connectionId) return []
    const message = packet.payload.message
    if (!isCommandResult(message) || message.commandId !== commandId) return []
    return [message]
  })
}

function requirePacket(
  network: TestNetwork,
  predicate: (packet: TestPacket) => boolean,
): TestPacket {
  const packet = network.pending().find(predicate)
  if (!packet) throw new Error('Expected matching in-memory packet.')
  return packet
}

function eventMessage(packet: TestPacket): Event<TestPublicState, TestPrivateState> {
  if (packet.direction !== 'authority_to_client') {
    throw new Error('Expected authority packet.')
  }
  const message = packet.payload.message
  if (!isEvent(message)) throw new Error('Expected Event message.')
  return message
}

function commandResultMessage(packet: TestPacket): CommandResult {
  if (packet.direction !== 'authority_to_client') {
    throw new Error('Expected authority packet.')
  }
  const message = packet.payload.message
  if (!isCommandResult(message)) throw new Error('Expected CommandResult message.')
  return message
}

function snapshotMessage(packet: TestPacket): Snapshot<TestPublicState, TestPrivateState> {
  if (packet.direction !== 'authority_to_client') {
    throw new Error('Expected authority packet.')
  }
  const message = packet.payload.message
  if (!isSnapshot(message)) throw new Error('Expected Snapshot message.')
  return message
}

function lastEventApplication(client: TestClient): string | boolean | undefined {
  return [...client.received].reverse().find((entry) => isEvent(entry.message))?.result
}

function isCommandResult(
  message: AuthoritativeMessage<TestPublicState, TestPrivateState>,
): message is CommandResult {
  return 'status' in message
}

function isEvent(
  message: AuthoritativeMessage<TestPublicState, TestPrivateState>,
): message is Event<TestPublicState, TestPrivateState> {
  return 'kind' in message
}

function isSnapshot(
  message: AuthoritativeMessage<TestPublicState, TestPrivateState>,
): message is Snapshot<TestPublicState, TestPrivateState> {
  return !isCommandResult(message) && !isEvent(message)
}

function numberField(payload: unknown, field: string): number | null {
  if (!isRecord(payload)) return null
  const value = payload[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringField(payload: unknown, field: string): string | null {
  if (!isRecord(payload)) return null
  const value = payload[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function stringArrayField(payload: unknown, field: string): string[] | null {
  if (!isRecord(payload)) return null
  const value = payload[field]
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
