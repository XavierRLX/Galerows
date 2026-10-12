import { describe, expect, it, vi } from 'vitest'
import { LanClient } from './lanClient'

class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  listeners = new Map<string, ((event: { data?: string }) => void)[]>()
  readonly url: string
  constructor(url: string) { this.url = url; FakeSocket.instances.push(this) }
  addEventListener(type: string, cb: (event: { data?: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb])
  }
  send(data: string) { this.sent.push(data) }
  close() { this.readyState = 3 }
  emit(type: string, event: { data?: string } = {}) {
    for (const cb of this.listeners.get(type) ?? []) cb(event)
  }
}

describe('LAN 4A client', () => {
  it('sends handshake on open and forwards validated messages', async () => {
    FakeSocket.instances = []
    const client = new LanClient({ host: '192.168.1.5', port: 3333, roomId: 'r', inviteToken: 'secret', socketFactory: (url) => new FakeSocket(url) as unknown as WebSocket })
    const received = vi.fn()
    client.subscribe(received)
    const connected = client.connect()
    const socket = FakeSocket.instances[0]
    expect(socket.url).toBe('ws://192.168.1.5:3333/')
    socket.readyState = 1
    socket.emit('open')
    await connected
    expect(JSON.parse(socket.sent[0])).toMatchObject({ kind: 'hello', roomId: 'r', inviteToken: 'secret' })
    socket.emit('message', { data: '{"kind":"pong","protocolVersion":1}' })
    socket.emit('message', { data: 'bad' })
    expect(received).toHaveBeenCalledTimes(1)
    client.disconnect()
    expect(socket.readyState).toBe(3)
  })
  it('rejects invalid endpoints', () => {
    expect(() => new LanClient({ host: 'x/path', port: 3333, roomId: 'r', inviteToken: 't' })).toThrow()
  })
  it('reports socket closure after opening so a rejected invite is visible', async () => {
    FakeSocket.instances = []
    const client = new LanClient({ host: '192.168.1.5', port: 3333, roomId: 'r', inviteToken: 'wrong', socketFactory: (url) => new FakeSocket(url) as unknown as WebSocket })
    const statuses: string[] = []
    client.subscribeStatus(status => statuses.push(status))
    const connecting = client.connect()
    const socket = FakeSocket.instances[0]
    socket.readyState = 1
    socket.emit('open')
    await connecting
    socket.readyState = 3
    socket.emit('close')
    expect(statuses).toEqual(['open', 'closed'])
  })
})
