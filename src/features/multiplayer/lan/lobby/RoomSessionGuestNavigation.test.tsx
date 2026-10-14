import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPersistentLanInvite, encodePersistentLanInvite } from '../lanPersistentInvite'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import { HomeRoomActions } from '../../../hub/HomeRoomActions'
import { LanPersistentLobbyScreen } from './LanPersistentLobbyScreen'
import { RoomSessionProvider } from './RoomSessionProvider'

const guest = vi.hoisted(() => ({ joins: 0, disconnects: 0, leaves: 0, resumes: 0, live: true, closed: false, scanned: '' }))
const roomId = 'g2-test-room'
const playerId = 'guest-one'
const secret = 'PRIVATE-G2-NEVER-IN-HOME'

function roomSnapshot(): RoomSnapshotV2 {
  return {
    protocolVersion: 2, roomId, revision: 4,
    roomState: {
      hostPlayerId: 'host', phase: 'playing',
      members: [
        { playerId: 'host', role: 'host', connected: true, ready: true, participation: 'active' },
        { playerId, role: 'guest', connected: true, ready: true, participation: 'active' },
      ],
      selectedGameId: 'toy', selectedConfig: { rounds: 2 },
      currentGameSessionId: 'round-1', lastPublicResult: null, barriers: [],
    },
    gamePublicState: { gameSessionId: 'round-1', gameId: 'toy', data: { clueCount: 0 } },
    privateState: { gameSessionId: 'round-1', gameId: 'toy', data: { secret } },
    nextClientSeq: 2,
  }
}

vi.mock('../LanQrScanner', () => ({ LanQrScanner: ({ onScan }: { onScan: (raw: string) => void }) =>
  <button onClick={() => onScan(guest.scanned)}>Capturar QR</button> }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,dGVzdA==') } }))
vi.mock('../lanSecureNativeClient', () => ({ LanSecureNativeClient: class {} }))
vi.mock('../lanPersistentGuestAdmission', () => ({
  LanPersistentGuestAdmission: class {
    async connectInvite() { guest.joins++; guest.live = true; return { playerId: 'guest-one', snapshot: roomSnapshot() } }
    getState() { return guest.live && !guest.closed ? roomSnapshot() : null }
    wasClosedByHost() { return guest.closed }
    async sendCommand() { return { status: 'accepted' } }
    async disconnect() { guest.disconnects++; guest.live = false }
    async leaveRoom() { guest.leaves++; guest.live = false }
    async resume() { guest.resumes++; guest.live = true; return { playerId: 'guest-one', snapshot: roomSnapshot() } }
  },
}))

afterEach(() => { cleanup(); guest.joins = 0; guest.disconnects = 0; guest.leaves = 0; guest.resumes = 0; guest.live = true; guest.closed = false })

function Harness() {
  return <MemoryRouter initialEntries={['/__lan-lobby-v2/entrar']}>
    <RoomSessionProvider>
      <Routes>
        <Route path="/" element={<><h1>Todos os jogos</h1><HomeRoomActions /></>} />
        <Route path="/__lan-lobby-v2/entrar" element={<LanPersistentLobbyScreen initialMode="join" />} />
        <Route path="/__lan-lobby-v2" element={<LanPersistentLobbyScreen />} />
      </Routes>
    </RoomSessionProvider>
  </MemoryRouter>
}

function enter() {
  const invitation = createPersistentLanInvite({
    roomId, hostIp: '10.0.0.1', port: 43211, fingerprint: 'ab'.repeat(32), capability: 'cd'.repeat(32),
  })
  guest.scanned = encodePersistentLanInvite(invitation)
  fireEvent.click(screen.getByRole('button', { name: 'Ler QR Code' }))
  fireEvent.click(screen.getByRole('button', { name: 'Capturar QR' }))
}

describe('G2 guest navigation lifecycle', () => {
  it('preserves the admitted guest connection, but never copies a private card into the home banner', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(guest.joins).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /Revelar minha carta/ }))
    expect(screen.getByText(secret)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver jogos/ }))
    expect(screen.getByRole('heading', { name: 'Todos os jogos' })).toBeInTheDocument()
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à sala' })).toBeInTheDocument()
    expect(guest.disconnects).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à sala' }))
    expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument()
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Revelar minha carta/ })).toBeInTheDocument()
    expect(guest.joins).toBe(1)
    expect(guest.disconnects).toBe(0)
  })

  it('scrubs private state on dropped guest transport even while navigating and allows existing secure resume', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    guest.live = false
    await waitFor(() => expect(screen.getByText(/Conexão interrompida/)).toBeInTheDocument(), { timeout: 2200 })
    expect(screen.queryByRole('button', { name: /Revelar minha carta/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ver jogos/ }))
    expect(screen.getByText(/Conexão interrompida/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à sala' }))
    fireEvent.click(screen.getByRole('button', { name: /Reconectar/ }))
    await waitFor(() => expect(guest.resumes).toBe(1))
    expect(guest.disconnects).toBe(1)
    await waitFor(() => expect(screen.getByRole('button', { name: /Revelar minha carta/ })).toBeInTheDocument())
  })

  it('removes a terminated room and does not offer resume after an authenticated host closure', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    guest.closed = true
    await waitFor(() => expect(screen.getByTestId('pl03-entry')).toBeInTheDocument(), { timeout: 2500 })
    expect(screen.getByRole('alert')).toHaveTextContent(/encerrada pelo anfitrião/i)
    expect(guest.resumes).toBe(0)
    expect(screen.queryByRole('button', { name: /Reconectar/ })).not.toBeInTheDocument()
  })

  it('redacts the lost guest private projection immediately when the app returns to foreground', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Revelar minha carta/ }))
    expect(screen.getByText(secret)).toBeInTheDocument()
    guest.live = false
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revelar minha carta/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Conexão interrompida/)).toBeInTheDocument()
    expect(guest.disconnects).toBe(0)
  })

  it('allows a disconnected guest to close locally without claiming an authenticated leave', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    guest.live = false
    await waitFor(() => expect(screen.getByText(/Conexão interrompida/)).toBeInTheDocument(), { timeout: 2200 })
    fireEvent.click(screen.getByRole('button', { name: /Sair da sala/ }))
    expect(screen.getByText(/não será confirmada pelo anfitrião/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar neste aparelho' }))
    await waitFor(() => expect(screen.getByTestId('pl03-entry')).toBeInTheDocument())
    expect(guest.leaves).toBe(0)
    expect(guest.disconnects).toBe(1)
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reconectar/ })).not.toBeInTheDocument()
  })

  it('explicit leave is terminal and removes the active room banner', async () => {
    render(<Harness />)
    enter()
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Sair da sala/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sim, sair da sala/ }))
    await waitFor(() => expect(guest.leaves).toBe(1))
    expect(screen.getByTestId('pl03-entry')).toBeInTheDocument()
  })
})
