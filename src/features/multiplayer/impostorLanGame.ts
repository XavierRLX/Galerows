import ptDeck from '../impostor-da-palavra/content/decks/pt-BR.json'
import type { ConversationMode, ImpostorMode } from '../impostor-da-palavra/impostorDaPalavra.types'
import { isImpostorCoreConfig } from '../impostor-da-palavra/impostorSharedConfig'
import { defineMultiplayerGame } from './multiplayerGames'

export const IMPOSTOR_LAN_GAME_ID = 'impostor-da-palavra'

export interface ImpostorLanConfig {
  impostorMode: ImpostorMode
  conversationMode: ConversationMode
  flow?: 'individual-vote'
  timerSeconds?: 0 | 120 | 180 | 300
  scoringMode?: 'classic' | 'individual'
}

export type ImpostorLanStep = 'reveal' | 'clues' | 'discussion' | 'accusation' | 'voting' | 'final-guess' | 'summary'

interface ImpostorLanState {
  config: ImpostorLanConfig
  participants: string[]
  speakingOrder: string[]
  impostorId: string
  word: string
  hint: string
  alternateWord: string
  questions: Record<string, string>
  questionOptions: string[]
  questionIndex: number
  step: ImpostorLanStep
  seen: string[]
  currentSpeaker: number
  accusedId: string | null
  guessedWord: string | null
  winner: 'impostor' | 'group' | null
  reason: 'not-found' | 'stolen-word' | 'caught' | 'tied-vote' | null
  startedAt: number
  timerStartedAt: number | null
  votes: Record<string, string>
  voteRound: number
  runoffCandidates: string[] | null
}

export interface ImpostorLanPublic {
  flow?: 'individual-vote'
  timerSeconds?: number
  startedAt?: number
  timerStartedAt?: number | null
  voteCount?: number
  voteRound?: number
  runoffCandidates?: string[] | null
  question?: string
  firstSpeaker?: string
  scoringMode?: 'classic' | 'individual'
  step: ImpostorLanStep
  mode: ImpostorMode
  conversationMode: ConversationMode
  seenCount: number
  totalPlayers: number
  speakingOrder: string[]
  currentSpeaker: string | null
  accusedId: string | null
  winner: 'impostor' | 'group' | null
  reason: 'not-found' | 'stolen-word' | 'caught' | 'tied-vote' | null
  result: { word: string; impostorId: string; guessedWord: string | null;
    points: Record<string, number> } | null
}

