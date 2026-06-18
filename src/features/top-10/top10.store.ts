import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { loadTop10Deck } from './content/top10Content.service'
import type { Top10Deck, Top10Rank } from './content/top10Content.types'
import { continueAfterTop10Summary, createTop10Session, endTop10Card, isTop10SessionCompatible, revealTop10Answer } from './top10.session'
import type { Top10Config, Top10Session, Top10Team } from './top10.types'

type Top10State = {
  deck: Top10Deck | null
  session: Top10Session | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: (locale: SupportedLocale) => Promise<void>
  start: (participants: GameParticipant[], teams: Top10Team[], config: Top10Config) => Promise<void>
  reveal: (rank: Top10Rank, entityId?: string | null) => Promise<void>
  endCard: () => Promise<void>
  continueSummary: () => Promise<boolean>
  discard: () => Promise<void>
}

export const useTop10Store = create<Top10State>((set, get) => ({
  deck: null,
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadTop10Deck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.top10Session)
    if (saved === null) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isTop10SessionCompatible(saved, deck)) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: 'A partida salva usa outra versão do baralho e precisa ser reiniciada.' })
      return
    }
    set({ deck, session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (participants, teams, config) => {
    const deck = requireDeck(get())
    const session = createTop10Session(participants, teams, config, deck)
    await persistSession(session)
    set({ session, resumeError: null })
  },
  reveal: async (rank, entityId = null) => {
    await mutateSession(get, set, (session, deck) => revealTop10Answer(session, rank, deck, entityId))
  },
  endCard: async () => {
    await mutateSession(get, set, (session, deck) => endTop10Card(session, deck))
  },
  continueSummary: async () => {
    const session = await mutateSession(get, set, (current) => continueAfterTop10Summary(current))
    return session?.phase === 'finished'
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.top10Session)
    set({ session: null, resumeError: null })
  },
}))

async function mutateSession(
  get: () => Top10State,
  set: (partial: Partial<Top10State>) => void,
  mutation: (session: Top10Session, deck: Top10Deck) => Top10Session,
) {
  const state = get()
  if (!state.session || !state.deck) return null
  const session = mutation(state.session, state.deck)
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: Top10Session) {
  await LocalPreferences.setJson(STORAGE_KEYS.top10Session, session)
}

function requireDeck(state: Top10State) {
  if (!state.deck) throw new Error('O baralho ainda não foi carregado.')
  return state.deck
}
