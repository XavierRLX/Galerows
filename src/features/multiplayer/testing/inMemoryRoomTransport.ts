import type { RoomTransport } from '../roomTransport'
import type {
  AuthoritativeMessage,
  Command,
  ConnectionId,
  PlayerId,
  ResyncRequest,
  Snapshot,
} from '../protocol'
import type {
  AuthoritativeRoomRuntime,
  JoinResult,
  ResyncSnapshotResult,
} from '../runtime'

type Runtime<TState, TGameCommand, TGamePublic, TPrivate> =
  AuthoritativeRoomRuntime<TState, TGameCommand, TGamePublic, TPrivate>

export type ClientToAuthorityPayload =
  | { kind: 'command'; command: Command }
  | { kind: 'resync'; request: ResyncRequest }

export type InMemoryPacket<TGamePublic, TPrivate> =
  | {
    id: number
    direction: 'client_to_authority'
    connectionId: ConnectionId
    payload: ClientToAuthorityPayload
  }
  | {
    id: number
    direction: 'authority_to_client'
    connectionId: ConnectionId
    payload: {
      kind: 'message'
      message: AuthoritativeMessage<TGamePublic, TPrivate>
    }
  }

export interface InMemoryBootstrap<TGamePublic, TPrivate> {
  playerId: PlayerId
  snapshot: Snapshot<TGamePublic, TPrivate>
  transport: RoomTransport<TGamePublic, TPrivate>
  connectionId: ConnectionId
}

export interface ResyncAttempt<TGamePublic, TPrivate> {
  connectionId: ConnectionId
  result: ResyncSnapshotResult<TGamePublic, TPrivate>
}

export class InMemoryRoomNetwork<
  TState,
  TGameCommand,
  TGamePublic,
  TPrivate,
