import { BrowserRouter } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { lanNativeMvpAvailable } from '../features/multiplayer/lan/lanPlatform'
import { FakeAdProvider } from '../features/ads/FakeAdProvider'
import { canDisplayAds } from '../features/ads/ads.visibility'
import { initializeReviewPromptState } from '../features/play-store/reviewPrompt.service'
import { usePremiumStore } from '../features/premium/premium.store'
import { PrivacyNotice } from '../features/privacy/PrivacyNotice'
import { FirstRunGuide } from '../features/onboarding/FirstRunGuide'
import { AppRoutes } from './routes'
import { ScrollToTop } from './ScrollToTop'
import { AsyncErrorNotice, GlobalErrorBoundary } from './AppErrorBoundary'
import { useNativeAppSetup } from './useNativeAppSetup'

// Release builds do not import, mount, or bundle the experimental LAN owner.
const ExperimentalRoomSessionProvider = import.meta.env.VITE_GAMES_FIRST_LAN_ENTRY === '1'
  && import.meta.env.VITE_LAN_PERSISTENT_LOBBY_UI === '1'
  && lanNativeMvpAvailable()
  ? lazy(() => import('../features/multiplayer/lan/lobby/RoomSessionProvider').then(module => ({ default: module.RoomSessionProvider })))
  : null

export function App() {
  useNativeAppSetup()
  const initializePremium = usePremiumStore((state) => state.initializePremium)
  useEffect(() => {
    if (!canDisplayAds()) return
    void initializePremium()
  }, [initializePremium])
  useEffect(() => {
    void initializeReviewPromptState()
  }, [])
  return <BrowserRouter><GlobalErrorBoundary><FakeAdProvider><ScrollToTop /><PrivacyNotice /><FirstRunGuide /><AsyncErrorNotice />
    {ExperimentalRoomSessionProvider
      ? <Suspense fallback={<div className="min-h-dvh bg-[#101014]" role="status" aria-label="Preparando jogos" />}><ExperimentalRoomSessionProvider><AppRoutes /></ExperimentalRoomSessionProvider></Suspense>
      : <AppRoutes />}
  </FakeAdProvider></GlobalErrorBoundary></BrowserRouter>
}
