import { getPistaUnicaTarget, pistaUnicaTargets } from '../pista-unica/pistaUnica.content'
import { getVisiblePistaUnicaClues, normalizeClue } from '../pista-unica/pistaUnica.session'
import { PISTA_UNICA_CATEGORIES, type PistaUnicaCategory } from '../pista-unica/pistaUnica.types'
import { defineMultiplayerGame } from './multiplayerGames'

export const PISTA_UNICA_LAN_GAME_ID = 'pista-unica'

export interface PistaUnicaLanConfig { categories: PistaUnicaCategory[] }
export type PistaUnicaLanStep = 'writing' | 'guessing' | 'round-result' | 'summary'
export interface PistaUnicaLanRoundResult {
  round: number
  guesserId: string
  target: string
  guessedText: string | null
  correct: boolean
  clueCount: number
  excludedCount: number
}
interface PistaUnicaLanState {
  participants: string[]
  targetIds: string[]
  roundIndex: number
  step: PistaUnicaLanStep
  // Submitted clues remain strictly private in host-owned gameState until all
  // writers have submitted; public project exposes only normalized unique clues.
  submissions: Record<string, string>
  scores: Record<string, number>
  results: PistaUnicaLanRoundResult[]
  lastResult: PistaUnicaLanRoundResult | null
}
export interface PistaUnicaLanPublic {
  step: PistaUnicaLanStep
  round: number
  totalRounds: number
  guesserId: string
  submittedCount: number
  requiredCount: number
  clues: string[]
  excludedCount: number
  lastResult: PistaUnicaLanRoundResult | null
  scores: Record<string, number>
}
export interface PistaUnicaLanPrivate {
  kind: 'writer' | 'guesser'
  target?: string
  submitted: boolean
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function validateConfig(input: unknown): { ok: true; config: PistaUnicaLanConfig } | { ok: false } {
  if (!record(input) || Object.keys(input).length !== 1 || !Array.isArray(input.categories)) return { ok: false }
  const categories = input.categories
  if (categories.length === 0 || categories.length > PISTA_UNICA_CATEGORIES.length
    || !categories.every(value => typeof value === 'string' && PISTA_UNICA_CATEGORIES.includes(value as PistaUnicaCategory))
    || new Set(categories).size !== categories.length) return { ok: false }
  return { ok: true, config: { categories: [...categories] as PistaUnicaCategory[] } }
}
function currentGuesser(state: PistaUnicaLanState) { return state.participants[state.roundIndex]! }
function currentTarget(state: PistaUnicaLanState) {
  return getPistaUnicaTarget(state.targetIds[state.roundIndex]!)!.title
}
function activeClues(state: PistaUnicaLanState) {
  return getVisiblePistaUnicaClues(state.participants.filter(id => id !== currentGuesser(state))
    .filter(id => Object.hasOwn(state.submissions, id))
    .map(id => ({ id, participantId: id, text: state.submissions[id]!, included: true })))
    .map(clue => clue.text)
}
function completedResult(state: PistaUnicaLanState, guessedText: string | null, correct: boolean): PistaUnicaLanState {
  const target = currentTarget(state)
  const unique = activeClues(state)
  const result: PistaUnicaLanRoundResult = { round: state.roundIndex + 1,
    guesserId: currentGuesser(state), target, guessedText, correct,
    clueCount: unique.length, excludedCount: state.participants.length - 1 - unique.length }
  const scores = { ...state.scores, [result.guesserId]: (state.scores[result.guesserId] ?? 0) + (correct ? 1 : 0) }
  return { ...state, scores, step: 'round-result', lastResult: result, results: [...state.results, result] }
}
function randomIndex(random: () => number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(random() * count)))
}
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const array = [...values]
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomIndex(random, i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}
function normalizeAnswer(value: string): string { return normalizeClue(value) }

