export type StorePlatform = 'apple' | 'google'

function validStoreUrl(value: unknown, hostname: string) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined
  } catch {
    return undefined
  }
}

// Empty until the official listings are published. Never link to a fake listing.
export const storeLinks: Record<StorePlatform, string | undefined> = {
  apple: validStoreUrl(import.meta.env.VITE_APP_STORE_URL, 'apps.apple.com'),
  google: validStoreUrl(import.meta.env.VITE_GOOGLE_PLAY_URL, 'play.google.com'),
}