> {
  private readonly queue: InMemoryPacket<TGamePublic, TPrivate>[] = []
  private readonly endpoints = new Map<
    ConnectionId,
    InMemoryRoomTransport<TGamePublic, TPrivate>
  >()
  private readonly resyncAttempts: ResyncAttempt<TGamePublic, TPrivate>[] = []
  private readonly runtime: Runtime<TState, TGameCommand, TGamePublic, TPrivate>
  private nextPacketId = 1

  constructor(runtime: Runtime<TState, TGameCommand, TGamePublic, TPrivate>) {
    this.runtime = runtime
  }

  bootstrapClient(
    connectionId: ConnectionId,
  ): InMemoryBootstrap<TGamePublic, TPrivate> | null {
    const transport = this.createEndpoint(connectionId)
    transport.connect()

    const joined = this.runtime.join(connectionId)
    if (!joined) {
      transport.disconnect()
      this.endpoints.delete(connectionId)
      return null
    }

    this.enqueueRuntimeDeliveries(joined)
    return {
      playerId: joined.playerId,
      snapshot: joined.snapshot,
      transport,
      connectionId,
    }
  }

  reconnectPlayer(
    playerId: PlayerId,
    connectionId: ConnectionId,
  ): RoomTransport<TGamePublic, TPrivate> | null {
    const transport = this.createEndpoint(connectionId)
    transport.connect()

    if (!this.runtime.reassociate(playerId, connectionId)) {
      transport.disconnect()
      this.endpoints.delete(connectionId)
      return null
    }

    return transport
  }

  pending(): readonly InMemoryPacket<TGamePublic, TPrivate>[] {
    return this.queue
  }

  observedResyncAttempts(): readonly ResyncAttempt<TGamePublic, TPrivate>[] {
    return this.resyncAttempts
  }

  deliverNext(): InMemoryPacket<TGamePublic, TPrivate> | null {
    return this.queue[0] ? this.deliverPacket(this.queue[0].id) : null
  }

  deliverPacket(id: number): InMemoryPacket<TGamePublic, TPrivate> | null {
    const index = this.queue.findIndex((packet) => packet.id === id)
    if (index < 0) return null

    const [packet] = this.queue.splice(index, 1)
    this.deliver(packet)
    return packet
  }

  deliverAll(): void {
    while (this.queue.length > 0) this.deliverNext()
  }

  dropPacket(id: number): InMemoryPacket<TGamePublic, TPrivate> | null {
    const index = this.queue.findIndex((packet) => packet.id === id)
    if (index < 0) return null
    const [packet] = this.queue.splice(index, 1)
    return packet
  }

  duplicatePacket(id: number): number | null {
    const packet = this.queue.find((item) => item.id === id)
    if (!packet) return null

    const duplicate = {
      ...packet,
      id: this.nextPacketId++,
    } as InMemoryPacket<TGamePublic, TPrivate>
    this.queue.push(duplicate)
    return duplicate.id
  }

  movePacket(id: number, targetIndex: number): boolean {
    const currentIndex = this.queue.findIndex((packet) => packet.id === id)
    if (currentIndex < 0) return false

    const [packet] = this.queue.splice(currentIndex, 1)
    const boundedIndex = Math.max(0, Math.min(targetIndex, this.queue.length))
    this.queue.splice(boundedIndex, 0, packet)
    return true
  }

  private createEndpoint(
    connectionId: ConnectionId,
  ): InMemoryRoomTransport<TGamePublic, TPrivate> {
    if (this.endpoints.has(connectionId)) {
      throw new Error('In-memory connection already exists: ' + connectionId)
    }

    const endpoint = new InMemoryRoomTransport<TGamePublic, TPrivate>(
      connectionId,
      (payload) => this.enqueueClientPayload(connectionId, payload),
      () => this.runtime.disconnect(connectionId),
    )
    this.endpoints.set(connectionId, endpoint)
    return endpoint
  }

  private enqueueClientPayload(
    connectionId: ConnectionId,
    payload: ClientToAuthorityPayload,
  ): void {
    this.queue.push({
      id: this.nextPacketId++,
      direction: 'client_to_authority',
      connectionId,
      payload,
    })
  }

  private enqueueAuthorityMessage(
    connectionId: ConnectionId,
    message: AuthoritativeMessage<TGamePublic, TPrivate>,
  ): void {
    const endpoint = this.endpoints.get(connectionId)
    if (!endpoint?.isConnected()) return

    this.queue.push({
      id: this.nextPacketId++,
      direction: 'authority_to_client',
      connectionId,
      payload: { kind: 'message', message },
    })
  }

  private enqueueRuntimeDeliveries(
    joined: JoinResult<TGamePublic, TPrivate>,
  ): void {
    for (const delivery of joined.deliveries) {
      this.enqueueAuthorityMessage(delivery.connectionId, delivery.event)
    }
  }

  private deliver(packet: InMemoryPacket<TGamePublic, TPrivate>): void {
    if (packet.direction === 'authority_to_client') {
      this.endpoints.get(packet.connectionId)?.receive(packet.payload.message)
      return
    }

    if (packet.payload.kind === 'command') {
      const outcome = this.runtime.processCommand(
        packet.payload.command,
        packet.connectionId,
      )
      this.enqueueAuthorityMessage(packet.connectionId, outcome.result)

      for (const delivery of outcome.deliveries) {
        this.enqueueAuthorityMessage(delivery.connectionId, delivery.event)
      }
      return
    }

    const result = this.runtime.createResyncSnapshot(
      packet.payload.request,
      packet.connectionId,
    )
    this.resyncAttempts.push({ connectionId: packet.connectionId, result })

    if (result.ok) {
      this.enqueueAuthorityMessage(packet.connectionId, result.snapshot)
    }
  }
}

class InMemoryRoomTransport<TGamePublic, TPrivate>
implements RoomTransport<TGamePublic, TPrivate> {
  private connected = false
  private readonly listeners = new Set<
    (message: AuthoritativeMessage<TGamePublic, TPrivate>) => void
  >()

  private readonly connectionId: ConnectionId
  private readonly enqueue: (payload: ClientToAuthorityPayload) => void
  private readonly onDisconnect: () => void

  constructor(
    connectionId: ConnectionId,
    enqueue: (payload: ClientToAuthorityPayload) => void,
    onDisconnect: () => void,
  ) {
    this.connectionId = connectionId
    this.enqueue = enqueue
    this.onDisconnect = onDisconnect
  }

  connect(): void {
    this.connected = true
  }

  disconnect(): void {
    if (!this.connected) return
    this.connected = false
    this.onDisconnect()
  }

  sendCommand(command: Command): void {
    this.assertConnected()
    this.enqueue({ kind: 'command', command })
  }

  sendResyncRequest(request: ResyncRequest): void {
    this.assertConnected()
    this.enqueue({ kind: 'resync', request })
  }

  subscribe(
    listener: (message: AuthoritativeMessage<TGamePublic, TPrivate>) => void,
  ): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isConnected(): boolean {
    return this.connected
  }

  receive(message: AuthoritativeMessage<TGamePublic, TPrivate>): void {
    if (!this.connected) return
    for (const listener of this.listeners) listener(message)
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error('In-memory transport is disconnected: ' + this.connectionId)
    }
  }
}
