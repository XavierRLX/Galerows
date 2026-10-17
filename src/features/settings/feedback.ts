import type { InstalledAppDetails } from '../../lib/capacitor/app'

export const SUPPORT_EMAIL = 'galerowsjdg@gmail.com'

/** Only static app metadata is included. No logs, identities, sessions or secrets. */
export function createFeedbackMailto(details: InstalledAppDetails, locale: string): string {
  const isPortuguese = locale === 'pt-BR'
  const isSpanish = locale === 'es-419'
  const subject = isPortuguese ? 'Galerows — Relatar problema'
    : isSpanish ? 'Galerows — Reportar un problema'
      : 'Galerows — Report a problem'
  const platform = details.platform === 'android' ? 'Android'
    : details.platform === 'ios' ? 'iOS' : 'Web'
  const labels = isPortuguese
    ? { version: 'Versão', build: 'Build', platform: 'Plataforma', details: 'Descreva o que aconteceu:' }
    : isSpanish
      ? { version: 'Versión', build: 'Compilación', platform: 'Plataforma', details: 'Describe qué ocurrió:' }
      : { version: 'Version', build: 'Build', platform: 'Platform', details: 'Describe what happened:' }
  const body = [
    labels.details,
    '',
    '',
    '---',
    `${labels.version}: ${details.version}`,
    `${labels.build}: ${details.build || '—'}`,
    `${labels.platform}: ${platform}`,
  ].join('\n')
  return `mailto:${SUPPORT_EMAIL}?${new URLSearchParams({ subject, body }).toString()}`
}
