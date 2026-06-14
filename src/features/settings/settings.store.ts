import { create } from 'zustand'
import i18n, { supportedLocales, type SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'

type SettingsState = { locale: SupportedLocale; setLocale: (locale: SupportedLocale) => Promise<void> }
function currentLocale(): SupportedLocale { const language = i18n.resolvedLanguage as SupportedLocale | undefined; return supportedLocales.includes(language ?? 'pt-BR') ? language ?? 'pt-BR' : 'pt-BR' }
export const useSettingsStore = create<SettingsState>((set) => ({ locale: currentLocale(), setLocale: async (locale) => { await LocalPreferences.setJson(STORAGE_KEYS.locale, locale); await i18n.changeLanguage(locale); document.documentElement.lang = locale; set({ locale }) } }))
