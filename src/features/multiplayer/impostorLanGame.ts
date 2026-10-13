import ptDeck from '../impostor-da-palavra/content/decks/pt-BR.json'
import type { ConversationMode, ImpostorMode } from '../impostor-da-palavra/impostorDaPalavra.types'
import { defineMultiplayerGame } from './multiplayerGames'

export const IMPOSTOR_LAN_GAME_ID = 'impostor-da-palavra'

export interface ImpostorLanConfig {
  impostorMode: ImpostorMode
  conversationMode: ConversationMode
}

export type ImpostorLanStep = 'reveal' | 'clues' | 'discussion' | 'accusation' | 'final-guess' | 'summary'

interface ImpostorLanState {
  config: ImpostorLanConfig
  participants: string[]
  speakingOrder: string[]
  impostorId: string
  word: string
  hint: string
  alternateWord: string
  questions: Record<string, string>
  step: ImpostorLanStep
  seen: string[]
  currentSpeaker: number
  accusedId: string | null
  guessedWord: string | null
  winner: 'impostor' | 'group' | null
  reason: 'not-found' | 'stolen-word' | 'caught' | null
}

export interface ImpostorLanPublic {
  step: ImpostorLanStep
  mode: ImpostorMode
  conversationMode: ConversationMode
  seenCount: number
  totalPlayers: number
  speakingOrder: string[]
  currentSpeaker: string | null
  accusedId: string | null
  winner: 'impostor' | 'group' | null
  reason: 'not-found' | 'stolen-word' | 'caught' | null
  result: { word: string; impostorId: string; guessedWord: string | null;
    points: Record<string, number> } | null
}

