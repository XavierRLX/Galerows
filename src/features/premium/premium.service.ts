import { Capacitor } from '@capacitor/core'
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { premiumConfig } from './premium.config'
import type { PremiumAvailability, PremiumOffering, PremiumSnapshot } from './premium.types'

let configurePromise: Promise<PremiumAvailability> | null = null

function canUseStorePurchases() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform())
}

export async function configurePremiumPurchases(): Promise<PremiumAvailability> {
  if (!canUseStorePurchases()) return 'unavailable'
  if (configurePromise) return configurePromise
  configurePromise = configureRevenueCat()
  return configurePromise
}

async function configureRevenueCat(): Promise<PremiumAvailability> {
  const apiKey = premiumConfig.getRevenueCatApiKey()
  if (!apiKey) return 'unavailable'
  try {
    await Purchases.configure({ apiKey })
    return 'available'
  } catch {
    return 'unavailable'
  }
}

export async function getCachedPremiumSnapshot() {
  return LocalPreferences.getJson<PremiumSnapshot>(STORAGE_KEYS.premiumSnapshot)
}

export async function fetchPremiumSnapshot(): Promise<PremiumSnapshot> {
  const availability = await configurePremiumPurchases()
  if (availability === 'unavailable') {
    return {
      status: 'free',
      expiresAt: null,
      checkedAt: new Date().toISOString(),
      managementUrl: null,
    }
  }
  const { customerInfo } = await Purchases.getCustomerInfo()
  return persistCustomerInfo(customerInfo)
}

export async function fetchPremiumOffering(): Promise<PremiumOffering> {
  const availability = await configurePremiumPurchases()
  if (availability === 'unavailable') {
    return { monthlyPackage: null, priceLabel: premiumConfig.fallbackPriceLabel }
  }
  const offerings = await Purchases.getOfferings()
  const monthlyPackage = offerings.current?.monthly ?? findMonthlyPackage(offerings.current?.availablePackages ?? [])
  return {
    monthlyPackage,
    priceLabel: monthlyPackage?.product.priceString ?? premiumConfig.fallbackPriceLabel,
  }
}

export async function purchaseMonthlyPremium(monthlyPackage: PurchasesPackage): Promise<PremiumSnapshot> {
  await configurePremiumPurchases()
  const result = await Purchases.purchasePackage({ aPackage: monthlyPackage })
  return persistCustomerInfo(result.customerInfo)
}

export async function restorePremiumPurchases(): Promise<PremiumSnapshot> {
  await configurePremiumPurchases()
  const result = await Purchases.restorePurchases()
  return persistCustomerInfo(result.customerInfo)
}

function findMonthlyPackage(packages: PurchasesPackage[]) {
  return packages.find((item) => item.product.identifier === premiumConfig.monthlyProductId) ?? packages[0] ?? null
}

async function persistCustomerInfo(customerInfo: CustomerInfo): Promise<PremiumSnapshot> {
  const entitlement = customerInfo.entitlements.active[premiumConfig.entitlementId]
  const snapshot: PremiumSnapshot = {
    status: entitlement?.isActive ? 'premium' : 'free',
    expiresAt: entitlement?.expirationDate ?? null,
    checkedAt: customerInfo.requestDate,
    managementUrl: customerInfo.managementURL,
  }
  await LocalPreferences.setJson(STORAGE_KEYS.premiumSnapshot, snapshot)
  return snapshot
}
