import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from './players.store'
import type { PlayerGroup } from './players.types'

describe('players store persistence', () => {
  beforeEach(async () => {
    await LocalPreferences.remove(STORAGE_KEYS.playerGroup)
    usePlayersStore.setState({ group: null, hydrated: false, error: null })
  })

  it('persists changes and loads them again', async () => {
    await usePlayersStore.getState().load()
    await usePlayersStore.getState().add('Ana')
    const saved = await LocalPreferences.getJson<PlayerGroup>(STORAGE_KEYS.playerGroup)
    expect(saved?.players[0].name).toBe('Ana')
    usePlayersStore.setState({ group: null, hydrated: false })
    await usePlayersStore.getState().load()
    expect(usePlayersStore.getState().group?.players[0].name).toBe('Ana')
  })
})
