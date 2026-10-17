import { Capacitor } from '@capacitor/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n, { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { CidadeDormeHomeScreen } from '../cidade-dorme/CidadeDormeHomeScreen'
import { useCidadeDormeStore } from '../cidade-dorme/cidadeDorme.store'
import { createDefaultCidadeDormeSettings } from '../cidade-dorme/cidadeDorme.setup'
import { ImpostorDaPalavraHomeScreen } from '../impostor-da-palavra/ImpostorDaPalavraHomeScreen'
import { useImpostorDaPalavraStore } from '../impostor-da-palavra/impostorDaPalavra.store'
import { RoomSessionContext } from '../multiplayer/lan/lobby/RoomSessionContext'
import type { RoomSession } from '../multiplayer/lan/lobby/RoomSessionProvider'
import { PistaUnicaHomeScreen } from '../pista-unica/PistaUnicaHomeScreen'
import { usePistaUnicaStore } from '../pista-unica/pistaUnica.store'

const participants = ['Ana', 'Bia', 'Caio', 'Dani'].map((name) => ({ id: name, name, isGuest: false }))
const games = [
  { id: 'cidade-dorme', Screen: CidadeDormeHomeScreen, store: useCidadeDormeStore, key: STORAGE_KEYS.cidadeDormeSession },
  { id: 'impostor-da-palavra', Screen: ImpostorDaPalavraHomeScreen, store: useImpostorDaPalavraStore, key: STORAGE_KEYS.impostorDaPalavraSession },
  { id: 'pista-unica', Screen: PistaUnicaHomeScreen, store: usePistaUnicaStore, key: STORAGE_KEYS.pistaUnicaSession },
] as const

// Only inject the context value: mounting the native provider would start transport polling.
function activeRoom(): RoomSession {
  const noop = () => undefined
  return {
    mode: 'active', preferHotspot: false, setPreferHotspot: noop, role: 'guest',
    invitation: '', setInvitation: noop, enteredCode: '', setEnteredCode: noop,
    roomId: 'existing-room', playerId: 'guest', snapshot: null, qr: '', hostCode: '', roomCode: '', hostIp: '',
    scannerOpen: false, setScannerOpen: noop, status: '', error: '', setError: noop,
    busy: false, connected: true, startHost: noop, joinGuest: noop, joinScannedInvite: noop,
    joinDiscoveredRoom: noop, resumeGuest: noop, action: noop, leave: noop,
    closeRoom: noop, refreshInvite: noop, saveDisplayName: noop,
  }
}

function Destination() {
  const { pathname, search } = useLocation()
  return <p>Destino: {pathname}{search}</p>
}

function openGame(game: typeof games[number], room: RoomSession | null = null) {
  const { Screen } = game
  render(<MemoryRouter initialEntries={[`/games/${game.id}`]}>
    <RoomSessionContext.Provider value={room}><Routes>
      <Route path={`/games/${game.id}`} element={<Screen />} />
      <Route path="*" element={<Destination />} />
    </Routes></RoomSessionContext.Provider>
  </MemoryRouter>)
}

async function chooseLocal() {
  await userEvent.click(await screen.findByRole('button', { name: /^1 celular/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /(?:configurar partida|continuar partida).*1 celular/i })).toBeEnabled())
}

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => {
  vi.stubEnv('VITE_GAMES_FIRST_LAN_ENTRY', '1')
  vi.stubEnv('VITE_LAN_PERSISTENT_LOBBY_UI', '1')
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  await i18n.changeLanguage('pt-BR')
  for (const game of games) await LocalPreferences.remove(game.key)
  useCidadeDormeStore.setState({ session: null, initialized: false, loading: false, resumeError: null })
  useImpostorDaPalavraStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  usePistaUnicaStore.setState({ session: null, initialized: false, loading: false })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs() })

