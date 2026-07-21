import { create } from 'zustand'
import type { SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { loadUltimaPistaDeck } from './content/ultimaPistaContent.service'
import type { UltimaPistaDeck } from './content/ultimaPistaContent.types'
import { createUltimaPistaProgress, normalizeUltimaPistaProgress, toggleUltimaPistaCardSolved, type UltimaPistaProgress } from './ultimaPista.types'

type UltimaPistaState = {
  deck: UltimaPistaDeck | null
  progress: UltimaPistaProgress | null
  initialized: boolean
  loading: boolean
  initialize: (locale: SupportedLocale) => Promise<void>
  toggleSolved: (cardId: number) => Promise<void>
  resetProgress: () => Promise<void>
}

export const useUltimaPistaStore = create<UltimaPistaState>((set, get) => ({
  deck: null,
  progress: null,
  initialized: false,
  loading: false,
  initialize: async (locale) => {
    if (get().loading) return
    set({ loading: true })
    const { deck } = await loadUltimaPistaDeck(locale)
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.ultimaPistaProgress)
    const progress = normalizeUltimaPistaProgress(saved, deck)
    if (JSON.stringify(saved) !== JSON.stringify(progress)) await persistProgress(progress)
    set({ deck, progress, initialized: true, loading: false })
  },
  toggleSolved: async (cardId) => {
    const { deck, progress } = get()
    if (!deck || !progress) return
    const next = toggleUltimaPistaCardSolved(progress, cardId, deck)
    if (next === progress) return
    await persistProgress(next)
    set({ progress: next })
  },
  resetProgress: async () => {
    const deck = get().deck
    if (!deck) return
    const progress = createUltimaPistaProgress(deck)
    await persistProgress(progress)
    set({ progress })
  },
}))

async function persistProgress(progress: UltimaPistaProgress) {
  await LocalPreferences.setJson(STORAGE_KEYS.ultimaPistaProgress, progress)
}
