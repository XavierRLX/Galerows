import { useEffect } from 'react'
import { AppLifecycle } from '../lib/capacitor/app'
import { SplashScreenService } from '../lib/capacitor/splashScreen'
import { StatusBarService } from '../lib/capacitor/statusBar'

export function useNativeAppSetup() {
  useEffect(() => {
    void StatusBarService.configure()
    void SplashScreenService.hide()
    const removeBackListener = AppLifecycle.onBackButton(() => {
      if (window.history.length > 1) window.history.back()
      else void AppLifecycle.exit()
    })
    return () => { void removeBackListener.then((remove) => remove()) }
  }, [])
}
