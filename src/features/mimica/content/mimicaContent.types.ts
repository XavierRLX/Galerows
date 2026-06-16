import type { ContentManifest } from '../../content/content.types'

export type MimicaDifficulty = 'easy' | 'medium' | 'hard'

export type MimicaAction = {
  id: string
  label: string
  points: number
}

export type MimicaCard = {
  id: string
  theme: string
  difficulty: MimicaDifficulty
  actions: MimicaAction[]
}

export type MimicaDeck = ContentManifest<MimicaCard>
