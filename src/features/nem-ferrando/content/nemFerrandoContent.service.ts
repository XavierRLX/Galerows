import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { NemFerrandoDeck } from './nemFerrandoContent.types'
import { assertNemFerrandoDeck, validateNemFerrandoDeck } from './nemFerrandoContent.validator'

const packagedDecks: Record<SupportedLocale, unknown> = { 'pt-BR': ptDeck, 'en-US': enDeck, 'es-419': esDeck }

export type LoadedNemFerrandoDeck = { deck: NemFerrandoDeck; source: 'override' | 'packaged' | 'fallback'; warnings: string[] }

export async function loadNemFerrandoDeck(locale: SupportedLocale): Promise<LoadedNemFerrandoDeck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('nem-ferrando', locale))
  if (override) {
    const validation = validateNemFerrandoDeck(override, locale)
    if (validation.valid) return { deck: override as NemFerrandoDeck, source: 'override', warnings: [] }
  }
  return resolvePackagedNemFerrandoDeck(locale)
}

export function resolvePackagedNemFerrandoDeck(locale: SupportedLocale, sources: Record<SupportedLocale, unknown> = packagedDecks): LoadedNemFerrandoDeck {
  const localized = validateNemFerrandoDeck(sources[locale], locale)
  if (localized.valid) return { deck: sources[locale] as NemFerrandoDeck, source: 'packaged', warnings: [] }
  return { deck: assertNemFerrandoDeck(sources['pt-BR'], 'pt-BR'), source: 'fallback', warnings: localized.errors }
}

export function getPackagedNemFerrandoDecks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertNemFerrandoDeck(deck))
}
