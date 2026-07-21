import { create } from 'zustand'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { addPistaUnicaClue, beginPistaUnicaGuess, continuePistaUnicaSession, createPistaUnicaSession, finishPistaUnicaRound, isPistaUnicaSession, openPistaUnicaClue, togglePistaUnicaClue, updatePistaUnicaClue } from './pistaUnica.session'
import type { PistaUnicaCategory, PistaUnicaSession } from './pistaUnica.types'
import type { GameParticipant } from '../players/players.types'

type PistaUnicaState = {
  session: PistaUnicaSession | null
  initialized: boolean
  loading: boolean
  initialize: () => Promise<void>
  start: (participants: GameParticipant[], categories: PistaUnicaCategory[]) => Promise<void>
  openClue: () => Promise<void>
  addClue: (participantId: string, text: string) => Promise<void>
  updateClue: (clueId: string, text: string) => Promise<void>
  toggleClue: (clueId: string) => Promise<void>
  beginGuess: () => Promise<void>
  finishRound: (correct: boolean) => Promise<void>
  continueRound: () => Promise<void>
  discard: () => Promise<void>
}

export const usePistaUnicaStore = create<PistaUnicaState>((set, get) => ({
  session: null,
  initialized: false,
  loading: false,
  initialize: async () => {
    if (get().loading) return
    set({ loading: true })
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.pistaUnicaSession)
    set({ session: isPistaUnicaSession(saved) ? saved : null, initialized: true, loading: false })
  },
  start: async (participants, categories) => { const session = createPistaUnicaSession(participants, categories); await persist(session); set({ session }) },
  openClue: async () => mutate(get, set, openPistaUnicaClue),
  addClue: async (participantId, text) => mutate(get, set, (session) => addPistaUnicaClue(session, participantId, text)),
  updateClue: async (clueId, text) => mutate(get, set, (session) => updatePistaUnicaClue(session, clueId, text)),
  toggleClue: async (clueId) => mutate(get, set, (session) => togglePistaUnicaClue(session, clueId)),
  beginGuess: async () => mutate(get, set, beginPistaUnicaGuess),
  finishRound: async (correct) => mutate(get, set, (session) => finishPistaUnicaRound(session, correct)),
  continueRound: async () => mutate(get, set, continuePistaUnicaSession),
  discard: async () => { await LocalPreferences.remove(STORAGE_KEYS.pistaUnicaSession); set({ session: null }) },
}))

async function mutate(get: () => PistaUnicaState, set: (partial: Partial<PistaUnicaState>) => void, action: (session: PistaUnicaSession) => PistaUnicaSession) {
  const session = get().session
  if (!session) return
  const next = action(session)
  if (next === session) return
  await persist(next)
  set({ session: next })
}
async function persist(session: PistaUnicaSession) { await LocalPreferences.setJson(STORAGE_KEYS.pistaUnicaSession, session) }
