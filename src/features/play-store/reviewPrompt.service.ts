import { AppNetwork } from '../../lib/capacitor/network'
import { canUseNativeAndroidPlayStore, PlayStore } from '../../lib/capacitor/playStore'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { canRequestReviewPrompt, initialReviewPromptState, isReviewPromptState, withCompletedMatch, withFirstOpen, withReviewAttempt, type ReviewPromptState } from './reviewPrompt.rules'

export async function initializeReviewPromptState(now = new Date()) {
  const state = withFirstOpen(await getReviewPromptState(), now)
  await saveReviewPromptState(state)
}

export async function trackCompletedMatchAndMaybeRequestReview(matchId: string, isActivePlayRoute = false, now = new Date()) {
  const current = withCompletedMatch(withFirstOpen(await getReviewPromptState(), now), matchId)
  await saveReviewPromptState(current)

  const { connected } = await AppNetwork.getStatus()
  if (!canRequestReviewPrompt(current, { isNativeAndroid: canUseNativeAndroidPlayStore(), isOnline: connected, isActivePlayRoute }, now)) return false

  const attempted = await PlayStore.requestInAppReview()
  if (!attempted) return false

  await saveReviewPromptState(withReviewAttempt(current, now))
  return true
}

async function getReviewPromptState(): Promise<ReviewPromptState> {
  const state = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.appReviewPrompt)
  return isReviewPromptState(state) ? state : initialReviewPromptState
}

async function saveReviewPromptState(state: ReviewPromptState) {
  await LocalPreferences.setJson(STORAGE_KEYS.appReviewPrompt, state)
  if (state.firstOpenedAt) await LocalPreferences.setJson(STORAGE_KEYS.appFirstOpenedAt, state.firstOpenedAt)
}
