export type ReviewPromptState = {
  firstOpenedAt: string | null
  completedMatchCount: number
  trackedMatchIds: string[]
  attempts: number
  lastAttemptedAt: string | null
}

export type ReviewPromptEnvironment = {
  isNativeAndroid: boolean
  isOnline: boolean
  isActivePlayRoute: boolean
}

export const initialReviewPromptState: ReviewPromptState = {
  firstOpenedAt: null,
  completedMatchCount: 0,
  trackedMatchIds: [],
  attempts: 0,
  lastAttemptedAt: null,
}

const minCompletedMatches = 2
const minDaysSinceFirstOpen = 2
const minDaysBetweenAttempts = 120
const maxAttempts = 3
const dayMs = 24 * 60 * 60 * 1000

export function withFirstOpen(state: ReviewPromptState, now: Date): ReviewPromptState {
  if (state.firstOpenedAt) return state
  return { ...state, firstOpenedAt: now.toISOString() }
}

export function withCompletedMatch(state: ReviewPromptState, matchId: string): ReviewPromptState {
  if (state.trackedMatchIds.includes(matchId)) return state
  return {
    ...state,
    completedMatchCount: state.completedMatchCount + 1,
    trackedMatchIds: [matchId, ...state.trackedMatchIds].slice(0, 50),
  }
}

export function withReviewAttempt(state: ReviewPromptState, now: Date): ReviewPromptState {
  return { ...state, attempts: state.attempts + 1, lastAttemptedAt: now.toISOString() }
}

export function canRequestReviewPrompt(state: ReviewPromptState, environment: ReviewPromptEnvironment, now: Date) {
  if (!environment.isNativeAndroid || !environment.isOnline || environment.isActivePlayRoute) return false
  if (!state.firstOpenedAt) return false
  if (state.completedMatchCount < minCompletedMatches) return false
  if (state.attempts >= maxAttempts) return false
  if (daysBetween(new Date(state.firstOpenedAt), now) < minDaysSinceFirstOpen) return false
  if (state.lastAttemptedAt && daysBetween(new Date(state.lastAttemptedAt), now) < minDaysBetweenAttempts) return false
  return true
}

export function isReviewPromptState(value: unknown): value is ReviewPromptState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ReviewPromptState
  return (candidate.firstOpenedAt === null || typeof candidate.firstOpenedAt === 'string')
    && Number.isInteger(candidate.completedMatchCount)
    && Array.isArray(candidate.trackedMatchIds)
    && candidate.trackedMatchIds.every((item) => typeof item === 'string')
    && Number.isInteger(candidate.attempts)
    && (candidate.lastAttemptedAt === null || typeof candidate.lastAttemptedAt === 'string')
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / dayMs)
}
