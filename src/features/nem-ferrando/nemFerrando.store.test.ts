import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { useNemFerrandoStore } from './nemFerrando.store'
import type { NemFerrandoSession } from './nemFerrando.types'

const participants: GameParticipant[] = [{ id: 'ana', name: 'Ana', isGuest: false }, { id: 'bia', name: 'Bia', isGuest: true }]

describe('Nem Ferrando autosave', () => {
  beforeEach(async () => {
    await LocalPreferences.remove(STORAGE_KEYS.nemFerrandoSession)
    await LocalPreferences.remove(STORAGE_KEYS.nemFerrandoOpeningHistory)
    useNemFerrandoStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('saves and resumes an active match', async () => {
    await useNemFerrandoStore.getState().initialize('pt-BR')
    await useNemFerrandoStore.getState().start(participants, 10)
    const saved = await LocalPreferences.getJson<NemFerrandoSession>(STORAGE_KEYS.nemFerrandoSession)
    expect(saved?.participants).toHaveLength(2)
    useNemFerrandoStore.setState({ session: null, initialized: false })
    await useNemFerrandoStore.getState().initialize('pt-BR')
    const resumed = useNemFerrandoStore.getState().session
    expect(resumed?.id).toBe(saved?.id)
    expect(resumed?.cardQueue).toEqual(saved?.cardQueue)
    expect(resumed?.passNumber).toBe(saved?.passNumber)
    expect(resumed?.passPosition).toBe(saved?.passPosition)
    expect(resumed?.phase).toBe('starting')
  })

  it('restores a used card swap from autosave', async () => {
    await useNemFerrandoStore.getState().initialize('pt-BR')
    await useNemFerrandoStore.getState().start(participants, 10)
    await useNemFerrandoStore.getState().revealFirst()
    await useNemFerrandoStore.getState().swap()
    const saved = await LocalPreferences.getJson<NemFerrandoSession>(STORAGE_KEYS.nemFerrandoSession)
    expect(saved?.swappedThisTurn).toBe(true)
    useNemFerrandoStore.setState({ session: null, initialized: false })
    await useNemFerrandoStore.getState().initialize('pt-BR')
    expect(useNemFerrandoStore.getState().session?.swappedThisTurn).toBe(true)
    expect(useNemFerrandoStore.getState().session?.currentCardId).toBe(saved?.currentCardId)
  })

  it('blocks a saved match from another deck version', async () => {
    await useNemFerrandoStore.getState().initialize('pt-BR')
    await useNemFerrandoStore.getState().start(participants, 10)
    const saved = await LocalPreferences.getJson<NemFerrandoSession>(STORAGE_KEYS.nemFerrandoSession)
    await LocalPreferences.setJson(STORAGE_KEYS.nemFerrandoSession, { ...saved, deckVersion: 999 })
    useNemFerrandoStore.setState({ session: null, initialized: false })
    await useNemFerrandoStore.getState().initialize('pt-BR')
    expect(useNemFerrandoStore.getState().session).toBeNull()
    expect(useNemFerrandoStore.getState().resumeError).toMatch(/outra versão/i)
  })

  it('blocks a saved match from the previous session schema', async () => {
    await useNemFerrandoStore.getState().initialize('pt-BR')
    await useNemFerrandoStore.getState().start(participants, 10)
    const saved = await LocalPreferences.getJson<NemFerrandoSession>(STORAGE_KEYS.nemFerrandoSession)
    await LocalPreferences.setJson(STORAGE_KEYS.nemFerrandoSession, { ...saved, schemaVersion: 2 })
    useNemFerrandoStore.setState({ session: null, initialized: false })
    await useNemFerrandoStore.getState().initialize('pt-BR')
    expect(useNemFerrandoStore.getState().session).toBeNull()
  })

  it('persists the opening history and avoids repeating it', async () => {
    await useNemFerrandoStore.getState().initialize('pt-BR')
    await useNemFerrandoStore.getState().start(participants, 10)
    const first = useNemFerrandoStore.getState().session!
    await useNemFerrandoStore.getState().discard()
    await useNemFerrandoStore.getState().start(participants, 10)
    const second = useNemFerrandoStore.getState().session!
    expect(second.currentCardId).not.toBe(first.currentCardId)
    expect(second.currentPlayerIndex).not.toBe(first.currentPlayerIndex)
  })
})
