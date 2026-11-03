import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export const StatusBarService = {
  async configure() {
    if (!Capacitor.isNativePlatform()) return
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark })
    // Android 16 enforces edge-to-edge; legacy overlay/background calls are ignored.
    if (Capacitor.getPlatform() === 'ios') {
      await StatusBar.setOverlaysWebView({ overlay: true })
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#101014' })
    }
  },
}
