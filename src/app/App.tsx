import { BrowserRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { FakeAdProvider } from '../features/ads/FakeAdProvider'
import { canDisplayAds } from '../features/ads/ads.visibility'
import { initializeReviewPromptState } from '../features/play-store/reviewPrompt.service'
import { usePremiumStore } from '../features/premium/premium.store'
import { AppRoutes } from './routes'
import { ScrollToTop } from './ScrollToTop'
import { useNativeAppSetup } from './useNativeAppSetup'

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
  return <BrowserRouter><FakeAdProvider><ScrollToTop /><AppRoutes /></FakeAdProvider></BrowserRouter>
}
