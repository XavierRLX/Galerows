import type { SupportedLocale } from '../../i18n'
import type { GameParticipant } from '../players/players.types'

export type TabooMode = 'individual' | 'teams'
export type TabooSkipLimit = 'unlimited' | 1 | 3 | 5
export type TabooPhase = 'turn-intro' | 'playing' | 'turn-summary' | 'round-summary' | 'finished'
export type TabooFinishedReason = 'turns-complete' | 'deck-exhausted'

export type TabooConfig = {
  mode: TabooMode
  turnDurationSeconds: 30 | 60 | 90 | 120
  allowSkips: boolean
  skipLimit: TabooSkipLimit
  roundsPerEntity: number
}

export type TabooTeam = {
  id: string
  name: string
  memberIds: string[]
}

export type TabooTurnResult = {
  turn: number
  entityId: string
  correct: number
  skips: number
  points: number
}

export type TabooOpeningHistory = {
  schemaVersion: 1
  cardId: string
  entityIdentity: string
}

export type TabooSession = {
  schemaVersion: 1
  id: string
  gameId: 'taboo'
  deckId: string
  deckVersion: number
  locale: SupportedLocale
  phase: TabooPhase
  participants: GameParticipant[]
  teams: TabooTeam[]
  config: TabooConfig
  scores: Record<string, number>
  turnQueue: string[]
  currentTurnIndex: number
  currentCardId: string | null
  cardQueue: string[]
  usedCardIds: string[]
  turnStartedAt: string | null
  currentTurnCorrect: number
  skipsUsedThisTurn: number
  lastTurnResult: TabooTurnResult | null
  pendingFinishedReason: TabooFinishedReason | null
  finishedReason: TabooFinishedReason | null
  createdAt: string
  updatedAt: string
}
