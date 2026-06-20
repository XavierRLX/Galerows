import { describe, expect, it } from 'vitest'
import { canRequestReviewPrompt, initialReviewPromptState, withCompletedMatch, withFirstOpen, withReviewAttempt } from './reviewPrompt.rules'

const eligibleEnvironment = { isNativeAndroid: true, isOnline: true, isActivePlayRoute: false }

describe('review prompt rules', () => {
  it('requires enough completed matches and time since first open', () => {
    const firstOpen = new Date('2026-06-01T12:00:00.000Z')
    const now = new Date('2026-06-03T12:00:00.000Z')
    const state = withCompletedMatch(withCompletedMatch(withFirstOpen(initialReviewPromptState, firstOpen), 'match-1'), 'match-2')

    expect(canRequestReviewPrompt(state, eligibleEnvironment, now)).toBe(true)
  })

  it('deduplicates the same match id', () => {
    const state = withCompletedMatch(withCompletedMatch(initialReviewPromptState, 'match-1'), 'match-1')

    expect(state.completedMatchCount).toBe(1)
    expect(state.trackedMatchIds).toEqual(['match-1'])
  })

  it('blocks prompts during play, offline, non-Android, and before the second completed match', () => {
    const firstOpen = new Date('2026-06-01T12:00:00.000Z')
    const now = new Date('2026-06-04T12:00:00.000Z')
    const oneMatch = withCompletedMatch(withFirstOpen(initialReviewPromptState, firstOpen), 'match-1')
    const twoMatches = withCompletedMatch(oneMatch, 'match-2')

    expect(canRequestReviewPrompt(oneMatch, eligibleEnvironment, now)).toBe(false)
    expect(canRequestReviewPrompt(twoMatches, { ...eligibleEnvironment, isActivePlayRoute: true }, now)).toBe(false)
    expect(canRequestReviewPrompt(twoMatches, { ...eligibleEnvironment, isOnline: false }, now)).toBe(false)
    expect(canRequestReviewPrompt(twoMatches, { ...eligibleEnvironment, isNativeAndroid: false }, now)).toBe(false)
  })

  it('limits review attempts to one every 120 days and three total attempts', () => {
    const firstOpen = new Date('2026-01-01T12:00:00.000Z')
    const state = withReviewAttempt(withCompletedMatch(withCompletedMatch(withFirstOpen(initialReviewPromptState, firstOpen), 'match-1'), 'match-2'), new Date('2026-06-01T12:00:00.000Z'))

    expect(canRequestReviewPrompt(state, eligibleEnvironment, new Date('2026-09-28T12:00:00.000Z'))).toBe(false)
    expect(canRequestReviewPrompt(state, eligibleEnvironment, new Date('2026-09-29T12:00:00.000Z'))).toBe(true)

    const maxedOut = { ...state, attempts: 3, lastAttemptedAt: '2026-01-01T12:00:00.000Z' }
    expect(canRequestReviewPrompt(maxedOut, eligibleEnvironment, new Date('2026-09-29T12:00:00.000Z'))).toBe(false)
  })
})
