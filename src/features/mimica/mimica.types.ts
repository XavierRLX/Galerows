import type { SupportedLocale } from '../../i18n'
import type { GameParticipant } from '../players/players.types'
import type { MimicaAction } from './content/mimicaContent.types'

export type MimicaMode = 'individual' | 'teams'
export type MimicaPhase = 'turn-intro' | 'choosing' | 'acting' | 'scoring' | 'turn-summary' | 'round-summary' | 'finished'
export type MimicaFinishedReason = 'turns-complete' | 'deck-exhausted'

export type MimicaConfig = {
  mode: MimicaMode
  useTimer: boolean
  turnDurationSeconds: 30 | 60 | 90 | 120
  roundsPerEntity: number
}

export type MimicaTeam = {
  id: string
  name: string
}

export type MimicaTurnResult = {
  turn: number
  entityId: string
  cardId: string | null
  action: MimicaAction | null
  success: boolean
  actorPoints: number
  guesserId: string | null
  guesserPoints: number
}

export type MimicaOpeningHistory = {
  schemaVersion: 1
  cardId: string
  entityIdentity: string
}

export type MimicaSession = {
  schemaVersion: 1
  id: string
  gameId: 'mimica'
  deckId: string
  deckVersion: number
  locale: SupportedLocale
  phase: MimicaPhase
  participants: GameParticipant[]
  teams: MimicaTeam[]
  config: MimicaConfig
  scores: Record<string, number>
  turnQueue: string[]
  currentTurnIndex: number
  currentCardId: string | null
  selectedActionId: string | null
  cardQueue: string[]
  usedCardIds: string[]
  turnStartedAt: string | null
  lastTurnResult: MimicaTurnResult | null
  pendingFinishedReason: MimicaFinishedReason | null
  finishedReason: MimicaFinishedReason | null
  createdAt: string
  updatedAt: string
}