export interface ImpostorLanPrivate {
  kind: 'word' | 'impostor' | 'impostor-hint'
  word?: string
  hint?: string
  question?: string
  wasSeen: boolean
  hasVoted?: boolean
  canGuess?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function validConfig(value: unknown): value is ImpostorLanConfig {
  return isRecord(value)
    && Object.keys(value).every(key => ['impostorMode', 'conversationMode', 'flow', 'timerSeconds', 'scoringMode'].includes(key))
    && (value.flow === undefined || value.flow === 'individual-vote')
    && (value.timerSeconds === undefined || [0, 120, 180, 300].includes(value.timerSeconds as number))
    && (value.scoringMode === undefined || value.scoringMode === 'classic' || value.scoringMode === 'individual')
    && isImpostorCoreConfig(value)
}
function index(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
}
function matchWord(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}
function points(state: ImpostorLanState): Record<string, number> {
  if (state.config.scoringMode === 'individual' && state.config.flow === 'individual-vote') {
    const correctCount = Object.entries(state.votes).filter(([voter,target]) => voter !== state.impostorId && target === state.impostorId).length
    const majority = correctCount > state.participants.length / 2
    const guessed = state.guessedWord !== null && matchWord(state.guessedWord) === matchWord(state.word)
    return Object.fromEntries(state.participants.map(id => [id, id === state.impostorId
      ? Number(state.winner === 'impostor') + Number(guessed)
      : Number(state.votes[id] === state.impostorId) * (majority ? 2 : 1)]))
  }
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
    ? { ok: true, config: { impostorMode: input.impostorMode, conversationMode: input.conversationMode,
        ...(input.flow ? { flow: input.flow } : {}),
        ...(input.timerSeconds !== undefined ? { timerSeconds: input.timerSeconds } : {}),
        ...(input.scoringMode !== undefined ? { scoringMode: input.scoringMode } : {}) } }
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
        ptDeck.questions.find(q => q.id === shuffledQuestions[config.flow === 'individual-vote' ? 0 : n])!.text])),
      questionOptions: shuffledQuestions.map(qid => ptDeck.questions.find(q => q.id === qid)!.text),
      questionIndex: 0,
      step: 'reveal', seen: [], currentSpeaker: 0, accusedId: null, guessedWord: null,
      winner: null, reason: null, startedAt: ctx.clock.now(), timerStartedAt: null, votes: {},
      voteRound: 1, runoffCandidates: null,
    }
  },
  applyCommand: (state, action, ctx) => {
    const id = action.playerId
    if (!state.participants.includes(id)) return { accepted: false, error: 'not_participant' }
    if (['NEXT_QUESTION', 'DRAW_FIRST_SPEAKER'].includes(action.type) && !hostOnly(action.role)) {
      return { accepted: false, error: 'unauthorized' }
    }
    if (action.type === 'ACK_BRIEFING' && state.step === 'reveal' && action.payload === null) {
      if (state.seen.includes(id)) return { accepted: true, changed: false }
      return { accepted: true, changed: true, state: { ...state, seen: [...state.seen, id] } }
    }
    if (state.config.flow === 'individual-vote' && state.step === 'reveal'
      && hostOnly(action.role)) {
      if (action.type === 'NEXT_QUESTION' && action.payload === null
        && state.config.conversationMode === 'guided-questions') {
        const questionIndex = (state.questionIndex + 1) % state.questionOptions.length
        const question = state.questionOptions[questionIndex]
        return { accepted: true, changed: true, state: { ...state, questionIndex,
          questions: Object.fromEntries(state.participants.map(id => [id, question])) } }
      }
      if (action.type === 'DRAW_FIRST_SPEAKER' && action.payload === null) {
        const next = [...state.speakingOrder]
        if (next.length > 1) {
          const picked = 1 + index(ctx.random, next.length - 1)
          ;[next[0], next[picked]] = [next[picked], next[0]]
        }
        return { accepted: true, changed: true, state: { ...state, speakingOrder: next } }
      }
    }
    if (state.config.flow === 'individual-vote' && state.step === 'final-guess'
      && state.config.scoringMode === 'individual') {
      if (action.type === 'GUESS_WORD' && id === state.impostorId && isRecord(action.payload)
        && Object.keys(action.payload).length === 1 && typeof action.payload.word === 'string'
        && action.payload.word.trim().length > 0 && action.payload.word.length <= 80) {
        return { accepted: true, changed: true,
          state: summary(state, state.winner!, state.reason!, action.payload.word.trim()) }
      }
      if (action.type === 'SKIP_GUESS' && hostOnly(action.role) && action.payload === null) {
        return { accepted: true, changed: true, state: summary(state, state.winner!, state.reason!) }
      }
    }
    // New immersive flow. Room ownership, command identity, session ID and deduplication
    // are enforced by the persistent LAN runtime before these game commands arrive.
    if (state.config.flow === 'individual-vote') {
      if (action.type === 'START_VOTING' && hostOnly(action.role) && state.step === 'reveal'
        && state.seen.length === state.participants.length && action.payload === null) {
        if (!action.connectedParticipantIds || !state.participants.every(person =>
          action.connectedParticipantIds!.includes(person))) return { accepted: false, error: 'not_ready' }
        return { accepted: true, changed: true, state: { ...state, step: 'voting' } }
      }
      if (action.type === 'START_TIMER' && hostOnly(action.role) && state.step === 'reveal'
        && state.seen.length === state.participants.length && state.config.timerSeconds
        && !state.timerStartedAt && action.payload === null) {
        return { accepted: true, changed: true, state: { ...state, timerStartedAt: ctx.clock.now() } }
      }
      if (action.type === 'VOTE' && state.step === 'voting' && isRecord(action.payload)
        && Object.keys(action.payload).length === 1 && typeof action.payload.playerId === 'string'
        && state.participants.includes(action.payload.playerId)
        && (!state.runoffCandidates || state.runoffCandidates.includes(action.payload.playerId))) {
        // Idempotent even with a distinct commandId: first confirmed vote is final.
        if (Object.hasOwn(state.votes, id)) return { accepted: true, changed: false }
        const votes = { ...state.votes, [id]: action.payload.playerId }
        const next = { ...state, votes }
        if (Object.keys(votes).length < state.participants.length) {
          return { accepted: true, changed: true, state: next }
        }
        const counts = new Map<string, number>()
        for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1)
        const maxVotes = Math.max(...counts.values())
        const tied = [...counts].filter(([, count]) => count === maxVotes).map(([target]) => target)
        if (tied.length > 1) {
          // One runoff; a second tied ballot is inconclusive, so impostor survives.
          if (state.voteRound === 1) return { accepted: true, changed: true,
            state: { ...next, votes: {}, voteRound: 2, runoffCandidates: tied } }
          return { accepted: true, changed: true, state: state.config.scoringMode === 'individual'
            ? { ...next, step: 'final-guess', winner: 'impostor', reason: 'tied-vote' }
            : summary(next, 'impostor', 'tied-vote') }
        }
        const accusedId = tied[0]
        const winner: 'group' | 'impostor' = accusedId === state.impostorId ? 'group' : 'impostor'
        const reason: 'caught' | 'not-found' = accusedId === state.impostorId ? 'caught' : 'not-found'
        const outcome = { ...next, accusedId, winner, reason }
        return { accepted: true, changed: true,
          state: state.config.scoringMode === 'individual'
            ? { ...outcome, step: 'final-guess' } : summary(outcome, winner, reason) }
      }
      if (action.type !== 'ACK_BRIEFING') return { accepted: false,
        error: !hostOnly(action.role) && action.type === 'START_VOTING' ? 'unauthorized' : 'invalid_phase' }
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
    ...(state.config.flow ? { flow: state.config.flow, timerSeconds: state.config.timerSeconds ?? 0,
      scoringMode: state.config.scoringMode ?? 'classic',
      firstSpeaker: state.speakingOrder[0],
      ...(state.config.conversationMode === 'guided-questions'
        ? { question: state.questions[state.participants[0]] } : {}),
      startedAt: state.startedAt, timerStartedAt: state.timerStartedAt, voteCount: Object.keys(state.votes).length,
      voteRound: state.voteRound, runoffCandidates: state.runoffCandidates } : {}),
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
    if (state.config.flow === 'individual-vote' && (state.step === 'voting'
      || state.step === 'summary' || state.step === 'final-guess')) {
      return { kind: 'impostor', wasSeen: true, hasVoted: Object.hasOwn(state.votes, id),
        canGuess: state.step === 'final-guess' && id === state.impostorId }
    }
    const impostor = id === state.impostorId
    const wasSeen = state.seen.includes(id)
    const question = state.config.conversationMode === 'guided-questions' ? state.questions[id] : undefined
    const voteState = state.config.flow ? { hasVoted: Object.hasOwn(state.votes, id) } : {}
    if (!impostor) return { kind: 'word', word: state.word, wasSeen, ...voteState, ...(question ? { question } : {}) }
    if (state.config.impostorMode === 'no-word') return { kind: 'impostor', wasSeen, ...voteState,
      ...(question ? { question } : {}) }
    if (state.config.impostorMode === 'hint') return { kind: 'impostor-hint', hint: state.hint, wasSeen, ...voteState,
      ...(question ? { question } : {}) }
    // Preserve the existing solo rule: the impostor sees only their alternate word.
    return { kind: 'word', word: state.alternateWord, wasSeen, ...voteState, ...(question ? { question } : {}) }
  },
})
