import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { Top10Deck } from './top10Content.types'
import { assertTop10Deck, validateTop10Deck } from './top10Content.validator'

const packagedDecks: Record<SupportedLocale, unknown> = { 'pt-BR': ptDeck, 'en-US': enDeck, 'es-419': esDeck }

export type LoadedTop10Deck = { deck: Top10Deck; source: 'override' | 'packaged' | 'fallback'; warnings: string[] }

export async function loadTop10Deck(locale: SupportedLocale): Promise<LoadedTop10Deck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('top-10', locale))
  if (override) {
    const validation = validateTop10Deck(override, locale)
    if (validation.valid) return { deck: override as Top10Deck, source: 'override', warnings: [] }
  }
  return resolvePackagedTop10Deck(locale)
}

export function resolvePackagedTop10Deck(locale: SupportedLocale, sources: Record<SupportedLocale, unknown> = packagedDecks): LoadedTop10Deck {
  const localized = validateTop10Deck(sources[locale], locale)
  if (localized.valid) return { deck: sources[locale] as Top10Deck, source: 'packaged', warnings: [] }
  return { deck: assertTop10Deck(sources['pt-BR'], 'pt-BR'), source: 'fallback', warnings: localized.errors }
}

export function getPackagedTop10Decks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertTop10Deck(deck))
}
