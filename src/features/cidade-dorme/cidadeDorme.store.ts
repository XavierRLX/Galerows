import { create } from 'zustand'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { advanceRoleReveal, createCidadeDormeSession, isCidadeDormeSessionCompatible, recordDetectiveInvestigation, recordDoctorProtection, recordKillerTarget, recordVote, resolveCurrentNight, resolveCurrentVoting, resolveCurrentVotingByMediator, startTiedRevote } from './cidadeDorme.session'
import { advancePhase as advanceCidadeDormePhase } from './cidadeDorme.stateMachine'
import type { CidadeDormePlayerInput, GameSettings, GameState, VoteTargetId } from './cidadeDorme.types'

type CidadeDormeState = {
  session: GameState | null
  initialized: boolean
  loading: boolean
  resumeError: string | null
  initialize: () => Promise<void>
  start: (players: CidadeDormePlayerInput[], settings: GameSettings) => Promise<void>
  advanceReveal: () => Promise<void>
  advancePhase: () => Promise<void>
  chooseKillerTarget: (targetId: string) => Promise<void>
  chooseDoctorProtection: (protectedPlayerId: string) => Promise<void>
  chooseDetectiveTarget: (detectiveTargetId: string) => Promise<void>
  resolveNight: () => Promise<void>
  castVote: (voterId: string, targetId: VoteTargetId) => Promise<void>
  resolveVoting: () => Promise<void>
  startRevote: () => Promise<void>
  resolveMediatorDecision: (targetId: VoteTargetId) => Promise<void>
  discard: () => Promise<void>
}

export const useCidadeDormeStore = create<CidadeDormeState>((set, get) => ({
  session: null,
  initialized: false,
  loading: false,
  resumeError: null,
  initialize: async () => {
    if (get().loading) return
    set({ loading: true })
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.cidadeDormeSession)
    if (saved === null) {
      set({ session: null, initialized: true, loading: false, resumeError: null })
      return
    }
    if (!isCidadeDormeSessionCompatible(saved)) {
      set({ session: null, initialized: true, loading: false, resumeError: 'A partida salva de Cidade Dorme não pôde ser retomada e precisa ser reiniciada.' })
      return
    }
    set({ session: saved, initialized: true, loading: false, resumeError: null })
  },
  start: async (players, settings) => {
    const session = createCidadeDormeSession(players, settings)
    await persistSession(session)
    set({ session, resumeError: null })
  },
  advanceReveal: async () => {
    const current = get().session
    if (!current) return
    const session = advanceRoleReveal(current)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  advancePhase: async () => {
    const current = get().session
    if (!current) return
    const session = advanceCidadeDormePhase(current)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  chooseKillerTarget: async (targetId) => {
    const current = get().session
    if (!current) return
    const withTarget = recordKillerTarget(current, targetId)
    if (withTarget === current) return
    const session = advanceCidadeDormePhase(withTarget)
    await persistSession(session)
    set({ session })
  },
  chooseDoctorProtection: async (protectedPlayerId) => {
    const current = get().session
    if (!current) return
    const withProtection = recordDoctorProtection(current, protectedPlayerId)
    if (withProtection === current) return
    const session = advanceCidadeDormePhase(withProtection)
    await persistSession(session)
    set({ session })
  },
  chooseDetectiveTarget: async (detectiveTargetId) => {
    const current = get().session
    if (!current) return
    const withInvestigation = recordDetectiveInvestigation(current, detectiveTargetId)
    if (withInvestigation === current) return
    const session = advanceCidadeDormePhase(withInvestigation)
    await persistSession(session)
    set({ session })
  },
  resolveNight: async () => {
    const current = get().session
    if (!current) return
    const session = resolveCurrentNight(current)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  castVote: async (voterId, targetId) => {
    const current = get().session
    if (!current) return
    const session = recordVote(current, voterId, targetId)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  resolveVoting: async () => {
    const current = get().session
    if (!current) return
    const session = resolveCurrentVoting(current)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  startRevote: async () => {
    const current = get().session
    if (!current) return
    const session = startTiedRevote(current)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  resolveMediatorDecision: async (targetId) => {
    const current = get().session
    if (!current) return
    const session = resolveCurrentVotingByMediator(current, targetId)
    if (session === current) return
    await persistSession(session)
    set({ session })
  },
  discard: async () => {
    await LocalPreferences.remove(STORAGE_KEYS.cidadeDormeSession)
    set({ session: null, resumeError: null })
  },
}))

async function persistSession(session: GameState) {
  await LocalPreferences.setJson(STORAGE_KEYS.cidadeDormeSession, session)
}
