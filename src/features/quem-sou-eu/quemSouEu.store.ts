import { create } from 'zustand'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { createQuemSouEuSession, isQuemSouEuSession, markQuemSouEuCorrect, revealQuemSouEuWord, skipQuemSouEuWord } from './quemSouEu.session'
import type { QuemSouEuSession } from './quemSouEu.types'

type QuemSouEuState = {
  session: QuemSouEuSession | null
  initialized: boolean
  loading: boolean
  initialize: () => Promise<void>
  start: (words: string[]) => Promise<void>
  revealCurrent: () => Promise<void>
  markCorrect: () => Promise<void>
  skip: () => Promise<void>
  discard: () => Promise<void>
}

export const useQuemSouEuStore = create<QuemSouEuState>((set, get) => ({
  session: null,
  initialized: false,
  loading: false,
  initialize: async () => {
    if (get().loading) return
    set({ loading: true })
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.quemSouEuSession)
    set({ session: isQuemSouEuSession(saved) ? saved : null, initialized: true, loading: false })
  },
  start: async (words) => {
    const session = createQuemSouEuSession(words)
    await persistSession(session)
    set({ session })
  },
  revealCurrent: async () => { await mutateSession(get, set, revealQuemSouEuWord) },
  markCorrect: async () => { await mutateSession(get, set, markQuemSouEuCorrect) },
  skip: async () => { await mutateSession(get, set, skipQuemSouEuWord) },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.quemSouEuSession)
    set({ session: null })
  },
}))

async function mutateSession(
  get: () => QuemSouEuState,
  set: (partial: Partial<QuemSouEuState>) => void,
  mutation: (session: QuemSouEuSession) => QuemSouEuSession,
) {
  const state = get()
  if (!state.session) return null
  const session = mutation(state.session)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: QuemSouEuSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.quemSouEuSession, session)
}
