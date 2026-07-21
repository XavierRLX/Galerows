import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LocalPreferences } from '../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../lib/storage/storage.keys'
import enCommon from './locales/en-US/common.json'
import enAdedonha from './locales/en-US/adedonha.json'
import enHub from './locales/en-US/hub.json'
import enCidadeDorme from './locales/en-US/cidade-dorme.json'
import enImpostorDaPalavra from './locales/en-US/impostor-da-palavra.json'
import enMimica from './locales/en-US/mimica.json'
import enNemFerrando from './locales/en-US/nem-ferrando.json'
import enQuemSouEu from './locales/en-US/quem-sou-eu.json'
import enTaboo from './locales/en-US/taboo.json'
import enTop10 from './locales/en-US/top-10.json'
import enUltimaPista from './locales/en-US/ultima-pista.json'
import esCommon from './locales/es-419/common.json'
import esAdedonha from './locales/es-419/adedonha.json'
import esHub from './locales/es-419/hub.json'
import esCidadeDorme from './locales/es-419/cidade-dorme.json'
import esImpostorDaPalavra from './locales/es-419/impostor-da-palavra.json'
import esMimica from './locales/es-419/mimica.json'
import esNemFerrando from './locales/es-419/nem-ferrando.json'
import esQuemSouEu from './locales/es-419/quem-sou-eu.json'
import esTaboo from './locales/es-419/taboo.json'
import esTop10 from './locales/es-419/top-10.json'
import esUltimaPista from './locales/es-419/ultima-pista.json'
import ptCommon from './locales/pt-BR/common.json'
import ptAdedonha from './locales/pt-BR/adedonha.json'
import ptHub from './locales/pt-BR/hub.json'
import ptCidadeDorme from './locales/pt-BR/cidade-dorme.json'
import ptImpostorDaPalavra from './locales/pt-BR/impostor-da-palavra.json'
import ptMimica from './locales/pt-BR/mimica.json'
import ptNemFerrando from './locales/pt-BR/nem-ferrando.json'
import ptQuemSouEu from './locales/pt-BR/quem-sou-eu.json'
import ptPistaUnica from './locales/pt-BR/pista-unica.json'
import ptTaboo from './locales/pt-BR/taboo.json'
import ptTop10 from './locales/pt-BR/top-10.json'
import ptUltimaPista from './locales/pt-BR/ultima-pista.json'

export const supportedLocales = ['pt-BR', 'en-US', 'es-419'] as const
export type SupportedLocale = (typeof supportedLocales)[number]
const resources = {
  'pt-BR': { common: ptCommon, hub: ptHub, adedonha: ptAdedonha, 'cidade-dorme': ptCidadeDorme, 'nem-ferrando': ptNemFerrando, 'impostor-da-palavra': ptImpostorDaPalavra, taboo: ptTaboo, mimica: ptMimica, 'quem-sou-eu': ptQuemSouEu, 'pista-unica': ptPistaUnica, 'top-10': ptTop10, 'ultima-pista': ptUltimaPista },
  'en-US': { common: enCommon, hub: enHub, adedonha: enAdedonha, 'cidade-dorme': enCidadeDorme, 'nem-ferrando': enNemFerrando, 'impostor-da-palavra': enImpostorDaPalavra, taboo: enTaboo, mimica: enMimica, 'quem-sou-eu': enQuemSouEu, 'top-10': enTop10, 'ultima-pista': enUltimaPista },
  'es-419': { common: esCommon, hub: esHub, adedonha: esAdedonha, 'cidade-dorme': esCidadeDorme, 'nem-ferrando': esNemFerrando, 'impostor-da-palavra': esImpostorDaPalavra, taboo: esTaboo, mimica: esMimica, 'quem-sou-eu': esQuemSouEu, 'top-10': esTop10, 'ultima-pista': esUltimaPista },
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
