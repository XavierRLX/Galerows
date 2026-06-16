import { useEffect } from 'react'
import type { AdBannerPlacement } from './ads.types'
import { removeBanner, showBanner } from './ads.service'

export function useAdBanner(placement: AdBannerPlacement) {
  useEffect(() => {
    void showBanner(placement)
    return () => {
      void removeBanner()
    }
  }, [placement])
}
