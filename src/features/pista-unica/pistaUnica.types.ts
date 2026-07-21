import type { GameParticipant } from '../players/players.types'

export const PISTA_UNICA_CATEGORIES = ['words', 'movies', 'series'] as const
export type PistaUnicaCategory = (typeof PISTA_UNICA_CATEGORIES)[number]
export type PistaUnicaPhase = 'pass-clue' | 'write-clue' | 'review' | 'guess' | 'round-result' | 'finished'

export type PistaUnicaTarget = {
  id: string
  category: PistaUnicaCategory
  title: string
}

export type PistaUnicaClue = {
  id: string
  participantId: string
  text: string
  included: boolean
}

export type PistaUnicaRoundResult = {
  round: number
  guesserId: string
  targetId: string
  correct: boolean
  clueCount: number
}

export type PistaUnicaSession = {
  schemaVersion: 1
  id: string
  gameId: 'pista-unica'
  phase: PistaUnicaPhase
  participants: GameParticipant[]
  selectedCategories: PistaUnicaCategory[]
  scores: Record<string, number>
  round: number
  currentGuesserIndex: number
  currentTargetId: string
  targetQueue: string[]
  usedTargetIds: string[]
  clueOrder: string[]
  clueIndex: number
  clues: PistaUnicaClue[]
  lastRoundResult: PistaUnicaRoundResult | null
  roundResults: PistaUnicaRoundResult[]
  createdAt: string
  updatedAt: string
}
