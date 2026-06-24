import type { SupportedLocale } from '../../i18n'
import type { GameParticipant } from '../players/players.types'
import type { Top10Rank } from './content/top10Content.types'

export type Top10Mode = 'individual' | 'teams'
export type Top10RoundsPerEntity = 1 | 2 | 3
export type Top10Phase = 'playing' | 'round-summary' | 'finished'

export type Top10Config = {
  mode: Top10Mode
  roundsPerEntity: Top10RoundsPerEntity
  firstMediatorId: string
}

export type Top10Team = {
  id: string
  name: string
  memberIds: string[]
}

export type Top10RevealedAnswer = {
  rank: Top10Rank
  entityId: string | null
  points: number
  revealedAt: string
}

export type Top10CardHistory = {
  cardId: number
  theme: string
  question: string
  mediatorEntityId: string
  reveals: Top10RevealedAnswer[]
}

export type Top10Session = {
  schemaVersion: 2
  id: string
  gameId: 'top-10'
  deckId: string
  deckVersion: number
  locale: SupportedLocale
  phase: Top10Phase
  participants: GameParticipant[]
  teams: Top10Team[]
  config: Top10Config
  scores: Record<string, number>
  cardQueue: number[]
  currentCardIndex: number
  currentCardId: number | null
  mediatorQueue: string[]
  currentMediatorIndex: number
  currentMediatorId: string
  revealedAnswers: Record<string, Top10RevealedAnswer>
  history: Top10CardHistory[]
  createdAt: string
  updatedAt: string
}
