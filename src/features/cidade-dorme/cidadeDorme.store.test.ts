import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { createDefaultCidadeDormeSettings } from './cidadeDorme.setup'
import { useCidadeDormeStore } from './cidadeDorme.store'
import type { CidadeDormePlayerInput, GameState } from './cidadeDorme.types'

const players: CidadeDormePlayerInput[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'caio', name: 'Caio' },
  { id: 'dani', name: 'Dani' },
]

describe('Cidade Dorme store', () => {
  beforeEach(async () => {
    await LocalPreferences.remove(STORAGE_KEYS.cidadeDormeSession)
    useCidadeDormeStore.setState({ session: null, initialized: false, loading: false, resumeError: null })
  })

  it('autosaves and resumes reveal progress without visible secret state', async () => {
    await useCidadeDormeStore.getState().initialize()
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    await useCidadeDormeStore.getState().advanceReveal()
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('revealRoles')
    expect(saved?.currentRevealIndex).toBe(1)
    expect(Object.keys(saved ?? {}).some((key) => /visible|shown|secret/i.test(key))).toBe(false)

    useCidadeDormeStore.setState({ session: null, initialized: false })
    await useCidadeDormeStore.getState().initialize()
    expect(useCidadeDormeStore.getState().session?.id).toBe(saved?.id)
    expect(useCidadeDormeStore.getState().session?.currentRevealIndex).toBe(1)
  })

  it('rejects incompatible saved sessions', async () => {
    await LocalPreferences.setJson(STORAGE_KEYS.cidadeDormeSession, { schemaVersion: 1, gameId: 'cidade-dorme', phase: 'revealRoles' })
    await useCidadeDormeStore.getState().initialize()
    expect(useCidadeDormeStore.getState().session).toBeNull()
    expect(useCidadeDormeStore.getState().resumeError).toMatch(/não pôde ser retomada/i)
  })

  it('persists generic phase advancement through the state machine', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({ session: { ...session, currentRevealIndex: session.players.length - 1 } })

    await useCidadeDormeStore.getState().advancePhase()
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('nightIntro')
    expect(useCidadeDormeStore.getState().session?.phase).toBe('nightIntro')
  })

  it('persists the beginning of night actions', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({ session: { ...session, phase: 'nightIntro' } })

    await useCidadeDormeStore.getState().advancePhase()
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('killerTurn')
    expect(useCidadeDormeStore.getState().session?.phase).toBe('killerTurn')
  })

  it('persists the killer target and advances to the next night role', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({ session: { ...session, phase: 'killerTurn' } })

    await useCidadeDormeStore.getState().chooseKillerTarget('bia')
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('detectiveTurn')
    expect(saved?.currentNightAction).toMatchObject({ round: 1, killerTargetId: 'bia' })
  })

  it('discards the active session', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    await useCidadeDormeStore.getState().discard()
    expect(await LocalPreferences.getJson(STORAGE_KEYS.cidadeDormeSession)).toBeNull()
    expect(useCidadeDormeStore.getState().session).toBeNull()
  })
})
