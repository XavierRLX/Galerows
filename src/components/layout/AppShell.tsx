import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { hideBanner, showBanner } from '../../features/ads/ads.service'
import { canDisplayAds } from '../../features/ads/ads.visibility'
import { usePremiumStore } from '../../features/premium/premium.store'
import { SafeArea } from './SafeArea'

export function AppShell() {
  const location = useLocation()
  const isPremium = usePremiumStore((state) => state.isPremium)

  useEffect(() => {
    async function syncAdsToRoute() {
      if (!canDisplayAds()) {
        await hideBanner()
        return
      }
      if (isPremium) {
        await hideBanner()
        return
      }
      const path = location.pathname
      if (path.endsWith('/setup')) {
        await showBanner('setup')
        return
      }
      if (/^\/games\/[^/]+$/.test(path)) {
        await showBanner('game-home')
        return
      }
      await hideBanner()
    }
    void syncAdsToRoute()
  }, [isPremium, location.pathname])

  return <SafeArea className="bg-slate-950 text-white"><main className="mx-auto min-h-dvh w-full max-w-2xl"><Outlet /></main></SafeArea>
}
