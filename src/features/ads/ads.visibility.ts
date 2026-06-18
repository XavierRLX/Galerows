export const adsTemporarilyHidden = true

export function canDisplayAds() {
  return !adsTemporarilyHidden
}
