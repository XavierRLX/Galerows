import { create } from 'zustand'
import { setPremiumActiveForRuntime } from './premium.access'
import { fetchPremiumOffering, fetchPremiumSnapshot, getCachedPremiumSnapshot, purchaseMonthlyPremium, restorePremiumPurchases } from './premium.service'
import type { PremiumAvailability, PremiumOffering, PremiumSnapshot } from './premium.types'

type PremiumState = {
  availability: PremiumAvailability
  snapshot: PremiumSnapshot | null
  offering: PremiumOffering | null
  loading: boolean
  purchasing: boolean
  restoring: boolean
  error: string | null
  isPremium: boolean
  initializePremium: () => Promise<void>
  refreshPremiumStatus: () => Promise<void>
  purchasePremium: () => Promise<void>
  restorePremium: () => Promise<void>
}

function applySnapshot(snapshot: PremiumSnapshot | null) {
  const isPremium = snapshot?.status === 'premium'
  setPremiumActiveForRuntime(isPremium)
  return { snapshot, isPremium }
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'userCancelled' in error && error.userCancelled) return null
  if (error instanceof Error) return error.message
  return 'premium.errors.generic'
}

export const usePremiumStore = create<PremiumState>((set, get) => ({
  availability: 'unavailable',
  snapshot: null,
  offering: null,
  loading: false,
  purchasing: false,
  restoring: false,
  error: null,
  isPremium: false,

  initializePremium: async () => {
    const cached = await getCachedPremiumSnapshot()
    if (cached) set(applySnapshot(cached))
    set({ loading: true, error: null })
    try {
      const [snapshot, offering] = await Promise.all([fetchPremiumSnapshot(), fetchPremiumOffering()])
      set({ ...applySnapshot(snapshot), offering, availability: offering.monthlyPackage ? 'available' : 'unavailable', loading: false })
    } catch (error) {
      set({ error: errorMessage(error), loading: false })
    }
  },

  refreshPremiumStatus: async () => {
    set({ loading: true, error: null })
    try {
      const snapshot = await fetchPremiumSnapshot()
      set({ ...applySnapshot(snapshot), loading: false })
    } catch (error) {
      set({ error: errorMessage(error), loading: false })
    }
  },

  purchasePremium: async () => {
    const monthlyPackage = get().offering?.monthlyPackage
    if (!monthlyPackage) {
      set({ availability: 'unavailable', error: 'premium.errors.unavailable' })
      return
    }
    set({ purchasing: true, error: null })
    try {
      const snapshot = await purchaseMonthlyPremium(monthlyPackage)
      set({ ...applySnapshot(snapshot), purchasing: false })
    } catch (error) {
      set({ error: errorMessage(error), purchasing: false })
    }
  },

  restorePremium: async () => {
    set({ restoring: true, error: null })
    try {
      const snapshot = await restorePremiumPurchases()
      set({ ...applySnapshot(snapshot), restoring: false })
    } catch (error) {
      set({ error: errorMessage(error), restoring: false })
    }
  },
}))
