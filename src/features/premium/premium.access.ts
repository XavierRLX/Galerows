let premiumActive = false

export function isPremiumActive() {
  return premiumActive
}

export function setPremiumActiveForRuntime(active: boolean) {
  premiumActive = active
}
