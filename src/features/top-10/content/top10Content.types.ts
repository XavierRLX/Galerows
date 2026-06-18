import type { ContentManifest } from '../../content/content.types'

export type Top10Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type Top10Answer = {
  rank: Top10Rank
  label: string
  note?: string
}

export type Top10Card = {
  id: number
  theme: string
  question: string
  answers: Top10Answer[]
}

export type Top10Deck = ContentManifest<Top10Card>
