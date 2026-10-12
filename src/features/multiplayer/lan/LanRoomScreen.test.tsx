import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LanRoomScreen } from './LanRoomScreen'
import { createLanInvite, encodeLanInvite } from './lanInvite'
import type { LanFrame } from './lanWire'

const lan = vi.hoisted(() => ({ ip: '10.1.1.2', token: '' }))
afterEach(cleanup)
const client = vi.hoisted(() => ({ emit: (frame: unknown) => { void frame },
  close: () => undefined as void, resumeCalls: 0, clearCalls: 0, sent: [] as unknown[] }))
vi.mock('./lanNativeHost', () => ({ LanNativeHost: class {
  discoverLanAddress = async () => ({ ip: lan.ip, interfaceName: 'swlan0' })
  startSecure = async (_roomId: string, token: string) => { lan.token = token; return { port: 4321, fingerprint: 'ab'.repeat(32) } }
  rotateInviteToken = async (token: string) => { lan.token = token }
  registerResumeToken = async () => undefined
  revokeResumeToken = async () => undefined
  closePeer = async () => undefined
  send = async () => undefined
  stop = async () => undefined
  onEvent = async () => ({ remove: async () => undefined })
} }))
vi.mock('./lanSecureNativeClient', () => ({ LanSecureNativeClient: class {
  connect = async () => undefined
  connectResume = async () => { client.resumeCalls++; throw new Error('connection_lost') }
  storeResumeCredential = async () => undefined
  rotateResumeCredential = async () => undefined
  clearResumeCredential = async () => { client.clearCalls++ }
  disconnect = async () => undefined
  onEvent = async (listener: (event: unknown) => void) => {
    client.emit = frame => listener({ type: 'message', frame })
    client.close = () => listener({ type: 'closed' })
    return { remove: async () => undefined }
  }
  send = async (frame: LanFrame) => {
    client.sent.push(frame)
    if (frame.kind === 'joinRequest' && frame.invite) {
      const roomId = frame.invite.roomId
      queueMicrotask(() => client.emit({ kind: 'admitted', protocolVersion: 1, playerId: 'guest-1',
        snapshot: { protocolVersion: 1, roomId, revision: 2, roomState: { playerIds: ['host-1', 'guest-1'], barriers: [] },
          gamePublicState: { count: 0 }, privateState: null },
        admissionId: 'c'.repeat(64), resumeToken: 'd'.repeat(64), resumeExpiresAt: Date.now() + 60_000 }))
    }
    if (frame.kind === 'leaveRequest') {
      queueMicrotask(() => client.emit({ kind: 'leaveConfirmed', protocolVersion: 1,
        roomId: frame.roomId, playerId: frame.playerId, commandId: frame.commandId, revision: 3 }))
    }
  }
} }))

it('keeps legacy Adedonha QR out of LAN admission and explains manual entry', () => {
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: 'adedonha:legacy-code' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Este não é um convite LAN')
  expect(screen.queryByText('Na sala')).not.toBeInTheDocument()
})

it('rejects an expired manual invitation before opening a socket', () => {
  client.sent.length = 0
  const expired = createLanInvite({ roomId: 'expired', hostIp: '10.1.1.2', port: 4321,
    fingerprint: 'ab'.repeat(32), now: Date.now() - 121_000 })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(expired) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Convite vencido')
  expect(client.sent).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'joinRequest' })]))
})

it('shows a short lived QR, separate code and refreshes the host address', async () => {
  lan.ip = '10.1.1.2'
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala de teste' }))
  expect(await screen.findByRole('img', { name: 'QR do convite LAN' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  expect(screen.getByText('ABAB-ABAB-ABAB')).toBeInTheDocument()
  expect(screen.getByText('Endereço: 10.1.1.2:4321')).toBeInTheDocument()
  lan.ip = '10.1.1.3'
  fireEvent.click(screen.getByRole('button', { name: 'Renovar convite' }))
  await waitFor(() => expect(screen.getByText('Endereço: 10.1.1.3:4321')).toBeInTheDocument())
})

it('runs only the generic counter adapter command in the test room', async () => {
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala de teste' }))
  const button = await screen.findByRole('button', { name: 'Incrementar contador de teste' })
  fireEvent.click(button)
  expect(screen.getByText('Contador: 1')).toBeInTheDocument()
})

it('shows TLS code before joining and waits for the persisted credential ACK confirmation', async () => {
  client.sent.length = 0
  const invite = createLanInvite({ roomId: 'room-test', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(invite) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('ABAB-ABAB-ABAB')).toBeInTheDocument()
  expect(screen.queryByText('Na sala')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Código visto no anfitrião' }), { target: { value: 'ABAB-ABAB-ABAB' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código presencial' }))
  await waitFor(() => expect(client.sent).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'admissionAck' })])))
  expect(screen.queryByText('Na sala')).not.toBeInTheDocument()
  client.emit({ kind: 'admissionConfirmed', protocolVersion: 1, roomId: 'room-test', playerId: 'guest-1', admissionId: 'c'.repeat(64) })
  expect(await screen.findByRole('status')).toHaveTextContent('Na sala')
})

