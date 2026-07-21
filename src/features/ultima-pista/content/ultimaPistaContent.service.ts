import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { UltimaPistaDeck } from './ultimaPistaContent.types'
import { assertUltimaPistaDeck, validateUltimaPistaDeck } from './ultimaPistaContent.validator'

const packagedDecks: Record<SupportedLocale, unknown> = { 'pt-BR': ptDeck, 'en-US': enDeck, 'es-419': esDeck }

export type LoadedUltimaPistaDeck = { deck: UltimaPistaDeck; source: 'override' | 'packaged' | 'fallback'; warnings: string[] }

export async function loadUltimaPistaDeck(locale: SupportedLocale): Promise<LoadedUltimaPistaDeck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('ultima-pista', locale))
  if (override) {
    const validation = validateUltimaPistaDeck(override, locale)
    if (validation.valid) return { deck: override as UltimaPistaDeck, source: 'override', warnings: [] }
  }
  return resolvePackagedUltimaPistaDeck(locale)
}

export function resolvePackagedUltimaPistaDeck(locale: SupportedLocale, sources: Record<SupportedLocale, unknown> = packagedDecks): LoadedUltimaPistaDeck {
  const localized = validateUltimaPistaDeck(sources[locale], locale)
  if (localized.valid) return { deck: sources[locale] as UltimaPistaDeck, source: 'packaged', warnings: [] }
  return { deck: assertUltimaPistaDeck(sources['pt-BR'], 'pt-BR'), source: 'fallback', warnings: localized.errors }
}

export function getPackagedUltimaPistaDecks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertUltimaPistaDeck(deck))
}
