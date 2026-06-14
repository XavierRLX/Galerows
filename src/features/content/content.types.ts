import type { SupportedLocale } from '../../i18n'

export type ContentManifest<TCard> = {
  schemaVersion: number
  gameId: string
  deckId: string
  locale: SupportedLocale
  version: number
  title: string
  cards: TCard[]
}

export type ContentValidation = {
  valid: boolean
  errors: string[]
}
