import type { ContentManifest } from '../../content/content.types'

export type ImpostorQuestion = {
  id: string
  text: string
}

export type ImpostorWordCard = {
  id: string
  category: string
  word: string
  impostorHint: string
  alternateWord: string
  questionIds: string[]
}

export type ImpostorDaPalavraDeck = ContentManifest<ImpostorWordCard> & {
  questions: ImpostorQuestion[]
}
