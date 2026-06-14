import type { ContentManifest } from '../../content/content.types'

export type TabooDifficulty = 'easy' | 'medium' | 'hard'

export type TabooCard = {
  id: string
  word: string
  forbiddenWords: string[]
  category?: string
  difficulty?: TabooDifficulty
}

export type TabooDeck = ContentManifest<TabooCard>
