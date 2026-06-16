import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LocalPreferences } from '../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../lib/storage/storage.keys'
import enCommon from './locales/en-US/common.json'
import enHub from './locales/en-US/hub.json'
import enImpostorDaPalavra from './locales/en-US/impostor-da-palavra.json'
import enMimica from './locales/en-US/mimica.json'
import enNemFerrando from './locales/en-US/nem-ferrando.json'
import enQuemSouEu from './locales/en-US/quem-sou-eu.json'
import enTaboo from './locales/en-US/taboo.json'
import esCommon from './locales/es-419/common.json'
import esHub from './locales/es-419/hub.json'
import esImpostorDaPalavra from './locales/es-419/impostor-da-palavra.json'
import esMimica from './locales/es-419/mimica.json'
import esNemFerrando from './locales/es-419/nem-ferrando.json'
import esQuemSouEu from './locales/es-419/quem-sou-eu.json'
import esTaboo from './locales/es-419/taboo.json'
import ptCommon from './locales/pt-BR/common.json'
import ptHub from './locales/pt-BR/hub.json'
import ptImpostorDaPalavra from './locales/pt-BR/impostor-da-palavra.json'
import ptMimica from './locales/pt-BR/mimica.json'
import ptNemFerrando from './locales/pt-BR/nem-ferrando.json'
import ptQuemSouEu from './locales/pt-BR/quem-sou-eu.json'
import ptTaboo from './locales/pt-BR/taboo.json'

export const supportedLocales = ['pt-BR', 'en-US', 'es-419'] as const
export type SupportedLocale = (typeof supportedLocales)[number]
const resources = {
  'pt-BR': { common: ptCommon, hub: ptHub, 'nem-ferrando': ptNemFerrando, 'impostor-da-palavra': ptImpostorDaPalavra, taboo: ptTaboo, mimica: ptMimica, 'quem-sou-eu': ptQuemSouEu },
  'en-US': { common: enCommon, hub: enHub, 'nem-ferrando': enNemFerrando, 'impostor-da-palavra': enImpostorDaPalavra, taboo: enTaboo, mimica: enMimica, 'quem-sou-eu': enQuemSouEu },
  'es-419': { common: esCommon, hub: esHub, 'nem-ferrando': esNemFerrando, 'impostor-da-palavra': esImpostorDaPalavra, taboo: esTaboo, mimica: esMimica, 'quem-sou-eu': esQuemSouEu },
}
function isSupportedLocale(value: unknown): value is SupportedLocale { return typeof value === 'string' && supportedLocales.includes(value as SupportedLocale) }

export async function initializeI18n() {
  if (i18n.isInitialized) return i18n
  const savedLocale = await LocalPreferences.getJson<SupportedLocale>(STORAGE_KEYS.locale)
  const locale = isSupportedLocale(savedLocale) ? savedLocale : 'pt-BR'
  await i18n.use(initReactI18next).init({ resources, lng: locale, fallbackLng: 'pt-BR', defaultNS: 'common', interpolation: { escapeValue: false } })
  document.documentElement.lang = locale
  return i18n
}
export default i18n
