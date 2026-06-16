import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { loadMimicaDeck } from './content/mimicaContent.service'
import type { MimicaDeck } from './content/mimicaContent.types'
import { beginMimicaTurn, chooseMimicaAction, continueAfterMimicaSummary, createMimicaSession, entityIdentity, expireMimicaTurn, isMimicaOpeningHistory, isMimicaSessionCompatible, markMimicaReadyToScore, recordMimicaMiss, recordMimicaSuccess } from './mimica.session'
import type { MimicaConfig, MimicaOpeningHistory, MimicaSession, MimicaTeam } from './mimica.types'

type MimicaState = {
  deck: MimicaDeck | null
  session: MimicaSession | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: (locale: SupportedLocale) => Promise<void>
  start: (participants: GameParticipant[], teams: MimicaTeam[], config: MimicaConfig) => Promise<void>
  beginTurn: () => Promise<void>
  chooseAction: (actionId: string) => Promise<void>
  readyToScore: () => Promise<void>
  success: (guesserId: string | null) => Promise<void>
  miss: () => Promise<void>
  expireTurn: () => Promise<void>
  continueSummary: () => Promise<boolean>
  discard: () => Promise<void>
}

export const useMimicaStore = create<MimicaState>((set, get) => ({
  deck: null,
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadMimicaDeck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.mimicaSession)
    if (saved === null) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isMimicaSessionCompatible(saved, deck)) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: 'A partida salva usa outro idioma ou outra versão do baralho e precisa ser reiniciada.' })
      return
    }
    set({ deck, session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (participants, teams, config) => {
    const deck = requireDeck(get())
    const savedHistory = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.mimicaOpeningHistory)
    const history = isMimicaOpeningHistory(savedHistory) ? savedHistory : null
    const session = createMimicaSession(participants, teams, config, deck, Math.random, history)
    await persistSession(session)
    const currentEntityId = session.turnQueue[session.currentTurnIndex]
    if (session.currentCardId && currentEntityId) {
      const openingHistory: MimicaOpeningHistory = {
        schemaVersion: 1,
        cardId: session.currentCardId,
        entityIdentity: entityIdentity(currentEntityId, session.participants, session.teams),
      }
      await LocalPreferences.setJson(STORAGE_KEYS.mimicaOpeningHistory, openingHistory)
    }
    set({ session, resumeError: null })
  },
  beginTurn: async () => { await mutateSession(get, set, (session) => beginMimicaTurn(session)) },
  chooseAction: async (actionId) => { await mutateSession(get, set, (session, deck) => chooseMimicaAction(session, actionId, deck)) },
  readyToScore: async () => { await mutateSession(get, set, (session) => markMimicaReadyToScore(session)) },
  success: async (guesserId) => { await mutateSession(get, set, (session, deck) => recordMimicaSuccess(session, guesserId, deck)) },
  miss: async () => { await mutateSession(get, set, (session, deck) => recordMimicaMiss(session, deck)) },
  expireTurn: async () => { await mutateSession(get, set, (session) => expireMimicaTurn(session)) },
  continueSummary: async () => {
    const session = await mutateSession(get, set, (current) => continueAfterMimicaSummary(current))
    return session?.phase === 'finished'
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.mimicaSession)
    set({ session: null, resumeError: null })
  },
}))

async function mutateSession(
  get: () => MimicaState,
  set: (partial: Partial<MimicaState>) => void,
  mutation: (session: MimicaSession, deck: MimicaDeck) => MimicaSession,
) {
  const state = get()
  if (!state.session || !state.deck) return null
  const session = mutation(state.session, state.deck)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: MimicaSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.mimicaSession, session)
}

function requireDeck(state: MimicaState) {
  if (!state.deck) throw new Error('O baralho ainda não foi carregado.')
  return state.deck
}
