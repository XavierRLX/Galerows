import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LanDiagnosticScreen } from './LanDiagnosticScreen'

const probe = vi.hoisted(() => {
  const listeners = new Set<(event: { type: string; frame?: { kind: 'ping'; protocolVersion: number } }) => void>()
  return { listeners, connect: vi.fn(), disconnect: vi.fn(async () => undefined) }
})

vi.mock('./lanSecureNativeClient', () => ({
  LanSecureNativeClient: class {
    connect = probe.connect
    disconnect = probe.disconnect
    send = vi.fn()
    async onEvent(listener: (event: { type: string; frame?: { kind: 'ping'; protocolVersion: number } }) => void) {
      probe.listeners.add(listener)
      return { remove: async () => { probe.listeners.delete(listener) } }
    }
  },
}))

vi.mock('./lanNativeHost', () => ({
  LanNativeHost: class {
    stop = vi.fn(async () => undefined)
    startSecure = vi.fn()
    send = vi.fn()
    onEvent = vi.fn()
  },
}))

beforeEach(() => {
  probe.listeners.clear()
  probe.connect.mockReset()
})
afterEach(cleanup)

it('removes the failed TLS attempt listener before reconnecting', async () => {
  probe.connect.mockRejectedValueOnce(new Error('host_identity_mismatch')).mockResolvedValueOnce(undefined)
  render(<LanDiagnosticScreen />)

  fireEvent.click(screen.getByRole('button', { name: 'Connect guest' }))
  await waitFor(() => expect(screen.getByText(/Status: error/)).toBeInTheDocument())
  expect(probe.listeners.size).toBe(0)

  fireEvent.click(screen.getByRole('button', { name: 'Connect guest' }))
  await waitFor(() => expect(screen.getByText(/Status: open/)).toBeInTheDocument())
  act(() => { probe.listeners.forEach(listener => listener({ type: 'message', frame: { kind: 'ping', protocolVersion: 1 } })) })
  expect(screen.getByText(/native client received kind=ping/).textContent?.match(/native client received kind=ping/g)).toHaveLength(1)
})
