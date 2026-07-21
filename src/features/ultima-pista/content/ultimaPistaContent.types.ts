import type { ContentManifest } from '../../content/content.types'

export type UltimaPistaCard = {
  id: number
  title: string
  prompt: string
  story: string
  essentialFacts: string[]
}

export type UltimaPistaDeck = ContentManifest<UltimaPistaCard>
