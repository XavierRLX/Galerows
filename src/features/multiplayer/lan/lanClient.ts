import { decodeLanFrame, encodeLanFrame } from './lanWire'
import type { LanFrame } from './lanWire'
import { PROTOCOL_VERSION } from '../protocol'

export interface LanClientOptions {
  host: string
  port: number
  roomId: string
  inviteToken: string
  socketFactory?: (url: string) => WebSocket
}

/** 4A transport spike. Not yet a RoomTransport or authenticated game session. */
export class LanClient {
  private socket: WebSocket | null = null
  private listeners = new Set<(frame: LanFrame) => void>()
  private statusListeners = new Set<(status: 'open' | 'closed' | 'error') => void>()
  private readonly options: LanClientOptions
  constructor(options: LanClientOptions) {
    this.options = options
    if (!/^[a-zA-Z0-9.:-]+$/.test(options.host) || !Number.isInteger(options.port) || options.port < 1 || options.port > 65535 || !options.roomId || !options.inviteToken) {
      throw new Error('invalid_lan_endpoint')
    }
  }
  connect(): Promise<void> {
    if (this.socket) return Promise.reject(new Error('already_connected'))
    const { host, port, socketFactory } = this.options
    const socket = (socketFactory ?? ((url: string) => new WebSocket(url)))(`ws://${host}:${port}/`)
    this.socket = socket
    return new Promise((resolve, reject) => {
      let settled = false
      socket.addEventListener('open', () => {
        if (settled) return
        settled = true
        socket.send(encodeLanFrame({ kind: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: this.options.roomId, inviteToken: this.options.inviteToken }))
        this.emitStatus('open')
        resolve()
      })
      socket.addEventListener('error', () => {
        this.emitStatus('error')
        if (!settled) { settled = true; this.socket = null; reject(new Error('lan_connection_failed')) }
      })
      socket.addEventListener('close', () => {
        this.emitStatus('closed')
        if (!settled) { settled = true; reject(new Error('lan_connection_closed')) }
        if (this.socket === socket) this.socket = null
      })
      socket.addEventListener('message', (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        const parsed = decodeLanFrame(event.data)
        if (parsed.ok) for (const listener of this.listeners) listener(parsed.frame)
      })
    })
  }
  send(frame: LanFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('lan_not_connected')
    this.socket.send(encodeLanFrame(frame))
  }
  subscribe(listener: (frame: LanFrame) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  subscribeStatus(listener: (status: 'open' | 'closed' | 'error') => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }
  private emitStatus(status: 'open' | 'closed' | 'error') {
    for (const listener of this.statusListeners) listener(status)
  }
  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }
}