it('sends a definitive leave and clears the guest identity only after confirmation', async () => {
  client.sent.length = 0
  client.clearCalls = 0
  const invite = createLanInvite({ roomId: 'leave-room', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(invite) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('ABAB-ABAB-ABAB')
  fireEvent.change(screen.getByRole('textbox', { name: 'Código visto no anfitrião' }), { target: { value: 'ABAB-ABAB-ABAB' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código presencial' }))
  await waitFor(() => expect(client.sent).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'admissionAck' })])))
  client.emit({ kind: 'admissionConfirmed', protocolVersion: 1, roomId: 'leave-room', playerId: 'guest-1', admissionId: 'c'.repeat(64) })
  await screen.findByRole('button', { name: 'Incrementar contador de teste' })
  fireEvent.click(screen.getByRole('button', { name: 'Sair definitivamente' }))
  await waitFor(() => expect(client.sent).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'leaveRequest', roomId: 'leave-room', playerId: 'guest-1' })])))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Você saiu da sala'))
  expect(client.clearCalls).toBe(1)
  expect(screen.queryByRole('button', { name: 'Incrementar contador de teste' })).not.toBeInTheDocument()
})

it('rejects a different in-person code without sending a join request', async () => {
  client.sent.length = 0
  const invite = createLanInvite({ roomId: 'wrong-code', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(invite) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('ABAB-ABAB-ABAB')
  fireEvent.change(screen.getByRole('textbox', { name: 'Código visto no anfitrião' }), { target: { value: 'FFFF-FFFF-FFFF' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código presencial' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Código diferente')
  expect(client.sent).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'joinRequest' })]))
})

it('limits automatic resume attempts after an abrupt host loss', async () => {
  client.resumeCalls = 0
  const invite = createLanInvite({ roomId: 'lost-host', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(invite) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('ABAB-ABAB-ABAB')
  fireEvent.change(screen.getByRole('textbox', { name: 'Código visto no anfitrião' }), { target: { value: 'ABAB-ABAB-ABAB' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código presencial' }))
  await waitFor(() => expect(client.sent).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'admissionAck' })])))
  client.emit({ kind: 'admissionConfirmed', protocolVersion: 1, roomId: 'lost-host', playerId: 'guest-1', admissionId: 'c'.repeat(64) })
  await screen.findByRole('button', { name: 'Incrementar contador de teste' })
  client.close()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Retomada indisponível'), { timeout: 9000 })
  expect(client.resumeCalls).toBe(3)
  expect(screen.queryByText('O anfitrião encerrou a sala.')).not.toBeInTheDocument()
}, 10000)

it('treats an authenticated roomClosed frame as final without reconnecting', async () => {
  client.resumeCalls = 0
  const invite = createLanInvite({ roomId: 'closed-room', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
  render(<LanRoomScreen />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Convite LAN completo' }), { target: { value: encodeLanInvite(invite) } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('ABAB-ABAB-ABAB')
  fireEvent.change(screen.getByRole('textbox', { name: 'Código visto no anfitrião' }), { target: { value: 'ABAB-ABAB-ABAB' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código presencial' }))
  await waitFor(() => expect(client.sent).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'admissionAck' })])))
  client.emit({ kind: 'admissionConfirmed', protocolVersion: 1, roomId: 'closed-room', playerId: 'guest-1', admissionId: 'c'.repeat(64) })
  await screen.findByRole('button', { name: 'Incrementar contador de teste' })
  client.emit({ kind: 'roomClosed', protocolVersion: 1, roomId: 'closed-room' })
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sala encerrada'))
  expect(client.resumeCalls).toBe(0)
})
