export function isContentAdminEnabled(value: unknown = import.meta.env.VITE_ENABLE_CONTENT_ADMIN) {
  return value === 'true'
}

export const contentAdminEnabled = isContentAdminEnabled()
