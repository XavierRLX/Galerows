import { useEffect } from 'react'
import { hideBanner } from './ads.service'

export function useHideAds() {
  useEffect(() => {
    void hideBanner()
  }, [])
}
