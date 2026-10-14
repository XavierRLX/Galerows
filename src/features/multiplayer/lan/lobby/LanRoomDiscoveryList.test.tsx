import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LanRoomDiscoveryList } from './LanRoomDiscoveryList'
import type { RoomDiscoveryEvent } from '../lanRoomDiscovery'

const discovery = vi.hoisted(() => ({
  start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), remove: vi.fn(async () => undefined),
  listener: null as null | ((event: RoomDiscoveryEvent) => void),
}))
vi.mock('../lanRoomDiscovery', () => ({ lanRoomDiscovery: {
  start: discovery.start, stop: discovery.stop,
  subscribe: async (listener: (event: RoomDiscoveryEvent) => void) => {
    discovery.listener = listener
    return { remove: discovery.remove }
  },
} }))
afterEach(() => { cleanup(); vi.clearAllMocks(); discovery.listener = null })
const room: RoomDiscoveryEvent = { type: 'found', id: 'Galerows-abcd', label: 'Sala da Ana',
  roomId: 'room-a', code: '001234', hostIp: '192.168.1.2', port: 43211, fingerprint: 'ab'.repeat(32) }

it('starts discovery automatically, lists rooms first and keeps code hidden until requested', async () => {
  const join = vi.fn()
  const { unmount } = render(<LanRoomDiscoveryList onJoinRoom={join} onRequestQr={vi.fn()} />)
  await waitFor(() => expect(discovery.start).toHaveBeenCalledOnce())
  expect(screen.getByRole('heading', { name: /Salas disponíveis/ })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  act(() => discovery.listener?.(room))
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em Sala da Ana' }))
  expect(join).toHaveBeenCalledWith(expect.objectContaining({ code: '001234', roomId: 'room-a' }))
  fireEvent.click(screen.getByRole('button', { name: /Usar código/ }))
  expect(screen.getByLabelText('Código de 6 dígitos')).toHaveAttribute('inputmode', 'numeric')
  unmount()
  expect(discovery.stop).toHaveBeenCalled()
  expect(discovery.remove).toHaveBeenCalled()
})

it('validates six digits without treating an unknown code as a resolved endpoint', async () => {
  const join = vi.fn(), qr = vi.fn()
  render(<LanRoomDiscoveryList onJoinRoom={join} onRequestQr={qr} />)
  await waitFor(() => expect(discovery.start).toHaveBeenCalled())
  act(() => discovery.listener?.(room))
  fireEvent.click(screen.getByRole('button', { name: /Usar código/ }))
  const input = screen.getByLabelText('Código de 6 dígitos')
  fireEvent.change(input, { target: { value: '123' } })
  expect(screen.getByText('Digite os 6 dígitos.')).toBeInTheDocument()
  fireEvent.change(input, { target: { value: '000000' } })
  expect(screen.getByText(/Esse código não apareceu na busca/)).toBeInTheDocument()
  expect(join).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Ler QR Code/ }))
  expect(qr).toHaveBeenCalledOnce()
  fireEvent.change(input, { target: { value: '001 234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar com código' }))
  expect(join).toHaveBeenCalledWith(expect.objectContaining({ code: '001234' }))
})

it('refreshes discovery and rejects malformed advertisements', async () => {
  render(<LanRoomDiscoveryList onJoinRoom={vi.fn()} onRequestQr={vi.fn()} />)
  await waitFor(() => expect(discovery.start).toHaveBeenCalledOnce())
  act(() => discovery.listener?.({ ...room, fingerprint: 'bad' }))
  expect(screen.queryByText('Sala da Ana')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Buscar novamente/ }))
  await waitFor(() => expect(discovery.start).toHaveBeenCalledTimes(2))
})
