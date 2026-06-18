import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'

export type PremiumStatus = 'free' | 'premium'
export type PremiumAvailability = 'available' | 'unavailable'

export type PremiumSnapshot = {
  status: PremiumStatus
  expiresAt: string | null
  checkedAt: string
  managementUrl: string | null
}

export type PremiumOffering = {
  monthlyPackage: PurchasesPackage | null
  priceLabel: string
}
