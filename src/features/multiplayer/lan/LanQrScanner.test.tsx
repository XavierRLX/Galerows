import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LanQrScanner } from './LanQrScanner'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('explains denied camera access and lets the player close the scanner', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError') }),
  } })
  render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Permissão da câmera negada')
  expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
})

it('releases the camera when the scanner is unmounted', async () => {
  const stop = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
  } })
  const rendered = render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
  await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
  rendered.unmount()
  await waitFor(() => expect(stop).toHaveBeenCalledOnce())
})

it('releases the camera when preview playback fails', async () => {
  const stop = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
  } })
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('camera busy'))
  render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar a câmera')
  expect(stop).toHaveBeenCalledOnce()
})

it('keeps one camera stream when the parent updates its scan callback', async () => {
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }))
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  const view = render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
  view.rerender(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
  expect(getUserMedia).toHaveBeenCalledOnce()
})