export interface ImpostorLanPrivate {
  kind: 'word' | 'impostor' | 'impostor-hint'
  word?: string
  hint?: string
  question?: string
  wasSeen: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function validConfig(value: unknown): value is ImpostorLanConfig {
  return isRecord(value)
    && Object.keys(value).length === 2
    && (value.impostorMode === 'no-word' || value.impostorMode === 'hint' || value.impostorMode === 'alternate-word')
    && (value.conversationMode === 'one-word' || value.conversationMode === 'guided-questions')
}
function index(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
}
function matchWord(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}
function points(state: ImpostorLanState): Record<string, number> {
  return Object.fromEntries(state.participants.map(id =>
    [id, state.winner === 'impostor' ? (id === state.impostorId ? 2 : 0)
      : (id === state.impostorId ? 0 : 1)]))
}
function summary(state: ImpostorLanState, winner: 'impostor' | 'group', reason: NonNullable<ImpostorLanState['reason']>,
  guessedWord: string | null = state.guessedWord): ImpostorLanState {
  return { ...state, step: 'summary', winner, reason, guessedWord }
}
function hostOnly(role: 'host' | 'guest' | undefined) { return role === 'host' }

export const impostorLanGame = defineMultiplayerGame<ImpostorLanConfig, ImpostorLanState>({
  gameId: IMPOSTOR_LAN_GAME_ID,
  minPlayers: 3,
  maxPlayers: 12,
  validateConfig: input => validConfig(input)
    ? { ok: true, config: { impostorMode: input.impostorMode, conversationMode: input.conversationMode } }
    : { ok: false },
  createInitialState: (config, participantIds, ctx) => {
    const cards = ptDeck.cards
    const card = cards[index(ctx.random, cards.length)]
    const participants = [...participantIds]
    const impostorId = participants[index(ctx.random, participants.length)]
    const speakingOrder = [...participants]
    // Each new GameSession randomizes speaking order, as in the original solo game.
    for (let i = speakingOrder.length - 1; i > 0; i--) {
      const j = index(ctx.random, i + 1)
      ;[speakingOrder[i], speakingOrder[j]] = [speakingOrder[j], speakingOrder[i]]
    }
    const shuffledQuestions = [...card.questionIds]
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = index(ctx.random, i + 1)
      ;[shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]]
    }
    return {
      config, participants, speakingOrder, impostorId, word: card.word,
      hint: card.impostorHint, alternateWord: card.alternateWord,
      questions: Object.fromEntries(speakingOrder.map((id, n) => [id,
        ptDeck.questions.find(q => q.id === shuffledQuestions[n])!.text])),
      step: 'reveal', seen: [], currentSpeaker: 0, accusedId: null, guessedWord: null,
      winner: null, reason: null,
    }
  },
  applyCommand: (state, action) => {
    const id = action.playerId
    if (!state.participants.includes(id)) return { accepted: false, error: 'not_participant' }
    if (action.type === 'ACK_BRIEFING' && state.step === 'reveal' && action.payload === null) {
      if (state.seen.includes(id)) return { accepted: true, changed: false }
      return { accepted: true, changed: true, state: { ...state, seen: [...state.seen, id] } }
    }
    if (action.type === 'START_CLUES' && hostOnly(action.role) && state.step === 'reveal'
      && state.seen.length === state.participants.length && action.payload === null) {
      if (!action.connectedParticipantIds || !state.participants.every(id =>
        action.connectedParticipantIds!.includes(id))) {
        return { accepted: false, error: 'not_ready' }
      }
      return { accepted: true, changed: true, state: { ...state, step: 'clues' } }
    }
    if (action.type === 'NEXT_CLUE' && hostOnly(action.role) && state.step === 'clues'
      && action.payload === null) {
      const next = state.currentSpeaker + 1
      return { accepted: true, changed: true,
        state: { ...state, currentSpeaker: next, step: next >= state.speakingOrder.length ? 'discussion' : 'clues' } }
    }
    if (action.type === 'START_ACCUSATION' && hostOnly(action.role)
      && state.step === 'discussion' && action.payload === null) {
      return { accepted: true, changed: true, state: { ...state, step: 'accusation' } }
    }
    if (action.type === 'ACCUSE' && hostOnly(action.role) && state.step === 'accusation'
      && isRecord(action.payload) && typeof action.payload.playerId === 'string'
      && state.participants.includes(action.payload.playerId)) {
      const accusedId = action.payload.playerId
      const next = { ...state, accusedId }
      return { accepted: true, changed: true,
        state: accusedId === state.impostorId ? { ...next, step: 'final-guess' }
          : summary(next, 'impostor', 'not-found') }
    }
    if (action.type === 'GUESS_WORD' && state.step === 'final-guess' && id === state.impostorId
      && isRecord(action.payload) && typeof action.payload.word === 'string'
      && action.payload.word.trim().length >= 1 && action.payload.word.length <= 80) {
      const guess = action.payload.word.trim()
      const correct = matchWord(guess) === matchWord(state.word)
      return { accepted: true, changed: true,
        state: summary(state, correct ? 'impostor' : 'group',
          correct ? 'stolen-word' : 'caught', guess) }
    }
    if (action.type === 'SKIP_GUESS' && hostOnly(action.role) && state.step === 'final-guess'
      && action.payload === null) {
      return { accepted: true, changed: true, state: summary(state, 'group', 'caught') }
    }
    return { accepted: false, error: action.role !== 'host'
      && ['START_CLUES', 'NEXT_CLUE', 'START_ACCUSATION', 'ACCUSE', 'SKIP_GUESS'].includes(action.type)
      ? 'unauthorized' : 'invalid_phase' }
  },
  awardPoints: state => state.step === 'summary' ? points(state) : null,
  projectPublic: (state): ImpostorLanPublic => ({
    step: state.step,
    mode: state.config.impostorMode, conversationMode: state.config.conversationMode,
    seenCount: state.seen.length, totalPlayers: state.participants.length,
    speakingOrder: [...state.speakingOrder],
    currentSpeaker: state.step === 'clues' ? state.speakingOrder[state.currentSpeaker] : null,
    accusedId: state.step === 'final-guess' || state.step === 'summary' ? state.accusedId : null,
    winner: state.winner, reason: state.reason,
    result: state.step === 'summary'
      ? { word: state.word, impostorId: state.impostorId, guessedWord: state.guessedWord,
        points: points(state) } : null,
  }),
  projectPrivate: (state, id): ImpostorLanPrivate | null => {
    if (!state.participants.includes(id)) return null
    const impostor = id === state.impostorId
    const wasSeen = state.seen.includes(id)
    const question = state.config.conversationMode === 'guided-questions' ? state.questions[id] : undefined
    if (!impostor) return { kind: 'word', word: state.word, wasSeen, ...(question ? { question } : {}) }
    if (state.config.impostorMode === 'no-word') return { kind: 'impostor', wasSeen,
      ...(question ? { question } : {}) }
    if (state.config.impostorMode === 'hint') return { kind: 'impostor-hint', hint: state.hint, wasSeen,
      ...(question ? { question } : {}) }
    // Preserve the existing solo rule: the impostor sees only their alternate word.
    return { kind: 'word', word: state.alternateWord, wasSeen, ...(question ? { question } : {}) }
  },
})
