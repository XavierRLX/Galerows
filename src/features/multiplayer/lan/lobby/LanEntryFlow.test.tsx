import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { LanPersistentLobbyScreen } from './LanPersistentLobbyScreen'
import { RoomSessionContext } from './RoomSessionContext'
import type { RoomSession } from './RoomSessionProvider'

const session = { mode: 'entry', startHost: vi.fn(), setScannerOpen: vi.fn(), setError: vi.fn(),
  joinScannedInvite: vi.fn(), leave: vi.fn(), closeRoom: vi.fn(), busy: false, error: '',
  preferHotspot: false, setPreferHotspot: vi.fn(), scannerOpen: false } as unknown as RoomSession
vi.mock('./LanRoomDiscoveryList', () => ({ LanRoomDiscoveryList: () => <h2>Salas disponíveis</h2> }))
vi.mock('../LanQrScanner', () => ({ LanQrScanner: ({ onScan }: { onScan: (value: string) => void }) =>
  <button onClick={() => onScan('scanned-invite')}>Simular leitura</button> }))
afterEach(() => { cleanup(); vi.clearAllMocks(); session.scannerOpen = false })
function renderEntry(mode: 'create' | 'join') {
  return render(<StrictMode><MemoryRouter><RoomSessionContext.Provider value={session}><Routes>
    <Route path="/" element={<LanPersistentLobbyScreen initialMode={mode} />} />
    <Route path="/players" element={<h1>Minha Galera</h1>} />
  </Routes></RoomSessionContext.Provider></MemoryRouter></StrictMode>)
}
it('creates once on the create route, without a repeated menu even under StrictMode', async () => {
  renderEntry('create')
  await waitFor(() => expect(session.startHost).toHaveBeenCalledOnce())
  expect(screen.queryByRole('button', { name: /Entrar em sala/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/O jogo começa/)).not.toBeInTheDocument()
})
it('opens discovery directly and back goes to Minha Galera without leaving a room', () => {
  renderEntry('join')
  expect(screen.getByRole('heading', { name: 'Entrar em sala' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Salas disponíveis' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para Minha Galera' }))
  expect(screen.getByRole('heading', { name: 'Minha Galera' })).toBeInTheDocument()
  expect(session.leave).not.toHaveBeenCalled()
  expect(session.closeRoom).not.toHaveBeenCalled()
})
it('hands a scanned invitation straight to admission and closes the camera', () => {
  session.scannerOpen = true
  renderEntry('join')
  fireEvent.click(screen.getByRole('button', { name: 'Simular leitura' }))
  expect(session.joinScannedInvite).toHaveBeenCalledWith('scanned-invite')
  expect(session.setScannerOpen).toHaveBeenCalledWith(false)
})
