import type { SupportedLocale } from '../../i18n'
import type { GameParticipant } from '../players/players.types'

export type ImpostorDaPalavraPhase = 'role-pass' | 'conversation-intro' | 'clue-turn' | 'discussion' | 'accusation' | 'final-guess' | 'round-summary' | 'finished'
export type ImpostorMode = 'no-word' | 'hint' | 'alternate-word'
export type ConversationMode = 'one-word' | 'guided-questions'

export type ImpostorDaPalavraConfig = {
  impostorMode: ImpostorMode
  conversationMode: ConversationMode
}

export type ImpostorDaPalavraAward = {
  participantId: string
  points: number
}

export type ImpostorDaPalavraRoundResult = {
  round: number
  cardId: string
  impostorId: string
  accusedParticipantId: string
  accusationCorrect: boolean
  finalGuessCorrect: boolean | null
  awards: ImpostorDaPalavraAward[]
}

export type ImpostorDaPalavraOpeningHistory = {
  schemaVersion: 1
  cardId: string
  speakerIdentity: string
}

export type ImpostorDaPalavraBriefing =
  | { kind: 'word'; word: string }
  | { kind: 'impostor' }
  | { kind: 'impostor-hint'; hint: string }

export type ImpostorDaPalavraSession = {
  schemaVersion: 1
  id: string
  gameId: 'impostor-da-palavra'
  deckId: string
  deckVersion: number
  locale: SupportedLocale
  phase: ImpostorDaPalavraPhase
  participants: GameParticipant[]
  config: ImpostorDaPalavraConfig
  scores: Record<string, number>
  round: number
  impostorQueue: string[]
  currentImpostorId: string
  currentCardId: string
  cardQueue: string[]
  usedCardIds: string[]
  rolePassOrder: string[]
  rolePassIndex: number
  speakingOrder: string[]
  clueTurnIndex: number
  questionAssignments: Record<string, string>
  accusedParticipantId: string | null
  lastRoundResult: ImpostorDaPalavraRoundResult | null
  createdAt: string
  updatedAt: string
}
