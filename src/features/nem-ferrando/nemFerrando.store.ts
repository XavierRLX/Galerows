import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { loadNemFerrandoDeck } from './content/nemFerrandoContent.service'
import type { NemFerrandoDeck } from './content/nemFerrandoContent.types'
import { awardIrons, challengeGuess, continueAfterSummary, createNemFerrandoSession, isOpeningHistory, isSessionCompatible, participantIdentity, revealAnswer, revealFirstCard, selectCuriosity, swapCard } from './nemFerrando.session'
import type { IronLimit, NemFerrandoOpeningHistory, NemFerrandoSession } from './nemFerrando.types'

type NemFerrandoState = {
  deck: NemFerrandoDeck | null
  session: NemFerrandoSession | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: (locale: SupportedLocale) => Promise<void>
  start: (participants: GameParticipant[], ironLimit: IronLimit) => Promise<void>
  revealFirst: () => Promise<void>
  select: (curiosityId: string) => Promise<void>
  swap: () => Promise<void>
  challenge: () => Promise<void>
  reveal: () => Promise<void>
  award: (participantId: string) => Promise<void>
  continueSummary: () => Promise<boolean>
  discard: () => Promise<void>
}

export const useNemFerrandoStore = create<NemFerrandoState>((set, get) => ({
  deck: null,
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadNemFerrandoDeck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.nemFerrandoSession)
    if (saved === null) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isSessionCompatible(saved, deck)) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: 'A partida salva usa outra versão do baralho e precisa ser reiniciada.' })
      return
    }
    set({ deck, session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (participants, ironLimit) => {
    const deck = requireDeck(get())
    const savedHistory = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.nemFerrandoOpeningHistory)
    const history = isOpeningHistory(savedHistory) ? savedHistory : null
    const session = createNemFerrandoSession(participants, ironLimit, deck, Math.random, history)
    await persistSession(session)
    if (session.currentCardId) {
      const openingHistory: NemFerrandoOpeningHistory = {
        schemaVersion: 1,
        cardId: session.currentCardId,
        playerIdentity: participantIdentity(session.participants[session.currentPlayerIndex]),
      }
      await LocalPreferences.setJson(STORAGE_KEYS.nemFerrandoOpeningHistory, openingHistory)
    }
    set({ session, resumeError: null })
  },
  revealFirst: async () => { await mutateSession(get, set, (session) => revealFirstCard(session)) },
  select: async (curiosityId) => { await mutateSession(get, set, (session, deck) => selectCuriosity(session, curiosityId, deck)) },
  swap: async () => { await mutateSession(get, set, (session) => swapCard(session)) },
  challenge: async () => { await mutateSession(get, set, (session) => challengeGuess(session)) },
  reveal: async () => { await mutateSession(get, set, (session) => revealAnswer(session)) },
  award: async (participantId) => { await mutateSession(get, set, (current, deck) => awardIrons(current, participantId, deck)) },
  continueSummary: async () => {
    const session = await mutateSession(get, set, (current) => continueAfterSummary(current))
    return session?.phase === 'finished'
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.nemFerrandoSession)
    set({ session: null, resumeError: null })
  },
}))

async function mutateSession(
  get: () => NemFerrandoState,
  set: (partial: Partial<NemFerrandoState>) => void,
  mutation: (session: NemFerrandoSession, deck: NemFerrandoDeck) => NemFerrandoSession,
) {
  const state = get()
  if (!state.session || !state.deck) return null
  const session = mutation(state.session, state.deck)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: NemFerrandoSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.nemFerrandoSession, session)
}

function requireDeck(state: NemFerrandoState) {
  if (!state.deck) throw new Error('O baralho ainda não foi carregado.')
  return state.deck
}
