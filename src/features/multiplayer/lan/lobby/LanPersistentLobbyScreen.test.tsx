import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanPersistentLobbyScreen } from './LanPersistentLobbyScreen'
import { decodePersistentLanInvite } from '../lanPersistentInvite'
import type { PersistentLanFrame } from '../lanPersistentWire'

const network = vi.hoisted(() => ({ available: true, invites: [] as string[], lastPreference: null as boolean | null,
  emit: null as ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | null,
  sent: [] as Array<{ peerId: string; frame: PersistentLanFrame }>,
}))

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async (invite: string) => { network.invites.push(invite); return 'data:image/png;base64,dGVzdA==' }) } }))
vi.mock('../lanNativeHost', () => ({
  LanNativeHost: class {
    discoverLanAddress = async (preferHotspot = false) => {
      network.lastPreference = preferHotspot
      if (!network.available) throw new Error('lan_interface_unavailable')
      return { ip: '10.0.0.1', interfaceName: 'wlan0' }
    }
    startSecureV2 = async () => ({ port: 43211, fingerprint: 'ab'.repeat(32) })
    rotateInviteToken = async () => undefined
    registerResumeToken = async () => undefined
    revokeResumeToken = async () => undefined
    closePeer = async () => undefined
    sendV2 = async (peerId: string, frame: PersistentLanFrame) => { network.sent.push({ peerId, frame }) }
    stop = async () => undefined
    onV2Event = async (listener: NonNullable<typeof network.emit>) => {
      network.emit = listener
      return { remove: async () => { network.emit = null } }
    }
  },
}))

afterEach(() => { network.invites = []; network.lastPreference = null; network.available = true; network.emit = null; network.sent = []; cleanup() })

describe('PL-03 Android lobby journey', () => {
  it('opens discovery directly without legacy technical fields', () => {
    render(<MemoryRouter><LanPersistentLobbyScreen initialMode="join" /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Salas disponíveis' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Verificação do QR/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar sala/ })).not.toBeInTheDocument()
  })

  it('defaults to shared Wi-Fi and supports explicitly choosing the host hotspot', async () => {
    render(<MemoryRouter><LanPersistentLobbyScreen /></MemoryRouter>)
    fireEvent.click(screen.getByText('Opções de rede'))
    const selectHotspot = screen.getByRole('checkbox', { name: /Usar hotspot deste celular/i })
    expect(selectHotspot).not.toBeChecked()
    fireEvent.click(selectHotspot)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(network.lastPreference).toBe(true)
  })

  it('guides player to enable Wi-Fi when there is no LAN IP yet', async () => {
    network.available = false
    render(<MemoryRouter><LanPersistentLobbyScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Ative o Wi-Fi/))
    expect(screen.getByRole('button', { name: /Criar sala/ })).toBeEnabled()
  })

  it('rotates the QR payload internally without exposing an invitation field after an authenticated guest joins', async () => {
    render(<MemoryRouter><LanPersistentLobbyScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const currentInvite = () => network.invites.at(-1)!
    const first = currentInvite()
    const parsed = decodePersistentLanInvite(first)
    if (!parsed.ok) throw new Error('invalid_test_invite')
    network.emit?.({ type: 'connected', peerId: 'second-phone' })
    network.emit?.({ type: 'message', peerId: 'second-phone',
      frame: { kind: 'joinRequestV2', protocolVersion: 2, invite: parsed.invite } })
    await waitFor(() => expect(network.sent.some(({ frame }) => frame.kind === 'admittedV2')).toBe(true))
    const admission = network.sent.find(({ frame }) => frame.kind === 'admittedV2')?.frame
    if (!admission || admission.kind !== 'admittedV2') throw new Error('missing_admission')
    network.emit?.({ type: 'message', peerId: 'second-phone', frame: {
      kind: 'admissionAckV2', protocolVersion: 2, roomId: parsed.invite.roomId,
      playerId: admission.playerId, admissionId: admission.admissionId,
    } })
    await waitFor(() => expect(screen.getByText('0 / 2 prontos')).toBeInTheDocument())
    await waitFor(() => expect(currentInvite()).not.toBe(first), { timeout: 2500 })
    expect(decodePersistentLanInvite(currentInvite()).ok).toBe(true)
  })

  it('creates a native-secured host Room, selects a real game and keeps start disabled with only host', async () => {
    render(<MemoryRouter><LanPersistentLobbyScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(screen.queryByText('1 / 1 prontos')).not.toBeInTheDocument()
    expect(screen.getByText('0 / 1 prontos')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Convidar amigos'))
    expect(screen.getByRole('img', { name: 'QR de convite da sala' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Impostor da Palavra' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Salvar regras/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Salvar regras/ }))
    await waitFor(() => expect(screen.getByText('Regras confirmadas para esta rodada')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Iniciar rodada/ })).toBeDisabled()
    // Ending the game and closing the Room are intentionally distinct controls.
    expect(screen.queryByRole('button', { name: 'Encerrar rodada' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Encerrar sala/ }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Encerrar a sala?' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Sim, encerrar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-entry')).toBeInTheDocument())
  })
})

it('keeps the game chosen on the catalog when creating a new Room', async () => {
  render(<MemoryRouter initialEntries={['/__lan-lobby-v2/criar?game=cidade-dorme']}>
    <LanPersistentLobbyScreen initialMode="create" />
  </MemoryRouter>)
  await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('group', { name: 'Modo de condução do Cidade Dorme' })).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Selecionar Cidade Dorme' })).not.toBeInTheDocument()
})

it('ignores unknown game intents and keeps the manual game catalog', async () => {
  render(<MemoryRouter initialEntries={['/__lan-lobby-v2/criar?game=toy']}>
    <LanPersistentLobbyScreen initialMode="create" />
  </MemoryRouter>)
  await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Selecionar Cidade Dorme' })).toBeInTheDocument()
})

it('creates directly and does not recreate a room after explicit closure on the create route', async () => {
  render(<MemoryRouter><LanPersistentLobbyScreen initialMode="create" /></MemoryRouter>)
  await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
  expect(network.lastPreference).toBe(false)
  expect(screen.queryByRole('button', { name: 'Entrar em sala' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Encerrar sala' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sim, encerrar sala' }))
  await waitFor(() => expect(screen.getByTestId('pl03-entry')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Criar sala' })).toBeEnabled()
  expect(network.invites).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))
  await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
  expect(network.invites).toHaveLength(2)
})
