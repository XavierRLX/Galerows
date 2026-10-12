import { Capacitor } from '@capacitor/core'

export function shouldRenderGameApp() {
  if (Capacitor.isNativePlatform()) return true
  // Explicit development access preserves browser testing of the mobile app.
  return import.meta.env.DEV && (
    import.meta.env.VITE_APP_PREVIEW === '1'
    || import.meta.env.VITE_LAN_DIAGNOSTICS === '1'
    || import.meta.env.VITE_LAN_CORE_PROBE === '1'
  )
}
