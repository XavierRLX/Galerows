import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type PlayStoreUpdateInfo = {
  available: boolean
  developerTriggeredUpdateInProgress: boolean
  flexibleAllowed: boolean
  immediateAllowed: boolean
  updatePriority: number
  clientVersionStalenessDays: number | null
  availableVersionCode: number
  installStatus: number
  downloaded: boolean
}

type PlayStorePlugin = {
  checkForUpdate: () => Promise<PlayStoreUpdateInfo>
  startFlexibleUpdate: () => Promise<{ started: boolean }>
  startImmediateUpdate: () => Promise<{ started: boolean }>
  completeFlexibleUpdate: () => Promise<{ completed: boolean }>
  requestInAppReview: () => Promise<{ attempted: boolean }>
  openPlayStoreListing: () => Promise<{ opened: boolean }>
  addListener: (eventName: 'updateStateChanged', listenerFunc: (state: Partial<PlayStoreUpdateInfo> & { bytesDownloaded?: number; totalBytesToDownload?: number }) => void) => Promise<PluginListenerHandle>
}

const NativePlayStore = registerPlugin<PlayStorePlugin>('PlayStore')
const unavailableUpdateInfo: PlayStoreUpdateInfo = {
  available: false,
  developerTriggeredUpdateInProgress: false,
  flexibleAllowed: false,
  immediateAllowed: false,
  updatePriority: 0,
  clientVersionStalenessDays: null,
  availableVersionCode: 0,
  installStatus: 0,
  downloaded: false,
}

export function canUseNativeAndroidPlayStore() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export const PlayStore = {
  async checkForUpdate(): Promise<PlayStoreUpdateInfo> {
    if (!canUseNativeAndroidPlayStore()) return unavailableUpdateInfo
    try {
      return await NativePlayStore.checkForUpdate()
    } catch {
      return unavailableUpdateInfo
    }
  },

  async startFlexibleUpdate(): Promise<boolean> {
    if (!canUseNativeAndroidPlayStore()) return false
    try {
      const result = await NativePlayStore.startFlexibleUpdate()
      return result.started
    } catch {
      return false
    }
  },

  async startImmediateUpdate(): Promise<boolean> {
    if (!canUseNativeAndroidPlayStore()) return false
    try {
      const result = await NativePlayStore.startImmediateUpdate()
      return result.started
    } catch {
      return false
    }
  },

  async completeFlexibleUpdate(): Promise<boolean> {
    if (!canUseNativeAndroidPlayStore()) return false
    try {
      const result = await NativePlayStore.completeFlexibleUpdate()
      return result.completed
    } catch {
      return false
    }
  },

  async requestInAppReview(): Promise<boolean> {
    if (!canUseNativeAndroidPlayStore()) return false
    try {
      const result = await NativePlayStore.requestInAppReview()
      return result.attempted
    } catch {
      return false
    }
  },

  async openPlayStoreListing(): Promise<boolean> {
    if (!canUseNativeAndroidPlayStore()) return false
    try {
      const result = await NativePlayStore.openPlayStoreListing()
      return result.opened
    } catch {
      return false
    }
  },

  async onUpdateStateChanged(listener: (state: Partial<PlayStoreUpdateInfo> & { bytesDownloaded?: number; totalBytesToDownload?: number }) => void): Promise<() => void> {
    if (!canUseNativeAndroidPlayStore()) return () => undefined
    try {
      const handle = await NativePlayStore.addListener('updateStateChanged', listener)
      return () => { void handle.remove() }
    } catch {
      return () => undefined
    }
  },
}
