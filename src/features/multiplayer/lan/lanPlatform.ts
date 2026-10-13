import { Capacitor } from '@capacitor/core'

/** G8 iOS safety gate: Bonjour discovery alone does NOT provide the
 * pinned WSS guest, Keystore/Keychain resume, or native TLS host.
 * Keep LAN routes/entry disabled on iOS until all matching plugins pass gates.
 * This gate does not apply to local/pass-the-phone games.
 */
export function lanNativeMvpAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}
