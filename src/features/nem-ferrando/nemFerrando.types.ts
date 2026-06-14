import type { SupportedLocale } from '../../i18n'
import type { GameParticipant } from '../players/players.types'

export type NemFerrandoPhase = 'setup' | 'starting' | 'choosing' | 'challenged' | 'revealed' | 'round-summary' | 'finished'
export type IronLimit = 10 | 15 | 20
export type FinishedReason = 'iron-limit' | 'deck-exhausted'

export type NemFerrandoRoundResult = {
  participantId: string
  irons: number
  previousScore: number
  newScore: number
}

export type NemFerrandoOpeningHistory = {
  schemaVersion: 1
  cardId: string
  playerIdentity: string
}

export type NemFerrandoSession = {
  schemaVersion: 3
  id: string
  gameId: 'nem-ferrando'
  deckId: string
  deckVersion: number
  locale: SupportedLocale
  phase: NemFerrandoPhase
  participants: GameParticipant[]
  scores: Record<string, number>
  currentPlayerIndex: number
  round: number
  ironLimit: IronLimit
  usedCuriosityIds: string[]
  currentCardId: string | null
  cardQueue: string[]
  nextPassCardIds: string[]
  passNumber: number
  passPosition: number
  passSize: number
  selectedCuriosityId: string | null
  swappedThisTurn: boolean
  lastRoundResult: NemFerrandoRoundResult | null
  pendingFinishedReason: FinishedReason | null
  finishedReason: FinishedReason | null
  createdAt: string
  updatedAt: string
}
