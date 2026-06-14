import type { SupportedLocale } from '../../i18n'
export function formatNumber(value: number, locale: SupportedLocale = 'pt-BR') { return new Intl.NumberFormat(locale).format(value) }
