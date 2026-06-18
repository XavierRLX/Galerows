import { Capacitor } from '@capacitor/core'

export const premiumConfig = {
  entitlementId: 'premium',
  fallbackPriceLabel: 'R$ 4,99',
  monthlyProductId: 'plano_premium_mensal',
  getRevenueCatApiKey() {
    const platform = Capacitor.getPlatform()
    if (platform === 'android') return import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined
    if (platform === 'ios') return import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined
    return undefined
  },
}
