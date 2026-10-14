import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../../persistentRoom'
import { syntheticMultiplayerGames } from '../../multiplayerGames.synthetic'
import { LanNativeHost } from '../lanNativeHost'
import { LanPersistentRoomHost } from '../lanPersistentRoomHost'
import { createPersistentLanInvite, encodePersistentLanInvite } from '../lanPersistentInvite'
import type { PersistentLanFrame } from '../lanPersistentWire'
import { RoomSessionProvider } from './RoomSessionProvider'
import type { RoomSession } from './RoomSessionProvider'
import { useRoomSession } from './RoomSessionContext'

// Only the native socket and vault are substituted. Admission, decoder, runtime,
// verification code comparison and provider state all execute their real code.
const wire = vi.hoisted(() => ({
  host: null as null | ((event: { type: string; peerId: string; frame?: PersistentLanFrame }) => void),
  guest: null as null | ((event: { type: string; frame?: PersistentLanFrame }) => void),
  closed: false,
  hold: false,
  release: null as null | (() => void),
  connect: vi.fn(), start: vi.fn(), store: vi.fn(), send: vi.fn(),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,dGVzdA==' } }))
vi.mock('../lanNativeHost', () => ({ LanNativeHost: class {
  discoverLanAddress = async () => ({ ip: '10.0.0.1', interfaceName: 'wlan0' })
  startSecureV2 = async () => { wire.start(); wire.closed = false; return { port: 43211, fingerprint: 'ab'.repeat(32) } }
  rotateInviteToken = async () => undefined
  registerResumeToken = async () => undefined
  revokeResumeToken = async () => undefined
  closePeer = async () => { wire.host?.({ type: 'disconnected', peerId: 'peer' }) }
  sendV2 = async (_peer: string, frame: PersistentLanFrame) => { wire.guest?.({ type: 'message', frame }) }
  stop = async () => { wire.closed = true }
  onV2Event = async (handler: typeof wire.host) => {
    wire.host = handler
    return { remove: async () => { wire.host = null } }
  }
} }))
vi.mock('../lanSecureNativeClient', () => ({ LanSecureNativeClient: class {
  connectV2 = async (...args: unknown[]) => {
    wire.connect(...args)
    if (wire.hold) await new Promise<void>(resolve => { wire.release = resolve })
    if (wire.closed) throw new Error('room_closed')
    if (args[2] !== 'ab'.repeat(32)) throw new Error('host_identity_mismatch')
    wire.host?.({ type: 'connected', peerId: 'peer' })
  }
  sendV2 = async (frame: PersistentLanFrame) => {
    wire.send(frame)
    wire.host?.({ type: 'message', peerId: 'peer', frame })
  }
  storeResumeCredential = async (credential: unknown) => { wire.store(credential) }
  rotateResumeCredential = async () => undefined
  clearResumeCredential = async () => undefined
  connectResume = async () => undefined
  disconnect = async () => { wire.host?.({ type: 'disconnected', peerId: 'peer' }) }
  onV2Event = async (handler: typeof wire.guest) => {
    wire.guest = handler
    return { remove: async () => { wire.guest = null } }
  }
} }))

let session: RoomSession
let remote: LanPersistentRoomHost | undefined
function Probe() {
  const current = useRoomSession()
  useEffect(() => { session = current }, [current])
  return <><output aria-label="Estado">{current.mode}: {current.status}</output>
    {current.error && <p role="alert">{current.error}</p>}</>
}
function mount() { render(<RoomSessionProvider><Probe /></RoomSessionProvider>) }
function scan(raw: string) {
  expect(session.joinScannedInvite, 'the optical scanner needs its own validated admission path').toBeTypeOf('function')
  act(() => session.joinScannedInvite(raw))
}
async function createRemote() {
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'qr-room', hostPlayerId: 'host', hostConnectionId: 'host-local',
    adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames), createPlayerId: () => 'guest' })
  remote = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), new LanNativeHost())
  const invite = await remote.start('qr-room', '10.0.0.1')
  return { invite, runtime }
}
beforeEach(() => { wire.closed = false; wire.hold = false; wire.release = null; vi.clearAllMocks() })
afterEach(async () => { cleanup(); await remote?.stop(); remote = undefined; wire.host = null; wire.guest = null })

