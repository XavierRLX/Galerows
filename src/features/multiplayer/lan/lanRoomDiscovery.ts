import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

/** Passive only: no endpoint, fingerprint, capability or admission data is exposed. */
export type DiscoveredLanRoom = {
  id: string; label: string; roomId: string; code: string
  hostIp: string; port: number; fingerprint: string
}
export type RoomDiscoveryEvent = { type: 'found' | 'lost' | 'error'; id?: string; label?: string
  roomId?: string; code?: string; hostIp?: string; port?: number; fingerprint?: string }

interface NativeRoomDiscovery {
  startScan(): Promise<void>
  stopScan(): Promise<void>
  addListener(event: 'lanRoomDiscovery', listener: (event: RoomDiscoveryEvent) => void): Promise<PluginListenerHandle>
}

const native = registerPlugin<NativeRoomDiscovery>('GalerowsRoomDiscovery')

export const lanRoomDiscovery = {
  start: () => native.startScan(),
  stop: () => native.stopScan(),
  subscribe: (listener: (event: RoomDiscoveryEvent) => void) =>
    native.addListener('lanRoomDiscovery', listener),
}
