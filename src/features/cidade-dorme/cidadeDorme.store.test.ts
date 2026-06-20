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

const playersWithDoctor: CidadeDormePlayerInput[] = [
  ...players,
  { id: 'eli', name: 'Eli' },
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
    useCidadeDormeStore.setState({
      session: {
        ...session,
        phase: 'killerTurn',
        players: session.players.map((player) => player.id === 'ana' ? { ...player, roleKey: 'killer' } : { ...player, roleKey: 'citizen' }),
      },
    })

    await useCidadeDormeStore.getState().chooseKillerTarget('ana', 'bia')
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('detectiveTurn')
    expect(saved?.currentNightAction).toMatchObject({ round: 1, killerActorId: 'ana', killerTargetId: 'bia' })
  })

  it('persists doctor protection and advances to the next night role', async () => {
    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))
    const session = useCidadeDormeStore.getState().session!
    const doctorTurn: GameState = {
      ...session,
      phase: 'doctorTurn',
      players: session.players.map((player) => player.id === 'bia' ? { ...player, roleKey: 'doctor' } : player.id === 'caio' ? { ...player, roleKey: 'detective' } : player.id === 'ana' ? { ...player, roleKey: 'killer' } : { ...player, roleKey: 'citizen' }),
    }
    useCidadeDormeStore.setState({ session: doctorTurn })

    await useCidadeDormeStore.getState().chooseDoctorProtection('caio')
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('detectiveTurn')
    expect(saved?.currentNightAction).toMatchObject({ round: 1, protectedPlayerId: 'caio' })
  })

  it('advances enabled eliminated night roles as fake turns without recording actions', async () => {
    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({
      session: {
        ...session,
        phase: 'doctorTurn',
        players: session.players.map((player) => {
          if (player.id === 'bia') return { ...player, roleKey: 'doctor', status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'vote' }
          if (player.id === 'caio') return { ...player, roleKey: 'detective', status: 'eliminated', eliminatedAtRound: 1, eliminationReason: 'vote' }
          if (player.id === 'ana') return { ...player, roleKey: 'killer' }
          return { ...player, roleKey: 'citizen' }
        }),
      },
    })

    await useCidadeDormeStore.getState().advancePhase()
    expect(useCidadeDormeStore.getState().session).toMatchObject({ phase: 'detectiveTurn', currentNightAction: { round: 1 } })
    await useCidadeDormeStore.getState().advancePhase()
    expect(useCidadeDormeStore.getState().session).toMatchObject({ phase: 'nightResolution', currentNightAction: { round: 1 } })
  })

  it('persists detective investigation and advances to night resolution', async () => {
    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({
      session: {
        ...session,
        phase: 'detectiveTurn',
        players: session.players.map((player) => player.id === 'caio' ? { ...player, roleKey: 'detective' } : player.id === 'ana' ? { ...player, roleKey: 'killer' } : { ...player, roleKey: 'citizen' }),
      },
    })

    await useCidadeDormeStore.getState().chooseDetectiveTarget('ana')
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('nightResolution')
    expect(saved?.currentNightAction).toMatchObject({ round: 1, detectiveTargetId: 'ana' })
  })

  it('persists night resolution', async () => {
    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({
      session: {
        ...session,
        phase: 'nightResolution',
        players: session.players.map((player) => player.id === 'ana' ? { ...player, roleKey: 'killer' } : player),
        currentNightAction: { round: 1, killerTargetId: 'dani', protectedPlayerId: 'caio', detectiveTargetId: 'ana' },
      },
    })

    await useCidadeDormeStore.getState().resolveNight()
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.currentNightAction).toMatchObject({ eliminatedPlayerId: 'dani', detectiveResult: 'suspect' })
    expect(saved?.history[0]?.nightAction).toMatchObject({ eliminatedPlayerId: 'dani' })
  })

  it('persists manual voting and detects winner', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    const session = useCidadeDormeStore.getState().session!
    useCidadeDormeStore.setState({
      session: {
        ...session,
        phase: 'voting',
        players: session.players.map((player) => player.id === 'ana' ? { ...player, roleKey: 'killer' } : { ...player, roleKey: 'citizen' }),
      },
    })

    await useCidadeDormeStore.getState().resolveVoting({ kind: 'eliminated', playerId: 'ana' })
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('gameOver')
    expect(saved?.winner).toBe('city')
    expect(saved?.history[0]?.votingResult).toMatchObject({ kind: 'eliminated', eliminatedPlayerId: 'ana' })
  })

  it('migrates legacy saved voting sessions on initialize', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    const session = useCidadeDormeStore.getState().session!
    await LocalPreferences.setJson(STORAGE_KEYS.cidadeDormeSession, {
      ...session,
      phase: 'voting',
      currentVotes: [{ voterId: 'bia', targetId: 'ana' }],
    })
    useCidadeDormeStore.setState({ session: null, initialized: false })

    await useCidadeDormeStore.getState().initialize()
    expect(useCidadeDormeStore.getState().session?.phase).toBe('dayDiscussion')
    expect(useCidadeDormeStore.getState().session).not.toHaveProperty('currentVotes')
  })

  it('does not persist invalid doctor protection', async () => {
    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))
    const session = useCidadeDormeStore.getState().session!
    const doctorTurn: GameState = {
      ...session,
      phase: 'doctorTurn',
      players: session.players.map((player) => player.id === 'bia' ? { ...player, roleKey: 'doctor' } : player.id === 'caio' ? { ...player, roleKey: 'detective' } : player.id === 'ana' ? { ...player, roleKey: 'killer' } : { ...player, roleKey: 'citizen' }),
    }
    useCidadeDormeStore.setState({ session: doctorTurn })

    await useCidadeDormeStore.getState().chooseDoctorProtection('bia')
    const saved = await LocalPreferences.getJson<GameState>(STORAGE_KEYS.cidadeDormeSession)
    expect(saved?.phase).toBe('revealRoles')
    expect(useCidadeDormeStore.getState().session?.phase).toBe('doctorTurn')
  })

  it('discards the active session', async () => {
    await useCidadeDormeStore.getState().start(players, createDefaultCidadeDormeSettings(players.length))
    await useCidadeDormeStore.getState().discard()
    expect(await LocalPreferences.getJson(STORAGE_KEYS.cidadeDormeSession)).toBeNull()
    expect(useCidadeDormeStore.getState().session).toBeNull()
  })
})
