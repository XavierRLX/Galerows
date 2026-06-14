import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
export const SplashScreenService = { async hide() { if (Capacitor.isNativePlatform()) await SplashScreen.hide() } }
