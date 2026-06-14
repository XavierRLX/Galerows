import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
export const StatusBarService = { async configure() { if (!Capacitor.isNativePlatform()) return; await StatusBar.setStyle({ style: Style.Light }); await StatusBar.setBackgroundColor({ color: '#111827' }) } }
