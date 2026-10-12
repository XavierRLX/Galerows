import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { decodeLanFrame, encodeLanFrame } from './lanWire'
import type { LanFrame } from './lanWire'
import { PROTOCOL_VERSION } from '../protocol'
import { decodePersistentLanFrame, encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame } from './lanPersistentWire'

interface NativeSecureClient {
  connect(options: { host: string; port: number; fingerprint: string; hello: string }): Promise<void>
  send(options: { data: string }): Promise<void>
  disconnect(): Promise<void>
  addListener(event: 'secureLanEvent', listener: (event: { type: string; data?: string }) => void): Promise<PluginListenerHandle>
  storeResumeCredential(options: StoredResumeCredential): Promise<void>
  rotateResumeCredential(options: { roomId: string; playerId: string; resumeToken: string; expiresAt: number }): Promise<void>
  connectResume(options: { roomId: string }): Promise<void>
  clearResumeCredential(options: { roomId: string }): Promise<void>
}

export interface StoredResumeCredential {
  roomId: string
  playerId: string
  resumeToken: string
  expiresAt: number
  host: string
  port: number
  fingerprint: string
  /** Legacy credentials lacking this field remain bound to LAN v1 in the native vault. */
  protocolVersion?: 1 | 2
}

const native = registerPlugin<NativeSecureClient>('GalerowsLanSecureClient')

/** A pinned native WSS channel probe. Membership is a later task. */
export class LanSecureNativeClient {
  connect(host: string, port: number, fingerprint: string, roomId: string, inviteToken: string) {
    return native.connect({ host, port, fingerprint,
      hello: encodeLanFrame({ kind: 'hello', protocolVersion: PROTOCOL_VERSION, roomId, inviteToken }) })
  }
  /** TLS pinning is native; a v2 hello never passes through the v1 frame parser. */
  async connectV2(host: string, port: number, fingerprint: string, roomId: string, inviteToken: string) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId) || !/^[0-9a-f]{64}$/.test(inviteToken)) {
      throw new Error('invalid_hello')
    }
    const hello = JSON.stringify({ kind: 'hello', protocolVersion: 2, roomId, inviteToken })
    return native.connect({ host, port, fingerprint, hello })
  }
  send(frame: LanFrame) { return native.send({ data: encodeLanFrame(frame) }) }
  sendV2(frame: PersistentLanFrame) { return native.send({ data: encodePersistentLanFrame(frame) }) }
  disconnect() { return native.disconnect() }
  storeResumeCredential(credential: StoredResumeCredential) { return native.storeResumeCredential(credential) }
  rotateResumeCredential(roomId: string, playerId: string, resumeToken: string, expiresAt: number) {
    return native.rotateResumeCredential({ roomId, playerId, resumeToken, expiresAt })
  }
  connectResume(roomId: string) { return native.connectResume({ roomId }) }
  clearResumeCredential(roomId: string) { return native.clearResumeCredential({ roomId }) }
  onV2Event(listener: (event: { type: string; frame?: PersistentLanFrame }) => void) {
    return native.addListener('secureLanEvent', event => {
      if (event.type === 'message') {
        if (!event.data) { listener({ type: 'invalid_frame' }); return }
        const parsed = decodePersistentLanFrame(event.data)
        if (parsed.ok) listener({ type: 'message', frame: parsed.frame })
        else listener({ type: 'invalid_frame' })
      } else listener({ type: event.type })
    })
  }
  onEvent(listener: (event: { type: string; frame?: LanFrame }) => void) {
    return native.addListener('secureLanEvent', event => {
      if (event.type === 'message') {
        if (!event.data) return
        const parsed = decodeLanFrame(event.data)
        if (parsed.ok) listener({ type: 'message', frame: parsed.frame })
      } else listener({ type: event.type })
    })
  }
}
