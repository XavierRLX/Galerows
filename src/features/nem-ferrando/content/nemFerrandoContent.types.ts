import type { ContentManifest } from '../../content/content.types'

export type NemFerrandoCuriosity = {
  id: string
  question: string
  answer: number
  unit?: string
}

export type NemFerrandoCard = {
  id: string
  number: number
  theme: string
  irons: 1 | 2 | 3 | 4 | 5
  curiosities: NemFerrandoCuriosity[]
}

export type NemFerrandoDeck = ContentManifest<NemFerrandoCard>
