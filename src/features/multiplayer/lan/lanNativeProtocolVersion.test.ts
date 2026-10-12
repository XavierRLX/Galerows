import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  server: {
    startSecure: vi.fn(async (...args: unknown[]) => { void args; return { port: 10001, fingerprint: 'a'.repeat(64) } }),
    send: vi.fn(async (...args: unknown[]) => { void args }),
    addListener: vi.fn(async (...args: unknown[]) => { void args; return { remove: async () => undefined } }),
  },
  client: {
    connect: vi.fn(async (...args: unknown[]) => { void args }),
    send: vi.fn(async (...args: unknown[]) => { void args }),
    storeResumeCredential: vi.fn(async (...args: unknown[]) => { void args }),
    addListener: vi.fn(async (...args: unknown[]) => { void args; return { remove: async () => undefined } }),
  },
}))
vi.mock('@capacitor/core', () => ({
  registerPlugin: (name: string) => name === 'GalerowsLanServer' ? native.server : native.client,
}))

import { LanNativeHost } from './lanNativeHost'
import { LanSecureNativeClient } from './lanSecureNativeClient'
import { PERSISTENT_ROOM_PROTOCOL_VERSION } from '../persistentProtocol'
import type { PersistentLanFrame } from './lanPersistentWire'

describe('native protocol version opt-in bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults the original host and client bridges to v1 unchanged', async () => {
    await new LanNativeHost().startSecure('r', 'a'.repeat(64))
    expect(native.server.startSecure).toHaveBeenCalledWith({
      roomId: 'r', inviteToken: 'a'.repeat(64), port: 0,
    })
    await new LanSecureNativeClient().connect('10.1.1.1', 10001, 'b'.repeat(64), 'r', 'a'.repeat(64))
    const call = native.client.connect.mock.calls[0][0] as { hello: string }
    expect(JSON.parse(call.hello)).toEqual({
      kind: 'hello', protocolVersion: 1, roomId: 'r', inviteToken: 'a'.repeat(64),
    })
  })

  it('can opt in to v2 for a secure host without switching any v1 client', async () => {
    const host = new LanNativeHost()
    await host.startSecureV2('r', 'a'.repeat(64))
    expect(native.server.startSecure).toHaveBeenCalledWith({
      roomId: 'r', inviteToken: 'a'.repeat(64), port: 0, protocolVersion: 2,
    })
    const client = new LanSecureNativeClient()
    await client.connectV2('10.1.1.1', 10001, 'b'.repeat(64), 'r', 'a'.repeat(64))
    const call = native.client.connect.mock.calls[0][0] as { hello: string; fingerprint: string }
    expect(JSON.parse(call.hello)).toEqual({ kind: 'hello',
      protocolVersion: PERSISTENT_ROOM_PROTOCOL_VERSION, roomId: 'r', inviteToken: 'a'.repeat(64) })
    expect(call.fingerprint).toBe('b'.repeat(64))
  })

  it('v2 send and receive reject v1 application frames', async () => {
    const host = new LanNativeHost()
    const client = new LanSecureNativeClient()
    const frame: PersistentLanFrame = { kind: 'resyncV2', protocolVersion: 2,
      request: { protocolVersion: 2, roomId: 'r', playerId: 'guest', lastAppliedRevision: 1 } }
    await client.sendV2(frame)
    await host.sendV2('native-peer', frame)
    expect(JSON.parse((native.client.send.mock.calls[0][0] as { data: string }).data)).toEqual(frame)
    expect(JSON.parse((native.server.send.mock.calls[0][0] as { data: string }).data)).toEqual(frame)
    const collected: unknown[] = []
    await client.onV2Event(event => collected.push(event))
    const cb = native.client.addListener.mock.calls[0][1] as (event: unknown) => void
    cb({ type: 'message', data: JSON.stringify(frame) })
    cb({ type: 'message', data: JSON.stringify({ kind: 'roomClosed', protocolVersion: 1, roomId: 'r' }) })
    expect(collected).toEqual([{ type: 'message', frame }])
  })

  it('stores explicitly versioned resume credentials without losing TLS pin', async () => {
    const client = new LanSecureNativeClient()
    const v2 = { roomId: 'r', playerId: 'guest', resumeToken: 'c'.repeat(64),
      expiresAt: Date.now() + 60_000, host: '10.1.1.1', port: 10001,
      fingerprint: 'b'.repeat(64), protocolVersion: 2 as const }
    await client.storeResumeCredential(v2)
    expect(native.client.storeResumeCredential).toHaveBeenCalledWith(v2)
  })

  it('rejects malformed v2 hello before native network call', async () => {
    const client = new LanSecureNativeClient()
    await expect(client.connectV2('10.1.1.1', 10001, 'b'.repeat(64), 'r', 'bad')).rejects.toThrow('invalid_hello')
    expect(native.client.connect).not.toHaveBeenCalled()
  })
})
