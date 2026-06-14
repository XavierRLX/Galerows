import { create } from 'zustand'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { addPlayer, createPlayerGroup, isPlayerGroup, movePlayer, removePlayer, renameGroup, renamePlayer } from './players.model'
import type { PlayerGroup } from './players.types'

type PlayersState = {
  group: PlayerGroup | null
  hydrated: boolean
  error: string | null
  load: () => Promise<void>
  setGroupName: (name: string) => Promise<boolean>
  add: (name: string) => Promise<boolean>
  rename: (playerId: string, name: string) => Promise<boolean>
  remove: (playerId: string) => Promise<void>
  move: (playerId: string, direction: -1 | 1) => Promise<void>
}

async function persist(group: PlayerGroup) {
  await LocalPreferences.setJson(STORAGE_KEYS.playerGroup, group)
}

export const usePlayersStore = create<PlayersState>((set, get) => ({
  group: null,
  hydrated: false,
  error: null,
  load: async () => {
    const saved = await LocalPreferences.getJson<unknown>(STORAGE_KEYS.playerGroup)
    const group = isPlayerGroup(saved) ? saved : createPlayerGroup()
    if (!saved) await persist(group)
    set({ group, hydrated: true, error: null })
  },
  setGroupName: async (name) => update(set, get, (group) => renameGroup(group, name)),
  add: async (name) => update(set, get, (group) => addPlayer(group, name)),
  rename: async (playerId, name) => update(set, get, (group) => renamePlayer(group, playerId, name)),
  remove: async (playerId) => { await update(set, get, (group) => removePlayer(group, playerId)) },
  move: async (playerId, direction) => { await update(set, get, (group) => movePlayer(group, playerId, direction)) },
}))

async function update(
  set: (partial: Partial<PlayersState>) => void,
  get: () => PlayersState,
  mutate: (group: PlayerGroup) => PlayerGroup,
) {
  try {
    const group = mutate(get().group ?? createPlayerGroup())
    await persist(group)
    set({ group, error: null, hydrated: true })
    return true
  } catch (error) {
    set({ error: error instanceof Error ? error.message : 'Não foi possível salvar.' })
    return false
  }
}
