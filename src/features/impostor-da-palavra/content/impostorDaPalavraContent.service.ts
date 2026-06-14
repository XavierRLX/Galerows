import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { ImpostorDaPalavraDeck } from './impostorDaPalavraContent.types'
import {
  assertImpostorDaPalavraDeck,
  validateImpostorDaPalavraDeck,
} from './impostorDaPalavraContent.validator'

const packagedDecks: Record<SupportedLocale, unknown> = {
  'pt-BR': ptDeck,
  'en-US': enDeck,
  'es-419': esDeck,
}

export type LoadedImpostorDaPalavraDeck = {
  deck: ImpostorDaPalavraDeck
  source: 'override' | 'packaged' | 'fallback'
  warnings: string[]
}

export async function loadImpostorDaPalavraDeck(
  locale: SupportedLocale,
): Promise<LoadedImpostorDaPalavraDeck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('impostor-da-palavra', locale))
  if (override) {
    const validation = validateImpostorDaPalavraDeck(override, locale)
    if (validation.valid) {
      return { deck: override as ImpostorDaPalavraDeck, source: 'override', warnings: [] }
    }
    const packaged = resolvePackagedImpostorDaPalavraDeck(locale)
    return { ...packaged, warnings: validation.errors }
  }
  return resolvePackagedImpostorDaPalavraDeck(locale)
}

export function resolvePackagedImpostorDaPalavraDeck(
  locale: SupportedLocale,
  sources: Record<SupportedLocale, unknown> = packagedDecks,
): LoadedImpostorDaPalavraDeck {
  const localized = validateImpostorDaPalavraDeck(sources[locale], locale)
  if (localized.valid) {
    return { deck: sources[locale] as ImpostorDaPalavraDeck, source: 'packaged', warnings: [] }
  }
  return {
    deck: assertImpostorDaPalavraDeck(sources['pt-BR'], 'pt-BR'),
    source: 'fallback',
    warnings: localized.errors,
  }
}

export function getPackagedImpostorDaPalavraDecks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertImpostorDaPalavraDeck(deck))
}
