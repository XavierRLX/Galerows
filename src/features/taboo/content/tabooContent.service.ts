import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { TabooDeck } from './tabooContent.types'
import { assertTabooDeck, validateTabooDeck } from './tabooContent.validator'

const packagedDecks: Record<SupportedLocale, unknown> = {
  'pt-BR': ptDeck,
  'en-US': enDeck,
  'es-419': esDeck,
}

export type LoadedTabooDeck = { deck: TabooDeck; source: 'override' | 'packaged' | 'fallback'; warnings: string[] }

export async function loadTabooDeck(locale: SupportedLocale): Promise<LoadedTabooDeck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('taboo', locale))
  if (override) {
    const validation = validateTabooDeck(override, locale)
    if (validation.valid) return { deck: override as TabooDeck, source: 'override', warnings: [] }
  }
  const localized = validateTabooDeck(packagedDecks[locale], locale)
  if (localized.valid) return { deck: packagedDecks[locale] as TabooDeck, source: 'packaged', warnings: [] }
  return { deck: assertTabooDeck(packagedDecks['pt-BR'], 'pt-BR'), source: 'fallback', warnings: localized.errors }
}

export function getPackagedTabooDecks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertTabooDeck(deck))
}
