import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLocales, type SupportedLocale } from '../../i18n'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'

export function useImpostorDaPalavraInitialization() {
  const { i18n } = useTranslation()
  const initialize = useImpostorDaPalavraStore((state) => state.initialize)
  const locale = supportedLocales.includes(i18n.resolvedLanguage as SupportedLocale) ? i18n.resolvedLanguage as SupportedLocale : 'pt-BR'
  useEffect(() => { void initialize(locale) }, [initialize, locale])
}
