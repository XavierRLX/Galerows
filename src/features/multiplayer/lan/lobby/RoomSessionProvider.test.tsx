import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeRoomActions } from '../../../hub/HomeRoomActions'
import { LanPersistentLobbyScreen } from './LanPersistentLobbyScreen'
import { RoomSessionProvider } from './RoomSessionProvider'

const native = vi.hoisted(() => ({ started: 0, stopped: 0, received: 0, delayStart: false, releaseStart: null as null | (() => void), emit: null as null | ((event: { type: string; peerId: string }) => void) }))
const qrMock = vi.hoisted(() => ({
  holdNext: false,
  settle: null as null | ((outcome: 'fail' | 'success') => void),
}))
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => {
    if (!qrMock.holdNext) return Promise.resolve('data:image/png;base64,dGVzdA==')
    qrMock.holdNext = false
    return new Promise<string>((resolve, reject) => {
      qrMock.settle = outcome => outcome === 'fail'
        ? reject(new Error('sensitive_QR_failure')) : resolve('data:image/png;base64,dGVzdA==')
    })
  }) },
}))
vi.mock('../lanNativeHost', () => ({
  LanNativeHost: class {
    discoverLanAddress = async () => ({ ip: '10.0.0.1', interfaceName: 'wlan0' })
    startSecureV2 = async () => {
      native.started++
      if (native.delayStart) await new Promise<void>(resolve => { native.releaseStart = resolve })
      return { port: 43211, fingerprint: 'ab'.repeat(32) }
    }
    rotateInviteToken = async () => undefined
    registerResumeToken = async () => undefined
    revokeResumeToken = async () => undefined
    closePeer = async () => undefined
    sendV2 = async () => { native.received++ }
    stop = async () => { native.stopped++ }
    onV2Event = async (listener: (event: { type: string; peerId: string }) => void) => {
      native.emit = listener
      return { remove: async () => { native.emit = null } }
    }
  },
}))

afterEach(() => { cleanup(); native.started = 0; native.stopped = 0; native.received = 0; native.delayStart = false; native.releaseStart = null; native.emit = null; qrMock.holdNext = false; qrMock.settle = null })

function Harness() {
  return <MemoryRouter initialEntries={['/__lan-lobby-v2']}>
    <RoomSessionProvider>
      <Routes>
        <Route path="/players" element={<><h1>Minha Galera</h1><HomeRoomActions /></>} />
        <Route path="/" element={<><h1>Jogos disponíveis</h1><HomeRoomActions /></>} />
        <Route path="/__lan-lobby-v2" element={<LanPersistentLobbyScreen />} />
      </Routes>
    </RoomSessionProvider>
  </MemoryRouter>
}

describe('G2 persistent LAN room navigation', () => {
  it('retains the authoritative host and Room when returning to catalog and back, then closes only explicitly', async () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Impostor da Palavra' }))
    await waitFor(() => expect(screen.getByText('Impostor da Palavra')).toBeInTheDocument())
    expect(native.started).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Ver jogos/ }))
    expect(screen.getByRole('heading', { name: 'Jogos disponíveis' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à sala' })).toBeInTheDocument()
    expect(native.stopped).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à sala' }))
    expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument()
    expect(screen.getByText('Impostor da Palavra')).toBeInTheDocument()
    expect(native.started).toBe(1)
    expect(native.stopped).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /Encerrar sala/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sim, encerrar sala/ }))
    await waitFor(() => expect(native.stopped).toBe(1))
    expect(screen.getByTestId('pl03-entry')).toBeInTheDocument()
    unmount()
    expect(native.stopped).toBe(1)
  })

  it('lets newcomers return from LAN to Minha Galera', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /Voltar à sala/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Voltar para Minha Galera/ }))
    expect(screen.getByRole('heading', { name: 'Minha Galera' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Voltar à sala/ })).not.toBeInTheDocument()
    expect(native.started).toBe(0)
  })

  it('cancels a native host start that resolves after its owning provider unmounts', async () => {
    native.delayStart = true
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(native.releaseStart).not.toBeNull())
    expect(native.stopped).toBe(0)
    unmount()
    native.releaseStart?.()
    await waitFor(() => expect(native.stopped).toBe(1))
  })

  it('drops the active banner when native lifetime policy terminates the host Room', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(native.emit).not.toBeNull()
    native.emit?.({ type: 'room_expired', peerId: '' })
    await waitFor(() => expect(native.stopped).toBe(1))
    await waitFor(() => expect(screen.getByTestId('pl03-entry')).toBeInTheDocument(), { timeout: 2500 })
    expect(screen.queryByRole('button', { name: /Ver jogos/ })).not.toBeInTheDocument()
  })

  it('revalidates a native-expired host room immediately when the app becomes visible, not only on the 400ms timer', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(native.emit).not.toBeNull()
    native.emit?.({ type: 'room_expired', peerId: '' })
    await waitFor(() => expect(native.stopped).toBe(1))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.getByTestId('pl03-entry')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i)
  })

  it('ignores a failed QR result from an invite update after the Room was terminated', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    qrMock.holdNext = true
    fireEvent.click(screen.getByText('Convidar amigos'))
    fireEvent.click(screen.getByRole('button', { name: /Renovar convite/ }))
    await waitFor(() => expect(qrMock.settle).not.toBeNull())
    native.emit?.({ type: 'room_expired', peerId: '' })
    await waitFor(() => expect(native.stopped).toBe(1))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i)
    await act(async () => { qrMock.settle?.('fail') })
    expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i)
    expect(screen.queryByText(/não foi possível concluir a ação/i)).not.toBeInTheDocument()
  })

  it('closes host transport when the provider itself is destroyed', async () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Criar sala/ }))
    await waitFor(() => expect(screen.getByTestId('pl03-lobby')).toBeInTheDocument())
    expect(native.stopped).toBe(0)
    unmount()
    await waitFor(() => expect(native.stopped).toBe(1))
  })
})
