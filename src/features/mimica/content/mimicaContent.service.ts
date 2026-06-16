import type { SupportedLocale } from '../../../i18n'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import enDeck from './decks/en-US.json'
import esDeck from './decks/es-419.json'
import ptDeck from './decks/pt-BR.json'
import type { MimicaDeck } from './mimicaContent.types'
import { assertMimicaDeck, validateMimicaDeck } from './mimicaContent.validator'

const packagedDecks: Record<SupportedLocale, unknown> = {
  'pt-BR': ptDeck,
  'en-US': enDeck,
  'es-419': esDeck,
}

export type LoadedMimicaDeck = { deck: MimicaDeck; source: 'override' | 'packaged' | 'fallback'; warnings: string[] }

export async function loadMimicaDeck(locale: SupportedLocale): Promise<LoadedMimicaDeck> {
  const override = await LocalPreferences.getJson<unknown>(contentOverrideKey('mimica', locale))
  if (override) {
    const validation = validateMimicaDeck(override, locale)
    if (validation.valid) return { deck: override as MimicaDeck, source: 'override', warnings: [] }
  }
  const localized = validateMimicaDeck(packagedDecks[locale], locale)
  if (localized.valid) return { deck: packagedDecks[locale] as MimicaDeck, source: 'packaged', warnings: [] }
  return { deck: assertMimicaDeck(packagedDecks['pt-BR'], 'pt-BR'), source: 'fallback', warnings: localized.errors }
}

export function getPackagedMimicaDecks() {
  return (Object.values(packagedDecks) as unknown[]).map((deck) => assertMimicaDeck(deck))
}
