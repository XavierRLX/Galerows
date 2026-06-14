import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { loadTabooDeck } from './content/tabooContent.service'
import type { TabooDeck } from './content/tabooContent.types'
import { beginTabooTurn, continueAfterTabooSummary, createTabooSession, endTabooTurn, entityIdentity, finishExpiredTurn, isTabooOpeningHistory, isTabooSessionCompatible, recordCorrectGuess, skipTabooCard } from './taboo.session'
import type { TabooConfig, TabooOpeningHistory, TabooSession, TabooTeam } from './taboo.types'

type TabooState = {
  deck: TabooDeck | null
  session: TabooSession | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: (locale: SupportedLocale) => Promise<void>
  start: (participants: GameParticipant[], teams: TabooTeam[], config: TabooConfig) => Promise<void>
  beginTurn: () => Promise<void>
  correct: () => Promise<void>
  skip: () => Promise<void>
  endTurn: () => Promise<void>
  expireTurn: () => Promise<void>
  continueSummary: () => Promise<boolean>
  discard: () => Promise<void>
}

export const useTabooStore = create<TabooState>((set, get) => ({
  deck: null,
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadTabooDeck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.tabooSession)
    if (saved === null) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isTabooSessionCompatible(saved, deck)) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: 'A partida salva usa outro idioma ou outra versão do baralho e precisa ser reiniciada.' })
      return
    }
    set({ deck, session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (participants, teams, config) => {
    const deck = requireDeck(get())
    const savedHistory = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.tabooOpeningHistory)
    const history = isTabooOpeningHistory(savedHistory) ? savedHistory : null
    const session = createTabooSession(participants, teams, config, deck, Math.random, history)
    await persistSession(session)
    const currentEntityId = session.turnQueue[session.currentTurnIndex]
    if (session.currentCardId && currentEntityId) {
      const openingHistory: TabooOpeningHistory = {
        schemaVersion: 1,
        cardId: session.currentCardId,
        entityIdentity: entityIdentity(currentEntityId, session.participants, session.teams),
      }
      await LocalPreferences.setJson(STORAGE_KEYS.tabooOpeningHistory, openingHistory)
    }
    set({ session, resumeError: null })
  },
  beginTurn: async () => { await mutateSession(get, set, (session) => beginTabooTurn(session)) },
  correct: async () => { await mutateSession(get, set, (session) => recordCorrectGuess(session)) },
  skip: async () => { await mutateSession(get, set, (session) => skipTabooCard(session)) },
  endTurn: async () => { await mutateSession(get, set, (session) => endTabooTurn(session)) },
  expireTurn: async () => { await mutateSession(get, set, (session) => finishExpiredTurn(session)) },
  continueSummary: async () => {
    const session = await mutateSession(get, set, (current) => continueAfterTabooSummary(current))
    return session?.phase === 'finished'
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.tabooSession)
    set({ session: null, resumeError: null })
  },
}))

async function mutateSession(
  get: () => TabooState,
  set: (partial: Partial<TabooState>) => void,
  mutation: (session: TabooSession, deck: TabooDeck) => TabooSession,
) {
  const state = get()
  if (!state.session || !state.deck) return null
  const session = mutation(state.session, state.deck)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: TabooSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.tabooSession, session)
}

function requireDeck(state: TabooState) {
  if (!state.deck) throw new Error('O baralho ainda não foi carregado.')
  return state.deck
}
