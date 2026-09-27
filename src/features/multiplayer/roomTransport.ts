import type {
  AuthoritativeMessage,
  Command,
  ResyncRequest,
} from './protocol'

export interface RoomTransport<TPublic, TPrivate> {
  connect(): void | Promise<void>
  disconnect(): void | Promise<void>
  sendCommand(command: Command): void | Promise<void>
  sendResyncRequest(request: ResyncRequest): void | Promise<void>
  subscribe(
    listener: (message: AuthoritativeMessage<TPublic, TPrivate>) => void,
  ): () => void
}
