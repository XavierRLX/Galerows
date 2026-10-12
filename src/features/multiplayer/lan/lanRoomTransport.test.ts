import { describe, expect, it, vi } from 'vitest'
import { LanRoomTransport } from './lanRoomTransport'
import type { LanFrame } from './lanWire'

function ingress() {
  let listener: ((event: { type: 'message'; frame: LanFrame } | { type: 'closed' }) => void) | undefined
  return {
    sendFrame: vi.fn(async (frame: LanFrame) => { void frame }),
    disconnect: vi.fn(async () => undefined),
    subscribeAdmitted: vi.fn((callback: typeof listener) => { listener = callback; return () => { listener = undefined } }),
    emit: (frame: LanFrame) => listener?.({ type: 'message', frame }),
    close: () => listener?.({ type: 'closed' }),
  }
}
const result = { kind: 'commandResult', result: { protocolVersion: 1, roomId: 'room', commandId: 'c1', status: 'accepted', revision: 2 } } as const
const event = { kind: 'event', event: { protocolVersion: 1, roomId: 'room', revision: 2, kind: 'marker' } } as const
const snapshot = { kind: 'snapshot', snapshot: { protocolVersion: 1, roomId: 'room', revision: 2,
  roomState: { playerIds: ['p1'], barriers: [] }, gamePublicState: { count: 1 }, privateState: { secret: 'a' } } } as const
const command = { protocolVersion: 1 as const, roomId: 'room', playerId: 'p1', commandId: 'c1', type: 'add', payload: 1 }

describe('LanRoomTransport', () => {
  it('distinguishes definitive room closure from a lost socket', async () => {
    const native = ingress()
    const reasons: string[] = []
    const transport = new LanRoomTransport(native, 'room', 'p1', reason => reasons.push(reason))
    transport.connect()
    native.emit({ kind: 'roomClosed', protocolVersion: 1, roomId: 'room' })
    await vi.waitFor(() => expect(native.disconnect).toHaveBeenCalledOnce())
    expect(reasons).toEqual(['room_closed'])
    await expect(transport.sendCommand(command)).rejects.toThrow('lan_disconnected')
    const other = ingress()
    const otherReasons: string[] = []
    const lost = new LanRoomTransport(other, 'room', 'p1', reason => otherReasons.push(reason))
    lost.connect(); other.close()
    await vi.waitFor(() => expect(otherReasons).toEqual(['connection_lost']))
  })
  it('buffers authoritative frames until a listener subscribes, preserving result-before-event order', async () => {
    const native = ingress()
    const transport = new LanRoomTransport(native, 'room', 'p1')
    await transport.connect()
    native.emit(result); native.emit(event); native.emit(snapshot)
    const received: unknown[] = []
    transport.subscribe(message => received.push(message))
    expect(received).toEqual([result.result, event.event, snapshot.snapshot])
  })

  it('sends commands and resync through the authenticated channel without changing commandId', async () => {
    const native = ingress()
    const transport = new LanRoomTransport(native, 'room', 'p1')
    await transport.connect()
    await transport.sendCommand(command)
    await transport.sendCommand(command)
    await transport.sendResyncRequest({ protocolVersion: 1, roomId: 'room', playerId: 'p1', lastAppliedRevision: 1 })
    expect(native.sendFrame.mock.calls.map(([frame]) => frame)).toEqual([
      { kind: 'command', command }, { kind: 'command', command },
      { kind: 'resync', request: { protocolVersion: 1, roomId: 'room', playerId: 'p1', lastAppliedRevision: 1 } },
    ])
  })

  it('rejects forged identity, wrong room and incompatible protocol before native send', async () => {
    const native = ingress()
    const transport = new LanRoomTransport(native, 'room', 'p1')
    await transport.connect()
    await expect(transport.sendCommand({ ...command, playerId: 'p2' })).rejects.toThrow('unauthorized')
    await expect(transport.sendCommand({ ...command, roomId: 'other' })).rejects.toThrow('wrong_room')
    await expect(transport.sendCommand({ ...command, protocolVersion: 99 as 1 })).rejects.toThrow('incompatible_protocol')
    native.emit({ kind: 'event', event: { ...event.event, roomId: 'other' } })
    native.emit({ kind: 'event', event: { ...event.event, protocolVersion: 99 } })
    expect(native.sendFrame).not.toHaveBeenCalled()
  })

  it('stops delivering after unsubscribe and rejects sends after socket closure', async () => {
    const native = ingress()
    const transport = new LanRoomTransport(native, 'room', 'p1')
    await transport.connect()
    const received: unknown[] = []
    const unsubscribe = transport.subscribe(message => received.push(message))
    native.emit(event)
    unsubscribe()
    native.close()
    native.emit(snapshot)
    expect(received).toEqual([event.event])
    await vi.waitFor(() => expect(native.disconnect).toHaveBeenCalledOnce())
    await expect(transport.sendCommand(command)).rejects.toThrow('lan_disconnected')
    await transport.disconnect()
    expect(native.disconnect).toHaveBeenCalledOnce()
  })

  it('closes a stalled consumer when the pre-listener buffer reaches its bound', async () => {
    const native = ingress()
    const transport = new LanRoomTransport(native, 'room', 'p1')
    await transport.connect()
    for (let revision = 1; revision <= 65; revision++) native.emit({ kind: 'event', event: { ...event.event, revision } })
    await expect(transport.sendCommand(command)).rejects.toThrow('lan_disconnected')
    expect(native.disconnect).toHaveBeenCalledOnce()
  })

  it('handles a buffered close replayed synchronously during construction', () => {
    const source = ingress()
    source.subscribeAdmitted.mockImplementationOnce(listener => {
      listener?.({ type: 'closed' })
      return () => undefined
    })
    const transport = new LanRoomTransport(source, 'room', 'p1')
    expect(() => transport.connect()).toThrow('lan_disconnected')
  })
})
