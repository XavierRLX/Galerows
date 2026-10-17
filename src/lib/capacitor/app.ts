import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export const AppLifecycle = {
  async onBackButton(callback: () => void): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) return () => undefined
    const listener = await App.addListener('backButton', callback)
    return () => { void listener.remove() }
  },
  async onAppStateChange(callback: (isActive: boolean) => void): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) return () => undefined
    const listener = await App.addListener('appStateChange', ({ isActive }) => callback(isActive))
    return () => { void listener.remove() }
  },
  async exit() {
    if (Capacitor.getPlatform() === 'android') await App.exitApp()
  },
}

export type InstalledAppDetails = {
  version: string
  build: string | null
  platform: string
}

/** Capacitor's App.getInfo() reflects the actual installed binary, not package.json. */
export async function getInstalledAppDetails(): Promise<InstalledAppDetails> {
  const platform = Capacitor.getPlatform()
  const fallbackVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) || '—'
  if (!Capacitor.isNativePlatform()) {
    return { version: fallbackVersion, build: null, platform }
  }

  try {
    const { version, build } = await App.getInfo()
    return { version, build: build || null, platform }
  } catch {
    // Settings and the recovery screen must still render if a native plugin fails.
    return { version: fallbackVersion, build: null, platform }
  }
}

/** Kept for existing callers; native metadata has only one implementation. */
export async function getInstalledAppVersion(): Promise<string> {
  return (await getInstalledAppDetails()).version
}