for (const game of games) describe(`${game.id} unified mode entry`, () => {
  it('requires one mode choice before showing configuration or room actions', async () => {
    openGame(game)
    expect(await screen.findByRole('button', { name: /^1 celular/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^multiplayer local/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /configurar partida/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^criar sala/i })).not.toBeInTheDocument()
  })

  it('opens local setup without any registered participants or room', async () => {
    openGame(game)
    await chooseLocal()
    expect(screen.getByText(/Minha Galera.*salva os nomes/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /configurar partida.*1 celular/i }))
    expect(screen.getByText(`Destino: /games/${game.id}/setup`)).toBeInTheDocument()
  })

  it('keeps the local action disabled until saved sessions finish loading', async () => {
    if (game.id === 'cidade-dorme') useCidadeDormeStore.setState({ loading: true })
    else if (game.id === 'impostor-da-palavra') useImpostorDaPalavraStore.setState({ loading: true })
    else usePistaUnicaStore.setState({ loading: true })
    openGame(game)
    await userEvent.click(screen.getByRole('button', { name: /^1 celular/i }))
    expect(screen.getByRole('button', { name: /configurar partida.*1 celular/i })).toBeDisabled()
  })

  for (const terminal of [false, true]) it(`resumes ${terminal ? 'finished results' : 'the current local phase'} without clearing the save`, async () => {
    if (game.id === 'cidade-dorme') {
      await useCidadeDormeStore.getState().start(participants, createDefaultCidadeDormeSettings(4))
      if (terminal) await LocalPreferences.setJson(game.key, { ...useCidadeDormeStore.getState().session!, phase: 'gameOver', winner: 'city' })
    } else if (game.id === 'impostor-da-palavra') {
      await useImpostorDaPalavraStore.getState().initialize('pt-BR')
      await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'no-word', conversationMode: 'one-word' })
      if (terminal) await LocalPreferences.setJson(game.key, { ...useImpostorDaPalavraStore.getState().session!, phase: 'finished' })
    } else {
      await usePistaUnicaStore.getState().start(participants, ['words'])
      if (terminal) await LocalPreferences.setJson(game.key, { ...usePistaUnicaStore.getState().session!, phase: 'finished' })
    }
    const saved = await LocalPreferences.getJson(game.key)
    openGame(game)
    await chooseLocal()
    await userEvent.click(screen.getByRole('button', { name: /continuar partida.*1 celular/i }))
    expect(screen.getByText(`Destino: /games/${game.id}/${terminal ? 'result' : 'play'}`)).toBeInTheDocument()
    expect(await LocalPreferences.getJson(game.key)).toEqual(saved)
  })

  it('creates a new room with this game preselected', async () => {
    openGame(game)
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    await userEvent.click(screen.getByRole('button', { name: /^criar sala/i }))
    expect(screen.getByText(`Destino: /__lan-lobby-v2/criar?game=${game.id}`)).toBeInTheDocument()
  })

  it('joins without overriding the host game', async () => {
    openGame(game)
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    await userEvent.click(screen.getByRole('button', { name: /^entrar em sala/i }))
    expect(screen.getByText('Destino: /__lan-lobby-v2/entrar')).toBeInTheDocument()
  })

  it('returns to an active room instead of offering create or join', async () => {
    openGame(game, activeRoom())
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    expect(screen.queryByRole('button', { name: /^criar sala|^entrar em sala/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à sala' }))
    expect(screen.getByText('Destino: /__lan-lobby-v2')).toBeInTheDocument()
  })

  it('allows local play while a room is active', async () => {
    openGame(game, activeRoom())
    await chooseLocal()
    await userEvent.click(screen.getByRole('button', { name: /configurar partida.*1 celular/i }))
    expect(screen.getByText(`Destino: /games/${game.id}/setup`)).toBeInTheDocument()
  })

  for (const platform of ['web', 'ios']) it(`explains unavailable multiplayer on ${platform} without dead route actions`, async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue(platform)
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(platform !== 'web')
    openGame(game)
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    expect(screen.getByText(/disponível no Android.*multiplayer LAN/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^criar sala|^entrar em sala|^voltar à sala/i })).not.toBeInTheDocument()
    await chooseLocal()
    expect(screen.queryByText(/disponível no Android.*multiplayer LAN/i)).not.toBeInTheDocument()
  })

  for (const flag of ['VITE_GAMES_FIRST_LAN_ENTRY', 'VITE_LAN_PERSISTENT_LOBBY_UI']) it(`requires ${flag} to equal 1`, async () => {
    vi.stubEnv(flag, 'true')
    openGame(game)
    await userEvent.click(screen.getByRole('button', { name: /^multiplayer local/i }))
    expect(screen.queryByRole('button', { name: /^criar sala|^entrar em sala/i })).not.toBeInTheDocument()
    expect(screen.getByText(/disponível no Android.*multiplayer LAN/i)).toBeInTheDocument()
  })

  it('keeps rules and favorites accessible', async () => {
    openGame(game)
    expect(screen.getByRole('button', { name: /favorit/i })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: /como jogar/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('discards a saved local game only through the existing discard control', async () => {
    if (game.id === 'cidade-dorme') await useCidadeDormeStore.getState().start(participants, createDefaultCidadeDormeSettings(4))
    else if (game.id === 'impostor-da-palavra') {
      await useImpostorDaPalavraStore.getState().initialize('pt-BR')
      await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'no-word', conversationMode: 'one-word' })
    } else await usePistaUnicaStore.getState().start(participants, ['words'])
    openGame(game)
    await chooseLocal()
    await userEvent.click(screen.getByRole('button', { name: /descartar/i }))
    await waitFor(() => expect(game.store.getState().session).toBeNull())
    expect(await LocalPreferences.getJson(game.key)).toBeNull()
    expect(screen.getByRole('button', { name: /configurar partida.*1 celular/i })).toBeEnabled()
  })
})

it('resumes a saved Cidade Dorme setup in setup rather than entering play', async () => {
  await useCidadeDormeStore.getState().start(participants, createDefaultCidadeDormeSettings(4))
  await LocalPreferences.setJson(STORAGE_KEYS.cidadeDormeSession, { ...useCidadeDormeStore.getState().session!, phase: 'setup' })
  openGame(games[0])
  await chooseLocal()
  await userEvent.click(screen.getByRole('button', { name: /continuar partida.*1 celular/i }))
  expect(screen.getByText('Destino: /games/cidade-dorme/setup')).toBeInTheDocument()
})
