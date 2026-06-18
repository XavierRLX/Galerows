import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLocales, type SupportedLocale } from '../../i18n'
import { useTop10Store } from './top10.store'

export function useTop10Initialization() {
  const { i18n } = useTranslation()
  const initialize = useTop10Store((state) => state.initialize)
  const locale = supportedLocales.includes(i18n.resolvedLanguage as SupportedLocale) ? i18n.resolvedLanguage as SupportedLocale : 'pt-BR'
  useEffect(() => { void initialize(locale) }, [initialize, locale])
}