describe('optical QR room admission', () => {
  it('validates the scanned payload, pins its exact fingerprint and admits without a typed code', async () => {
    const { invite } = await createRemote()
    mount()
    scan(encodePersistentLanInvite(invite))
    await waitFor(() => expect(session.mode).toBe('active'))
    expect(session.role).toBe('guest')
    expect(session.snapshot?.roomState.members.map(member => member.playerId)).toEqual(['host', 'guest'])
    expect(wire.connect).toHaveBeenCalledWith('10.0.0.1', 43211, 'ab'.repeat(32), 'qr-room', invite.capability)
    expect(wire.store).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: 'ab'.repeat(32), protocolVersion: 2 }))
    expect(screen.getByLabelText('Estado')).toHaveTextContent('Conectado. Você já está na sala!')
  })

  it('shows connecting immediately and ignores repeated scans while admission is pending', async () => {
    const { invite } = await createRemote()
    wire.hold = true
    mount()
    const raw = encodePersistentLanInvite(invite)
    scan(raw)
    expect(session.busy).toBe(true)
    expect(screen.getByLabelText('Estado')).toHaveTextContent('Conectando…')
    scan(raw)
    await waitFor(() => expect(wire.release).not.toBeNull())
    expect(wire.connect).toHaveBeenCalledOnce()
    await act(async () => { wire.release?.() })
    await waitFor(() => expect(session.mode).toBe('active'))
  })

  it('ignores scans and host creation after joining an active room', async () => {
    const { invite } = await createRemote()
    mount()
    const raw = encodePersistentLanInvite(invite)
    scan(raw)
    await waitFor(() => expect(session.mode).toBe('active'))
    scan(raw)
    act(() => session.startHost())
    await act(async () => { await Promise.resolve() })
    expect(wire.connect).toHaveBeenCalledOnce()
    expect(wire.start).toHaveBeenCalledOnce() // Only the fixture's host exists.
    expect(session.role).toBe('guest')
    expect(session.roomId).toBe('qr-room')
  })

  it('does not create another native host while already hosting a room', async () => {
    mount()
    act(() => session.startHost())
    await waitFor(() => expect(session.mode).toBe('active'))
    const roomId = session.roomId
    act(() => session.startHost())
    await act(async () => { await Promise.resolve() })
    expect(wire.start).toHaveBeenCalledOnce()
    expect(session.roomId).toBe(roomId)
  })

  it.each([
    ['malformed', () => 'not-a-room', /não é válido/i],
    ['expired', () => encodePersistentLanInvite(createPersistentLanInvite({ roomId: 'old', hostIp: '10.0.0.1',
      port: 43211, fingerprint: 'ab'.repeat(32), now: Date.now() - 180_000 })), /venceu/i],
  ])('rejects %s scans before opening a socket', async (_label, raw, error) => {
    mount()
    scan(raw())
    expect(await screen.findByRole('alert')).toHaveTextContent(error)
    expect(wire.connect).not.toHaveBeenCalled()
    expect(session.mode).toBe('entry')
    expect(session.snapshot).toBeNull()
  })

  it('keeps a revoked invitation rejected by the real host admission', async () => {
    const { invite, runtime } = await createRemote()
    await remote!.refreshInvite()
    mount()
    scan(encodePersistentLanInvite(invite))
    expect(await screen.findByRole('alert')).toHaveTextContent(/usado|válido/i)
    expect(session.mode).toBe('entry')
    expect(runtime.getRevision()).toBe(1)
    expect(wire.store).not.toHaveBeenCalled()
  })

  it('does not turn a TLS fingerprint mismatch into successful admission', async () => {
    const { invite } = await createRemote()
    mount()
    scan(encodePersistentLanInvite({ ...invite, fingerprint: 'cd'.repeat(32) }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não confere/i)
    expect(session.mode).toBe('entry')
    expect(wire.send).not.toHaveBeenCalled()
    expect(wire.store).not.toHaveBeenCalled()
  })

  it('keeps a closed host room rejected', async () => {
    const { invite } = await createRemote()
    await remote!.stop()
    mount()
    scan(encodePersistentLanInvite(invite))
    expect(await screen.findByRole('alert')).toHaveTextContent(/encerrada/i)
    expect(session.mode).toBe('entry')
    expect(wire.store).not.toHaveBeenCalled()
  })
})