export const pistaUnicaLanGame = defineMultiplayerGame<PistaUnicaLanConfig, PistaUnicaLanState>({
  gameId: PISTA_UNICA_LAN_GAME_ID,
  minPlayers: 3,
  maxPlayers: 12,
  validateConfig,
  createInitialState: (config, participantIds, context) => {
    const eligible = pistaUnicaTargets.filter(target => config.categories.includes(target.category))
    // Repeat a shuffled deck only when a single category has fewer unique
    // targets than participants; avoids START_GAME throwing at 9–12 players.
    const deck: string[] = []
    while (deck.length < participantIds.length) deck.push(...shuffle(eligible.map(item => item.id), context.random))
    return { participants: [...participantIds], targetIds: deck.slice(0, participantIds.length),
      roundIndex: 0, step: 'writing', submissions: {},
      scores: Object.fromEntries(participantIds.map(id => [id, 0])),
      results: [], lastResult: null }
  },
  applyCommand: (state, action) => {
    if (!state.participants.includes(action.playerId)) return { accepted: false, error: 'not_participant' }
    const guesser = currentGuesser(state)
    if (action.type === 'SUBMIT_CLUE') {
      if (action.playerId === guesser) return { accepted: false, error: 'unauthorized' }
      if (state.step !== 'writing' || Object.hasOwn(state.submissions, action.playerId)) {
        return { accepted: false, error: 'invalid_phase' }
      }
      const text = record(action.payload) && action.payload.text
      if (typeof text !== 'string' || !text.trim() || text.trim().length > 48) {
        return { accepted: false, error: 'invalid_payload' }
      }
      const submissions = { ...state.submissions, [action.playerId]: text.replace(/\s+/g, ' ').trim() }
      const next = { ...state, submissions }
      if (Object.keys(submissions).length === state.participants.length - 1) {
        const unique = activeClues(next)
        // Zero unique clues: the round cannot be guessed fairly.
        return { accepted: true, changed: true, state: unique.length === 0
          ? completedResult(next, null, false) : { ...next, step: 'guessing' } }
      }
      return { accepted: true, changed: true, state: next }
    }
    if (action.type === 'SUBMIT_GUESS') {
      if (action.playerId !== guesser) return { accepted: false, error: 'unauthorized' }
      if (state.step !== 'guessing') return { accepted: false, error: 'invalid_phase' }
      const guess = record(action.payload) && action.payload.text
      if (typeof guess !== 'string' || !guess.trim() || guess.trim().length > 80) {
        return { accepted: false, error: 'invalid_payload' }
      }
      const word = guess.replace(/\s+/g, ' ').trim()
      return { accepted: true, changed: true, state: completedResult(state, word,
        normalizeAnswer(word) === normalizeAnswer(currentTarget(state))) }
    }
    if (action.type === 'NEXT_ROUND') {
      if (action.role !== 'host') return { accepted: false, error: 'unauthorized' }
      if (state.step !== 'round-result' || action.payload !== null) {
        return { accepted: false, error: 'invalid_phase' }
      }
      const nextIndex = state.roundIndex + 1
      return { accepted: true, changed: true, state: nextIndex >= state.participants.length
        ? { ...state, step: 'summary' }
        : { ...state, roundIndex: nextIndex, step: 'writing', submissions: {}, lastResult: null } }
    }
    return { accepted: false, error: 'invalid_phase' }
  },
  awardPoints: state => state.step === 'summary' ? { ...state.scores } : null,
  projectPublic: (state): PistaUnicaLanPublic => {
    const exposed = state.step !== 'writing'
    const unique = exposed ? activeClues(state) : []
    return { step: state.step, round: state.roundIndex + 1, totalRounds: state.participants.length,
      guesserId: currentGuesser(state), submittedCount: Object.keys(state.submissions).length,
      requiredCount: state.participants.length - 1,
      clues: exposed ? unique : [], excludedCount: exposed ? Object.keys(state.submissions).length - unique.length : 0,
      lastResult: state.step === 'round-result' || state.step === 'summary' ? state.lastResult : null,
      scores: { ...state.scores } }
  },
  projectPrivate: (state, playerId): PistaUnicaLanPrivate | null => {
    if (!state.participants.includes(playerId) || state.step === 'round-result' || state.step === 'summary') return null
    return playerId === currentGuesser(state) ? { kind: 'guesser', submitted: false }
      : { kind: 'writer', target: currentTarget(state), submitted: Object.hasOwn(state.submissions, playerId) }
  },
})
