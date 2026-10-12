import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { decodeLanFrame, encodeLanFrame } from './lanWire'
import type { LanFrame } from './lanWire'
import { decodePersistentLanFrame, encodePersistentLanFrame } from './lanPersistentWire'
import type { PersistentLanFrame } from './lanPersistentWire'

interface NativeLanServer {
  discoverLanAddress(): Promise<{ ip: string; interfaceName: string }>
  start(options: { roomId: string; inviteToken: string; port?: number }): Promise<{ port: number }>
  startSecure(options: { roomId: string; inviteToken: string; port?: number; protocolVersion?: 1 | 2 }): Promise<{ port: number; fingerprint: string }>
  stop(): Promise<void>
  rotateInviteToken(options: { inviteToken: string }): Promise<void>
  registerResumeToken(options: { playerId: string; resumeToken: string; expiresAt: number }): Promise<void>
  revokeResumeToken(options: { playerId: string; resumeToken: string }): Promise<void>
  closePeer(options: { peerId: string }): Promise<void>
  send(options: { peerId: string; data: string }): Promise<void>
  addListener(event: 'lanEvent', listener: (event: { type: string; peerId: string; data?: string }) => void): Promise<PluginListenerHandle>
}

const native = registerPlugin<NativeLanServer>('GalerowsLanServer')

/** Android native host bridge; caller must enforce room authority and peer identity. */
export class LanNativeHost {
  discoverLanAddress() { return native.discoverLanAddress() }
  start(roomId: string, inviteToken: string, port = 0) {
    return native.start({ roomId, inviteToken, port })
  }
  startSecure(roomId: string, inviteToken: string, port = 0) {
    return native.startSecure({ roomId, inviteToken, port })
  }
  /** Explicitly isolated v2 Room; existing startSecure remains default v1. */
  startSecureV2(roomId: string, inviteToken: string, port = 0) {
    return native.startSecure({ roomId, inviteToken, port, protocolVersion: 2 })
  }
  stop() { return native.stop() }
  rotateInviteToken(inviteToken: string) { return native.rotateInviteToken({ inviteToken }) }
  registerResumeToken(playerId: string, resumeToken: string, expiresAt: number) {
    return native.registerResumeToken({ playerId, resumeToken, expiresAt })
  }
  revokeResumeToken(playerId: string, resumeToken: string) {
    return native.revokeResumeToken({ playerId, resumeToken })
  }
  closePeer(peerId: string) { return native.closePeer({ peerId }) }
  send(peerId: string, frame: LanFrame) { return native.send({ peerId, data: encodeLanFrame(frame) }) }
  sendV2(peerId: string, frame: PersistentLanFrame) {
    return native.send({ peerId, data: encodePersistentLanFrame(frame) })
  }
  onV2Event(listener: (event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) {
    return native.addListener('lanEvent', event => {
      if (event.type === 'message') {
        if (!event.data) { listener({ type: 'invalid_frame', peerId: event.peerId }); return }
        const parsed = decodePersistentLanFrame(event.data)
        if (parsed.ok) listener({ type: 'message', peerId: event.peerId, frame: parsed.frame })
        else listener({ type: 'invalid_frame', peerId: event.peerId })
      } else listener({ type: event.type, peerId: event.peerId })
    })
  }
  onEvent(listener: (event: { type: string; peerId: string; frame?: LanFrame }) => void) {
    return native.addListener('lanEvent', event => {
      if (event.type === 'message') {
        if (!event.data) return
        const parsed = decodeLanFrame(event.data)
        if (parsed.ok) listener({ type: 'message', peerId: event.peerId, frame: parsed.frame })
      } else listener({ type: event.type, peerId: event.peerId })
    })
  }
}
