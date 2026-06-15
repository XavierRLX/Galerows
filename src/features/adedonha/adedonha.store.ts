import { create } from 'zustand'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { beginAdedonhaAnswers, beginAdedonhaScoring, changeAdedonhaLetter, clearAdedonhaAnswers, createAdedonhaSession, finishAdedonhaMatch, finishAdedonhaScoring, isAdedonhaSession, restartAdedonhaRound, selectAdedonhaLetter, updateAdedonhaAnswer, updateAdedonhaPlayerName, updateAdedonhaScore } from './adedonha.session'
import type { AdedonhaScore, AdedonhaSession } from './adedonha.types'

type AdedonhaState = {
  session: AdedonhaSession | null
  initialized: boolean
  loading: boolean
  initialize: () => Promise<void>
  start: (categories: string[], letter?: string) => Promise<void>
  setAnswer: (categoryId: string, answer: string) => Promise<void>
  setScore: (categoryId: string, score: AdedonhaScore) => Promise<void>
  setPlayerName: (playerName: string) => Promise<void>
  selectLetter: (letter: string) => Promise<void>
  drawLetter: () => Promise<void>
  beginAnswers: () => Promise<void>
  beginScoring: () => Promise<void>
  finishScoring: () => Promise<void>
  finishMatch: () => Promise<void>
  restartRound: () => Promise<void>
  clearAnswers: () => Promise<void>
  discard: () => Promise<void>
}

export const useAdedonhaStore = create<AdedonhaState>((set, get) => ({
  session: null,
  initialized: false,
  loading: false,
  initialize: async () => {
    if (get().loading) return
    set({ loading: true })
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.adedonhaSession)
    set({ session: isAdedonhaSession(saved) ? migrateSession(saved) : null, initialized: true, loading: false })
  },
  start: async (categories, letter) => {
    const session = createAdedonhaSession(categories, letter)
    await persistSession(session)
    set({ session })
  },
  setAnswer: async (categoryId, answer) => { await mutateSession(get, set, (session) => updateAdedonhaAnswer(session, categoryId, answer)) },
  setScore: async (categoryId, score) => { await mutateSession(get, set, (session) => updateAdedonhaScore(session, categoryId, score)) },
  setPlayerName: async (playerName) => { await mutateSession(get, set, (session) => updateAdedonhaPlayerName(session, playerName)) },
  selectLetter: async (letter) => { await mutateSession(get, set, (session) => selectAdedonhaLetter(session, letter)) },
  drawLetter: async () => { await mutateSession(get, set, (session) => changeAdedonhaLetter(session)) },
  beginAnswers: async () => { await mutateSession(get, set, beginAdedonhaAnswers) },
  beginScoring: async () => { await mutateSession(get, set, beginAdedonhaScoring) },
  finishScoring: async () => { await mutateSession(get, set, finishAdedonhaScoring) },
  finishMatch: async () => { await mutateSession(get, set, finishAdedonhaMatch) },
  restartRound: async () => { await mutateSession(get, set, restartAdedonhaRound) },
  clearAnswers: async () => { await mutateSession(get, set, clearAdedonhaAnswers) },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.adedonhaSession)
    set({ session: null })
  },
}))

async function mutateSession(
  get: () => AdedonhaState,
  set: (partial: Partial<AdedonhaState>) => void,
  mutation: (session: AdedonhaSession) => AdedonhaSession,
) {
  const state = get()
  if (!state.session) return null
  const session = mutation(state.session)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: AdedonhaSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.adedonhaSession, session)
}

function migrateSession(session: AdedonhaSession): AdedonhaSession {
  return {
    ...session,
    phase: session.phase ?? 'answering',
    scores: session.scores ?? {},
    rounds: session.rounds ?? [],
    playerName: session.playerName ?? '',
  }
}
