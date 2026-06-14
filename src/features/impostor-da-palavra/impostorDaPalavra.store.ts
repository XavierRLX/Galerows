import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { loadImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.service'
import type { ImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.types'
import { advanceClueTurn, advanceRolePass, beginAccusation, beginConversation, confirmAccusation, continueAfterRound, createImpostorDaPalavraSession, isOpeningHistory, isSessionCompatible, participantIdentity, recordFinalGuess, selectAccusedParticipant } from './impostorDaPalavra.session'
import type { ImpostorDaPalavraConfig, ImpostorDaPalavraOpeningHistory, ImpostorDaPalavraSession } from './impostorDaPalavra.types'

type ImpostorDaPalavraState = {
  deck: ImpostorDaPalavraDeck | null
  session: ImpostorDaPalavraSession | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: (locale: SupportedLocale) => Promise<void>
  start: (participants: GameParticipant[], config: ImpostorDaPalavraConfig) => Promise<void>
  restart: () => Promise<void>
  advanceRole: () => Promise<void>
  beginConversation: () => Promise<void>
  advanceClue: () => Promise<void>
  beginAccusation: () => Promise<void>
  selectAccused: (participantId: string) => Promise<void>
  confirmAccusation: () => Promise<void>
  recordFinalGuess: (correct: boolean) => Promise<void>
  continueSummary: () => Promise<boolean>
  discard: () => Promise<void>
}

export const useImpostorDaPalavraStore = create<ImpostorDaPalavraState>((set, get) => ({
  deck: null,
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadImpostorDaPalavraDeck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.impostorDaPalavraSession)
    if (saved === null) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isSessionCompatible(saved, deck)) {
      set({ deck, session: null, initialized: true, loading: false, resumeError: 'A partida salva usa outro idioma ou outra versão do baralho e precisa ser reiniciada.' })
      return
    }
    set({ deck, session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (participants, config) => {
    const deck = requireDeck(get())
    const session = await createAndPersistSession(participants, config, deck)
    set({ session, resumeError: null })
  },
  restart: async () => {
    const state = get()
    const deck = requireDeck(state)
    if (!state.session) return
    const session = await createAndPersistSession(state.session.participants, state.session.config, deck)
    set({ session, resumeError: null })
  },
  advanceRole: async () => { await mutateSession(get, set, (session) => advanceRolePass(session)) },
  beginConversation: async () => { await mutateSession(get, set, (session) => beginConversation(session)) },
  advanceClue: async () => { await mutateSession(get, set, (session) => advanceClueTurn(session)) },
  beginAccusation: async () => { await mutateSession(get, set, (session) => beginAccusation(session)) },
  selectAccused: async (participantId) => { await mutateSession(get, set, (session) => selectAccusedParticipant(session, participantId)) },
  confirmAccusation: async () => { await mutateSession(get, set, (session) => confirmAccusation(session)) },
  recordFinalGuess: async (correct) => { await mutateSession(get, set, (session) => recordFinalGuess(session, correct)) },
  continueSummary: async () => {
    const session = await mutateSession(get, set, (current, deck) => continueAfterRound(current, deck))
    if (session?.phase === 'role-pass') await persistOpeningHistory(session)
    return session?.phase === 'finished'
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraSession)
    set({ session: null, resumeError: null })
  },
}))

async function createAndPersistSession(participants: GameParticipant[], config: ImpostorDaPalavraConfig, deck: ImpostorDaPalavraDeck) {
  const savedHistory = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.impostorDaPalavraOpeningHistory)
  const history = isOpeningHistory(savedHistory) ? savedHistory : null
  const session = createImpostorDaPalavraSession(participants, config, deck, Math.random, history)
  await persistSession(session)
  await persistOpeningHistory(session)
  return session
}

async function mutateSession(
  get: () => ImpostorDaPalavraState,
  set: (partial: Partial<ImpostorDaPalavraState>) => void,
  mutation: (session: ImpostorDaPalavraSession, deck: ImpostorDaPalavraDeck) => ImpostorDaPalavraSession,
) {
  const state = get()
  if (!state.session || !state.deck) return null
  const session = mutation(state.session, state.deck)
  if (session === state.session) return session
  await persistSession(session)
  set({ session })
  return session
}

async function persistSession(session: ImpostorDaPalavraSession) {
  await LocalPreferences.setJson(STORAGE_KEYS.impostorDaPalavraSession, session)
}

async function persistOpeningHistory(session: ImpostorDaPalavraSession) {
  const firstSpeaker = session.participants.find((participant) => participant.id === session.speakingOrder[0])
  if (!firstSpeaker) return
  const history: ImpostorDaPalavraOpeningHistory = {
    schemaVersion: 1,
    cardId: session.currentCardId,
    speakerIdentity: participantIdentity(firstSpeaker),
  }
  await LocalPreferences.setJson(STORAGE_KEYS.impostorDaPalavraOpeningHistory, history)
}

function requireDeck(state: ImpostorDaPalavraState) {
  if (!state.deck) throw new Error('O baralho ainda não foi carregado.')
  return state.deck
}
