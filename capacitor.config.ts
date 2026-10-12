import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.galerows.app',
  appName: 'Galerows',
  webDir: 'dist',
  backgroundColor: '#020617',
  android: {
    // This is enabled only while building the dedicated LAN diagnostic APK.
    // Capacitor's https://localhost origin otherwise blocks ws:// LAN sockets.
    allowMixedContent: process.env.VITE_LAN_POC_CLEARTEXT === '1',
    // The first store release has no monetization. Keep AdMob and RevenueCat
    // out of the native binary until their respective Play Console releases.
    includePlugins: [
      '@capacitor/app',
      '@capacitor/haptics',
      '@capacitor/network',
      '@capacitor/preferences',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
    ],
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#020617',
    },
  },
}

export default config
