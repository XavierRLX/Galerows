import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jsQR from 'jsqr'
import { useState } from 'react'
import { LanQrScanner } from './LanQrScanner'

vi.mock('jsqr', () => ({ default: vi.fn(() => null) }))
let frames: FrameRequestCallback[]
let stop: ReturnType<typeof vi.fn>
let media: MediaStream
function installCamera(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
}
beforeEach(() => {
  frames = []
  stop = vi.fn()
  media = { getTracks: () => [{ stop }] } as unknown as MediaStream
  vi.mocked(jsQR).mockReset()
  vi.mocked(jsQR).mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  installCamera(async () => media)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('QR scanner camera lifecycle and modal controls', () => {
  it('announces opening until playback is ready, then waits for a QR', async () => {
    let playing!: () => void
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise(resolve => { playing = resolve }))
    render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
    expect(screen.getByRole('status')).toHaveTextContent('Abrindo câmera')
    await waitFor(() => expect(playing).toBeTypeOf('function'))
    expect(screen.getByRole('status')).toHaveTextContent('Abrindo câmera')
    await act(async () => { playing() })
    expect(screen.getByRole('status')).toHaveTextContent('Aguardando leitura')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes and releases the live stream immediately, even before the parent unmounts', async () => {
    const onClose = vi.fn()
    render(<LanQrScanner onClose={onClose} onScan={() => undefined} />)
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
    expect((screen.getByLabelText('Imagem da câmera') as HTMLVideoElement).srcObject).toBeNull()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('releases a getUserMedia result arriving after Close without starting playback', async () => {
    let receive!: (stream: MediaStream) => void
    installCamera(() => new Promise(resolve => { receive = resolve }))
    render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await act(async () => { receive(media) })
    expect(stop).toHaveBeenCalledOnce()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('releases a getUserMedia result arriving after the scanner unmounts', async () => {
    let receive!: (stream: MediaStream) => void
    installCamera(() => new Promise(resolve => { receive = resolve }))
    const view = render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
    view.unmount()
    await act(async () => { receive(media) })
    expect(stop).toHaveBeenCalledOnce()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('focuses Close, contains Tab navigation, closes on Escape and restores the opener', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Ler QR</button>
        {open && <LanQrScanner onClose={() => setOpen(false)} onScan={() => undefined} />}</>
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Ler QR' })
    opener.focus()
    fireEvent.click(opener)
    const close = screen.getByRole('button', { name: 'Fechar' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(close).toHaveFocus()
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('consumes Android back through the application modal event and closes the camera', async () => {
    const onClose = vi.fn()
    render(<LanQrScanner onClose={onClose} onScan={() => undefined} />)
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())
    const back = new Event('galerows:back', { cancelable: true })
    act(() => { window.dispatchEvent(back) })
    expect(back.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })

  it.each([
    ['denied', () => Promise.reject(new DOMException('Denied', 'NotAllowedError')), /Permissão da câmera negada/],
    ['unavailable', () => Promise.reject(new DOMException('Missing', 'NotFoundError')), /Câmera indisponível/],
  ])('explains %s camera access without offering pasted invitations', async (_name, getUserMedia, message) => {
    installCamera(getUserMedia)
    render(<LanQrScanner onClose={() => undefined} onScan={() => undefined} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    expect(screen.queryByText(/digitar|digite|colar|cole/i)).not.toBeInTheDocument()
  })

  it('uses the latest callback once and stops all camera work after reading a QR', async () => {
    const oldScan = vi.fn()
    const latestScan = vi.fn()
    const view = render(<LanQrScanner onClose={() => undefined} onScan={oldScan} />)
    const video = screen.getByLabelText('Imagem da câmera')
    Object.defineProperties(video, { readyState: { value: 2 }, videoWidth: { value: 2 }, videoHeight: { value: 2 } })
    await waitFor(() => expect(frames).toHaveLength(1))
    view.rerender(<LanQrScanner onClose={() => undefined} onScan={latestScan} />)
    vi.mocked(jsQR).mockReturnValue({ data: 'optical-payload' } as ReturnType<typeof jsQR>)
    act(() => { frames[0](0); frames[0](1) })
    expect(latestScan).toHaveBeenCalledExactlyOnceWith('optical-payload')
    expect(oldScan).not.toHaveBeenCalled()
    expect(stop).toHaveBeenCalledOnce()
    expect(frames).toHaveLength(1)
  })
})
