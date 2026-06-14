import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export const StatusBarService = {
  async configure() {
    if (!Capacitor.isNativePlatform()) return
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark })
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#020617' })
  },
}
