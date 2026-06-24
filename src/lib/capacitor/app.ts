import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
export const AppLifecycle = {
  async onBackButton(callback: () => void): Promise<() => void> { if (!Capacitor.isNativePlatform()) return () => undefined; const listener = await App.addListener('backButton', callback); return () => { void listener.remove() } },
  async onAppStateChange(callback: (isActive: boolean) => void): Promise<() => void> { if (!Capacitor.isNativePlatform()) return () => undefined; const listener = await App.addListener('appStateChange', ({ isActive }) => callback(isActive)); return () => { void listener.remove() } },
  async exit() { if (Capacitor.getPlatform() === 'android') await App.exitApp() },
}

export async function getInstalledAppVersion() {
  if (!Capacitor.isNativePlatform()) return import.meta.env.VITE_APP_VERSION as string
  const info = await App.getInfo()
  return info.version
}
