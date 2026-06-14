export type PremiumStatus = 'inactive' | 'active'
export type PremiumEntitlement = { status: PremiumStatus; expiresAt?: string }
