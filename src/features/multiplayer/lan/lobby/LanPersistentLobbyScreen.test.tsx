import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanPersistentLobbyScreen } from './LanPersistentLobbyScreen'
import { decodePersistentLanInvite } from '../lanPersistentInvite'
import type { PersistentLanFrame } from '../lanPersistentWire'

const network = vi.hoisted(() => ({ available: true, lastPreference: null as boolean | null,
  emit: null as ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void) | null,
  sent: [] as Array<{ peerId: string; frame: PersistentLanFrame }>,
}))

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,dGVzdA==') } }))
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

afterEach(() => { network.lastPreference = null; network.available = true; network.emit = null; network.sent = []; cleanup() })

describe('PL-03 Android lobby journey', () => {
  it('defaults to shared Wi-Fi and supports explicitly choosing the host hotspot', async () => {
    render(<LanPersistentLobbyScreen />)
    const selectHotspot = screen.getByRole('checkbox', { name: /Usar hotspot deste celular/i })
    expect(selectHotspot).not.toBeChecked()
    fireEvent.click(selectHotspot)
    fireEvent.click(screen.getByRole('button', { name: /Criar uma sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(network.lastPreference).toBe(true)
  })

  it('guides player to enable Wi-Fi when there is no LAN IP yet', async () => {
    network.available = false
    render(<LanPersistentLobbyScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Criar uma sala/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Ative o Wi-Fi/))
    expect(screen.getByRole('button', { name: /Criar uma sala/ })).toBeEnabled()
  })

  it('refreshes the QR and manual invite after an authenticated guest joins', async () => {
    render(<LanPersistentLobbyScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Criar uma sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    const field = () => screen.getByLabelText('Texto completo do convite') as HTMLTextAreaElement
    const first = field().value
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
    await waitFor(() => expect(field().value).not.toBe(first), { timeout: 2500 })
    expect(decodePersistentLanInvite(field().value).ok).toBe(true)
  })

  it('shows two distinct LAN entry options and accessible manual invitation', () => {
    render(<LanPersistentLobbyScreen />)
    expect(screen.getByRole('heading', { name: /O jogo começa com a galera/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar uma sala/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Entrar numa sala/ }))
    expect(screen.getByRole('heading', { name: /Entre na roda/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Convite da sala')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de verificação do anfitrião')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar na sala/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: /Criar uma sala/ })).toBeInTheDocument()
  })

  it('creates a native-secured host Room, selects synthetic game and keeps start disabled with only host', async () => {
    render(<LanPersistentLobbyScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Criar uma sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(screen.queryByText('1 / 1 prontos')).not.toBeInTheDocument()
    expect(screen.getByText('0 / 1 prontos')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'QR de convite da sala' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Cartas secretas' }))
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
