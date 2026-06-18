import { useEffect } from 'react'
import type { AdBannerPlacement } from './ads.types'
import { removeBanner, showBanner } from './ads.service'
import { canDisplayAds } from './ads.visibility'

export function useAdBanner(placement: AdBannerPlacement) {
  useEffect(() => {
    if (!canDisplayAds()) {
      void removeBanner()
      return
    }
    void showBanner(placement)
    return () => {
      void removeBanner()
    }
  }, [placement])
}
