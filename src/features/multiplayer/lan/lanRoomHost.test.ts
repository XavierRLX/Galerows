import { describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION } from '../protocol'
import type { Command } from '../protocol'
import type { GameAdapter } from '../gameAdapter'
import { AuthoritativeRoomRuntime } from '../runtime'
import { LanRoomHost } from './lanRoomHost'
import { encodeLanFrame, type LanFrame } from './lanWire'

type State = { count: number }
const adapter: GameAdapter<State, number, { count: number }, { secret: string }> = {
  createInitialState: () => ({ count: 0 }),
  parseCommand: command => command.type === 'add' && typeof command.payload === 'number'
    ? { ok: true, command: command.payload } : { ok: false, error: 'invalid_payload' },
  applyCommand: (state, amount) => ({ accepted: true, changed: true, state: { count: state.count + amount } }),
  projectPublic: state => ({ count: state.count }),
  projectPrivate: (_state, playerId) => ({ secret: `private-${playerId}` }),
}
function setup(customAdapter = adapter, options: { admissionConfirmationTimeoutMs?: number } = {}) {
  let listener: ((event: { type: string; peerId: string; frame?: LanFrame }) => void) | undefined
  const sent: { peerId: string; frame: LanFrame }[] = []
  const native = {
    startSecure: async () => ({ port: 4321, fingerprint: 'ab'.repeat(32) }),
    rotateInviteToken: async () => undefined,
    registerResumeToken: vi.fn(async (playerId: string, resumeToken: string, expiresAt: number) => {
      void playerId; void resumeToken; void expiresAt
    }),
    revokeResumeToken: vi.fn(async (playerId: string, resumeToken: string) => { void playerId; void resumeToken }),
    closePeer: vi.fn(async (peerId: string) => { void peerId }),
    send: vi.fn(async (peerId: string, frame: LanFrame) => { encodeLanFrame(frame); sent.push({ peerId, frame }) }),
    stop: vi.fn(async () => undefined),
    onEvent: async (callback: typeof listener) => { listener = callback; return { remove: async () => { listener = undefined } } },
  }
  let id = 0
  const runtime = new AuthoritativeRoomRuntime({ roomId: 'room', adapter: customAdapter,
    createPlayerId: () => `p${++id}` })
  const host = new LanRoomHost(runtime, native, options)
  const emit = (type: string, peerId: string, frame?: LanFrame) => listener?.({ type, peerId, frame })
  const join = async (peerId: string) => {
    const invite = host.currentInvite!
    emit('connected', peerId)
    emit('message', peerId, { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(sent.some(item => item.peerId === peerId && item.frame.kind === 'admitted')).toBe(true))
    const admitted = sent.find(item => item.peerId === peerId && item.frame.kind === 'admitted')!.frame
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    emit('message', peerId, { kind: 'admissionAck', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, admissionId: admitted.admissionId! })
    await vi.waitFor(() => expect(sent.some(item => item.peerId === peerId
      && item.frame.kind === 'admissionConfirmed')).toBe(true))
    return admitted
  }
  return { native, sent, runtime, host, emit, join }
}
const command = (playerId: string, commandId: string, payload = 1): Command => ({
  protocolVersion: PROTOCOL_VERSION, roomId: 'room', playerId, commandId, type: 'add', payload,
})
function eventRevisions(sent: { peerId: string; frame: LanFrame }[], peerId: string) {
  return sent.filter((item): item is { peerId: string; frame: Extract<LanFrame, { kind: 'event' }> } =>
    item.peerId === peerId && item.frame.kind === 'event').map(item => item.frame.event.revision)
}

describe('LanRoomHost', () => {
  it('removes only the authenticated guest after revoking its resume credential', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const guest = await s.join('guest')
    const before = s.runtime.getRevision()
    s.emit('message', 'guest', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'leave-1' })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'guest'
      && item.frame.kind === 'leaveConfirmed' && item.frame.commandId === 'leave-1')).toBe(true))
    expect(s.runtime.hasMembership(guest.playerId)).toBe(false)
    expect(s.runtime.getRevision()).toBe(before + 1)
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(guest.playerId, guest.resumeToken)
    expect(s.native.closePeer).toHaveBeenCalledWith('guest')
    expect(s.host.localMembers().map(member => member.playerId)).not.toContain(guest.playerId)
    s.emit('disconnected', 'guest')
    expect(s.runtime.getRevision()).toBe(before + 1)
  })

  it('allows a fresh invited guest after definitive leave without restoring the old player', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const old = await s.join('old')
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: old.playerId, commandId: 'leave-old' })
    await vi.waitFor(() => expect(s.runtime.hasMembership(old.playerId)).toBe(false))
    const fresh = await s.join('fresh')
    expect(fresh.playerId).not.toBe(old.playerId)
    expect(s.runtime.hasMembership(fresh.playerId)).toBe(true)
    expect(s.runtime.hasMembership(old.playerId)).toBe(false)
  })

  it('does not let a guest leave as a different player or room', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const host = s.host.joinLocal()
    const guest = await s.join('guest')
    const before = s.runtime.getRevision()
    s.emit('message', 'guest', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: host.playerId, commandId: 'forged' })
    s.emit('message', 'guest', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'other', playerId: guest.playerId, commandId: 'wrong-room' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.runtime.hasMembership(host.playerId)).toBe(true)
    expect(s.runtime.hasMembership(guest.playerId)).toBe(true)
    expect(s.runtime.getRevision()).toBe(before)
    expect(s.native.revokeResumeToken).not.toHaveBeenCalled()
  })

  it('does not restore membership when leave confirmation is lost', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('guest')
    s.native.send.mockImplementationOnce(async (_peerId, frame) => {
      if (frame.kind === 'leaveConfirmed') throw new Error('lost_ack')
    })
    s.emit('message', 'guest', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'lost' })
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    s.emit('message', 'retry', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.peerId === 'retry' && item.frame.kind === 'resumed')).toBe(false)
  })

  it('blocks commands and resume while revocation is pending, then removes the guest once', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('old')
    let release!: () => void
    s.native.revokeResumeToken.mockImplementationOnce(async () => new Promise<void>(resolve => { release = resolve }))
    const before = s.runtime.getRevision()
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'leave-race' })
    await vi.waitFor(() => expect(s.native.revokeResumeToken).toHaveBeenCalledWith(guest.playerId, guest.resumeToken))
    s.emit('message', 'old', { kind: 'command', command: command(guest.playerId, 'too-late') })
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    release()
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    expect(s.runtime.getRevision()).toBe(before + 1)
    expect(s.sent.some(item => item.peerId === 'old' && item.frame.kind === 'commandResult'
      && item.frame.result.commandId === 'too-late')).toBe(false)
    expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(false)
  })

  it('does not let a resume overtake a queued leave behind an in-flight command', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('old')
    let release!: () => void
    s.native.send.mockImplementation(async (peerId, frame) => {
      encodeLanFrame(frame)
      s.sent.push({ peerId, frame })
      if (frame.kind === 'commandResult') await new Promise<void>(resolve => { release = resolve })
    })
    s.emit('message', 'old', { kind: 'command', command: command(guest.playerId, 'in-flight') })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'old'
      && item.frame.kind === 'commandResult' && item.frame.result.commandId === 'in-flight')).toBe(true))
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'queued-leave' })
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    release()
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(false)
  })

  it('marks a disconnect during revocation without restoring access or claiming departure early', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('old')
    let release!: () => void
    s.native.revokeResumeToken.mockImplementationOnce(async () => new Promise<void>(resolve => { release = resolve }))
    const before = s.runtime.getRevision()
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'drop-during-leave' })
    await vi.waitFor(() => expect(s.native.revokeResumeToken).toHaveBeenCalled())
    s.emit('disconnected', 'old')
    expect(s.runtime.hasMembership(guest.playerId)).toBe(true)
    expect(s.runtime.getConnectionId(guest.playerId)).toBeNull()
    expect(s.runtime.getRevision()).toBe(before)
    release()
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    expect(s.runtime.getRevision()).toBe(before + 1)
  })

  it('closes the room if revocation fails after the leaving guest disconnects', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const guest = await s.join('old')
    let fail!: () => void
    s.native.revokeResumeToken.mockImplementationOnce(async () => new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('native_failure'))
    }))
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'fail-disconnected' })
    await vi.waitFor(() => expect(s.native.revokeResumeToken).toHaveBeenCalled())
    s.emit('disconnected', 'old')
    fail()
    await vi.waitFor(() => expect(s.native.stop).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
  })

  it('closes the room if a guest disconnects after failed revocation', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const guest = await s.join('old')
    s.native.revokeResumeToken.mockRejectedValueOnce(new Error('native_failure'))
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'fail-then-drop' })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'old'
      && item.frame.kind === 'leaveRejected')).toBe(true))
    s.emit('disconnected', 'old')
    await vi.waitFor(() => expect(s.native.stop).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
  })

  it('revokes both current and pending tokens before removing a resumed guest', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('old')
    s.emit('disconnected', 'old')
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(true))
    const resumed = s.sent.find(item => item.peerId === 'new' && item.frame.kind === 'resumed')!.frame
    if (resumed.kind !== 'resumed') throw new Error('expected resumed')
    s.emit('message', 'new', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'leave-both' })
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(guest.playerId, guest.resumeToken)
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(guest.playerId, resumed.resumeToken)
    s.emit('message', 'retry-current', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    s.emit('message', 'retry-pending', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: resumed.resumeToken })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.frame.kind === 'resumed' && item.peerId.startsWith('retry-'))).toBe(false)
  })

  it('withholds success on partial revocation failure and permits safe retry', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const guest = await s.join('old')
    const before = s.runtime.getRevision()
    s.native.revokeResumeToken.mockRejectedValueOnce(new Error('native_failure'))
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'stable-leave' })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'old'
      && item.frame.kind === 'leaveRejected')).toBe(true))
    expect(s.runtime.hasMembership(guest.playerId)).toBe(true)
    expect(s.runtime.getRevision()).toBe(before)
    s.emit('message', 'old', { kind: 'command', command: command(guest.playerId, 'blocked') })
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, resumeToken: guest.resumeToken! })
    s.emit('message', 'old', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'stable-leave' })
    await vi.waitFor(() => expect(s.runtime.hasMembership(guest.playerId)).toBe(false))
    expect(s.runtime.getRevision()).toBe(before + 1)
    expect(s.sent.some(item => item.peerId === 'old' && item.frame.kind === 'commandResult'
      && item.frame.result.commandId === 'blocked')).toBe(false)
    expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(false)
  })

  it('serializes room stop after an in-flight guest leave without duplicate removal', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const guest = await s.join('guest')
    let release!: () => void
    s.native.revokeResumeToken.mockImplementationOnce(async () => new Promise<void>(resolve => { release = resolve }))
    s.emit('message', 'guest', { kind: 'leaveRequest', protocolVersion: 1,
      roomId: 'room', playerId: guest.playerId, commandId: 'stop-race' })
    await vi.waitFor(() => expect(s.native.revokeResumeToken).toHaveBeenCalledWith(guest.playerId, guest.resumeToken))
    const stopping = s.host.stop()
    release()
    await stopping
    expect(s.runtime.hasMembership(guest.playerId)).toBe(false)
    expect(s.native.revokeResumeToken.mock.calls.filter(([playerId]) => playerId === guest.playerId)).toHaveLength(1)
    expect(s.native.stop).toHaveBeenCalledOnce()
  })
  it('refreshes the displayed invitation and exposes the local authoritative snapshot', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const local = s.host.joinLocal()
    const first = s.host.currentInvite!
    expect(s.host.localSnapshot()?.roomState.playerIds).toEqual([local.playerId])
    const next = await s.host.refreshInvite('10.1.1.3')
    expect(next.hostIp).toBe('10.1.1.3')
    expect(next.capability).not.toBe(first.capability)
    expect(s.host.currentInvite).toEqual(next)
  })

  it('reports a disconnected guest without inventing a departure', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    s.host.joinLocal()
    const guest = await s.join('peer-1')
    expect(s.host.localMembers()).toContainEqual({ playerId: guest.playerId, connected: true })
    s.emit('disconnected', 'peer-1')
    expect(s.host.localMembers()).toContainEqual({ playerId: guest.playerId, connected: false })
  })
  it('publishes initial membership only after the persisted-credential ACK', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admitted')).toBe(true))
    expect(s.runtime.hasMembership('p1')).toBe(true)
    s.emit('message', 'pending', { kind: 'command', command: command('p1', 'too-early') })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.peerId === 'pending' && item.frame.kind === 'commandResult')).toBe(false)
    expect(s.sent.some(item => item.peerId === 'pending' && item.frame.kind === 'admissionConfirmed')).toBe(false)

    s.emit('message', 'pending', { kind: 'admissionAck', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', admissionId: (s.sent.find(item => item.peerId === 'pending'
        && item.frame.kind === 'admitted')!.frame as Extract<LanFrame, { kind: 'admitted' }>).admissionId! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admissionConfirmed')).toBe(true))
    s.emit('message', 'pending', { kind: 'command', command: command('p1', 'after-confirmation') })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'commandResult')).toBe(true))
  })

  it('ignores a preemptive admission ACK that does not prove receipt of admitted', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    let release!: () => void
    s.native.send.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
    })
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.native.send).toHaveBeenCalledWith('pending', expect.objectContaining({ kind: 'admitted' })))
    s.emit('message', 'pending', { kind: 'admissionAck', protocolVersion: 1, roomId: 'room',
      playerId: 'p1', admissionId: '0'.repeat(64) } as LanFrame)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.peerId === 'pending' && item.frame.kind === 'admissionConfirmed')).toBe(false)
    release()
  })

  it('compensates an unconfirmed admission when the peer disconnects', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admitted')).toBe(true))
    const admitted = s.sent.find(item => item.peerId === 'pending' && item.frame.kind === 'admitted')!.frame
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    s.emit('disconnected', 'pending')
    await vi.waitFor(() => expect(s.runtime.hasMembership(admitted.playerId)).toBe(false))
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken)
  })

  it('compensates and closes an admission when its persisted-credential ACK is lost', async () => {
    const s = setup(adapter, { admissionConfirmationTimeoutMs: 100 }); await s.host.start('room', '10.1.1.2')
    await s.join('active')
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admitted')).toBe(true))
    const admitted = s.sent.find(item => item.peerId === 'pending' && item.frame.kind === 'admitted')!.frame
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    await vi.waitFor(() => expect(s.runtime.hasMembership(admitted.playerId)).toBe(false))
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken)
    expect(s.native.closePeer).toHaveBeenCalledWith('pending')
    expect(eventRevisions(s.sent, 'active')).toEqual([2, 3])
  })

  it('keeps a confirmed membership resumable when admissionConfirmed is lost', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admitted')).toBe(true))
    const admitted = s.sent.find(item => item.peerId === 'pending' && item.frame.kind === 'admitted')!.frame
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    s.native.send.mockRejectedValueOnce(new Error('confirmation_lost'))
    s.emit('message', 'pending', { kind: 'admissionAck', protocolVersion: 1,
      roomId: 'room', playerId: admitted.playerId, admissionId: admitted.admissionId! })
    await vi.waitFor(() => expect(s.runtime.getConnectionId(admitted.playerId)).toBeNull())
    expect(s.runtime.hasMembership(admitted.playerId)).toBe(true)
    s.emit('message', 'resumed', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, resumeToken: admitted.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'resumed'
      && item.frame.kind === 'resumed')).toBe(true))
  })

  it('compensates a confirmation-pending membership when the host stops', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('active')
    const invite = s.host.currentInvite!
    s.emit('connected', 'pending')
    s.emit('message', 'pending', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'pending'
      && item.frame.kind === 'admitted')).toBe(true))
    const admitted = s.sent.find(item => item.peerId === 'pending' && item.frame.kind === 'admitted')!.frame
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    await s.host.stop()
    expect(s.runtime.hasMembership(admitted.playerId)).toBe(false)
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken)
    expect(s.sent.some(item => item.peerId === 'active' && item.frame.kind === 'roomClosed')).toBe(true)
  })

  it('does not publish an admission after shutdown races native credential registration', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    let release!: () => void
    s.native.registerResumeToken.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
      return undefined
    })
    const invite = s.host.currentInvite!
    s.emit('connected', 'racing')
    s.emit('message', 'racing', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.native.registerResumeToken).toHaveBeenCalledOnce())
    const stopping = s.host.stop()
    release()
    await stopping
    expect(s.sent.some(item => item.peerId === 'racing' && item.frame.kind === 'admitted')).toBe(false)
    expect(s.runtime.hasMembership('p1')).toBe(false)
    expect(s.native.revokeResumeToken).toHaveBeenCalled()
  })
  it('does not reassociate for absent, expired, foreign or wrong-room credentials', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('a'); const second = await s.join('b')
    if (first.kind !== 'admitted' || second.kind !== 'admitted') throw new Error('expected admission')
    const prior = s.runtime.getConnectionId(first.playerId)
    for (const [peerId, playerId, token, roomId] of [
      ['missing', first.playerId, '0'.repeat(64), 'room'],
      ['foreign', first.playerId, second.resumeToken!, 'room'],
      ['wrong-room', first.playerId, first.resumeToken!, 'other'],
    ]) s.emit('message', peerId, { kind: 'resumeHello', protocolVersion: 1, roomId, playerId, resumeToken: token })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.runtime.getConnectionId(first.playerId)).toBe(prior)
    expect(s.sent.some(item => item.frame.kind === 'resumed')).toBe(false)
    expect(s.runtime.hasMembership('p3')).toBe(false)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(first.resumeExpiresAt! + 1)
      s.emit('message', 'expired', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
        playerId: first.playerId, resumeToken: first.resumeToken! })
      await Promise.resolve()
      expect(s.runtime.getConnectionId(first.playerId)).toBe(prior)
    } finally { vi.useRealTimers() }
  })

  it('allows retry with old credential when the rotated response is lost', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('a')
    if (first.kind !== 'admitted') throw new Error('expected admission')
    s.native.send.mockRejectedValueOnce(new Error('socket_lost'))
    s.emit('message', 'lost', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, resumeToken: first.resumeToken! })
    await vi.waitFor(() => expect(s.runtime.getConnectionId(first.playerId)).toBeNull())
    expect(s.native.revokeResumeToken).not.toHaveBeenCalledWith(first.playerId, first.resumeToken)
    s.emit('message', 'retry', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, resumeToken: first.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'retry' && item.frame.kind === 'resumed')).toBe(true))
    expect(s.runtime.hasMembership(first.playerId)).toBe(true)
  })

  it('serializes simultaneous resume attempts and fences the previous peer', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('old')
    if (first.kind !== 'admitted') throw new Error('expected admission')
    let release!: () => void
    s.native.registerResumeToken.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
      return undefined
    })
    const hello: LanFrame = { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, resumeToken: first.resumeToken! }
    s.emit('message', 'new-a', hello)
    await vi.waitFor(() => expect(s.native.registerResumeToken).toHaveBeenCalledTimes(2))
    s.emit('message', 'new-b', hello)
    release()
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'new-a' && item.frame.kind === 'resumed')).toBe(true))
    expect(s.sent.some(item => item.peerId === 'new-b' && item.frame.kind === 'resumed')).toBe(false)
    expect(s.native.closePeer).toHaveBeenCalledWith('old')
    s.emit('message', 'old', { kind: 'resync', request: { protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, lastAppliedRevision: 0 } })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.peerId === 'old' && item.frame.kind === 'snapshot')).toBe(false)
    expect(s.runtime.hasMembership(first.playerId)).toBe(true)
  })

  it('keeps the room running if native rotation registration fails', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('a')
    if (first.kind !== 'admitted') throw new Error('expected admission')
    s.native.registerResumeToken.mockRejectedValueOnce(new Error('registry_unavailable'))
    s.emit('message', 'retry', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, resumeToken: first.resumeToken! })
    await vi.waitFor(() => expect(s.native.closePeer).toHaveBeenCalledWith('retry'))
    expect(s.native.stop).not.toHaveBeenCalled()
    expect(s.runtime.hasMembership(first.playerId)).toBe(true)
  })

  it('sends a resumed player only their own private snapshot', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('a'); const second = await s.join('b')
    if (first.kind !== 'admitted' || second.kind !== 'admitted') throw new Error('expected admission')
    s.emit('disconnected', 'a')
    s.emit('message', 'resumed-a', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: first.playerId, resumeToken: first.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'resumed-a' && item.frame.kind === 'resumed')).toBe(true))
    const resumed = s.sent.find(item => item.peerId === 'resumed-a' && item.frame.kind === 'resumed')!.frame
    expect(resumed).toMatchObject({ snapshot: { privateState: { secret: 'private-p1' } } })
    expect(JSON.stringify(resumed)).not.toContain('private-p2')
    expect(s.sent.filter(item => item.peerId === 'b').map(item => JSON.stringify(item.frame)).join('')).not.toContain('private-p1')
  })
  it('issues a distinct individual resume credential in admitted, never in the invite', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('a'); const second = await s.join('b')
    if (first.kind !== 'admitted' || second.kind !== 'admitted') throw new Error('expected admission')
    expect(first.resumeToken).toMatch(/^[0-9a-f]{64}$/)
    expect(second.resumeToken).toMatch(/^[0-9a-f]{64}$/)
    expect(second.resumeToken).not.toBe(first.resumeToken)
    expect(first.resumeExpiresAt).toBeGreaterThan(Date.now())
    expect(s.native.registerResumeToken).toHaveBeenCalledWith('p1', first.resumeToken, first.resumeExpiresAt)
    expect(JSON.stringify(s.host.currentInvite)).not.toContain(first.resumeToken)
  })

  it('reassociates only a credential holder, preserves player and deduplicates a retried command', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const admitted = await s.join('old')
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    s.emit('message', 'old', { kind: 'command', command: command(admitted.playerId, 'stable') })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(2))
    const oldConnection = s.runtime.getConnectionId(admitted.playerId)
    s.emit('disconnected', 'old')
    await vi.waitFor(() => expect(s.runtime.getConnectionId(admitted.playerId)).toBeNull())
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, resumeToken: admitted.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(true))
    const resumed = s.sent.find(item => item.peerId === 'new' && item.frame.kind === 'resumed')!.frame
    expect(resumed).toMatchObject({ kind: 'resumed', playerId: admitted.playerId,
      snapshot: { revision: 2, privateState: { secret: `private-${admitted.playerId}` } } })
    expect(s.runtime.getConnectionId(admitted.playerId)).not.toBe(oldConnection)
    s.emit('message', 'old', { kind: 'command', command: command(admitted.playerId, 'old-stale') })
    s.emit('message', 'new', { kind: 'command', command: command(admitted.playerId, 'stable') })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'commandResult')).toBe(true))
    expect(s.runtime.getRevision()).toBe(2)
    expect(s.sent.some(item => item.peerId === 'old' && item.frame.kind === 'commandResult' && item.frame.result.commandId === 'old-stale')).toBe(false)
  })

  it('revokes the previous credential only after an authenticated resume ACK', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const admitted = await s.join('old')
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    s.emit('disconnected', 'old')
    s.emit('message', 'new', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, resumeToken: admitted.resumeToken! })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'new' && item.frame.kind === 'resumed')).toBe(true))
    const first = s.sent.find(item => item.peerId === 'new' && item.frame.kind === 'resumed')!.frame
    if (first.kind !== 'resumed') throw new Error('expected resumption')
    expect(first.resumeToken).not.toBe(admitted.resumeToken)
    expect(s.native.revokeResumeToken).not.toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken)
    s.emit('message', 'new', { kind: 'resumeAck', protocolVersion: 1, roomId: 'room', playerId: admitted.playerId })
    await vi.waitFor(() => expect(s.native.revokeResumeToken).toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken))
    s.emit('message', 'replay', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, resumeToken: admitted.resumeToken! })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(s.sent.some(item => item.peerId === 'replay' && item.frame.kind === 'resumed')).toBe(false)
    s.emit('message', 'again', { kind: 'resumeHello', protocolVersion: 1, roomId: 'room',
      playerId: admitted.playerId, resumeToken: first.resumeToken })
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'again' && item.frame.kind === 'resumed')).toBe(true))
  })

  it('announces definitive room closure before stopping native sockets and revokes resume', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const admitted = await s.join('a')
    if (admitted.kind !== 'admitted') throw new Error('expected admission')
    await s.host.stop()
    expect(s.sent.some(item => item.peerId === 'a' && item.frame.kind === 'roomClosed')).toBe(true)
    expect(s.native.send.mock.invocationCallOrder.at(-1)).toBeLessThan(s.native.stop.mock.invocationCallOrder[0])
    expect(s.native.revokeResumeToken).toHaveBeenCalledWith(admitted.playerId, admitted.resumeToken)
    expect(s.runtime.hasMembership(admitted.playerId)).toBe(false)
  })
  it('admits two peers with distinct private snapshots and no cross-recipient private event', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = await s.join('peer-a'); await s.join('peer-b')
    expect(first).toMatchObject({ kind: 'admitted', playerId: 'p1', snapshot: { privateState: { secret: 'private-p1' } } })
    expect(s.sent.filter(x => x.peerId === 'peer-b').map(x => JSON.stringify(x.frame)).join('')).not.toContain('private-p1')
    s.emit('message', 'peer-a', { kind: 'command', command: command('p1', 'c1') })
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'peer-b' && x.frame.kind === 'event' && x.frame.event.revision === 3)).toBe(true))
    expect(s.sent.filter(x => x.peerId === 'peer-a').map(x => JSON.stringify(x.frame)).join('')).not.toContain('private-p2')
    expect(s.sent.filter(x => x.peerId === 'peer-b').map(x => JSON.stringify(x.frame)).join('')).not.toContain('private-p1')
  })

  it('rejects forged player, wrong room, duplicate conflict, unknown and stale peers', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a'); await s.join('b')
    s.emit('message', 'a', { kind: 'command', command: command('p2', 'forged') })
    s.emit('message', 'a', { kind: 'command', command: { ...command('p1', 'wrong'), roomId: 'other' } })
    s.emit('message', 'ghost', { kind: 'command', command: command('p1', 'ghost') })
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'same') })
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'same') })
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'same', 2) })
    await vi.waitFor(() => expect(s.sent.filter(x => x.peerId === 'a' && x.frame.kind === 'commandResult')).toHaveLength(5))
    expect(s.sent.some(x => x.peerId === 'ghost')).toBe(false)
    expect(s.sent.filter(x => x.peerId === 'a' && x.frame.kind === 'commandResult').map(x => x.frame)).toMatchObject([
      { result: { error: 'unauthorized' } }, { result: { error: 'room_not_found' } },
      { result: { status: 'accepted' } }, { result: { status: 'accepted' } },
      { result: { error: 'command_conflict' } },
    ])
    expect(s.runtime.getRevision()).toBe(3)
    s.emit('disconnected', 'a')
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'stale') })
    await vi.waitFor(() => expect(s.runtime.getConnectionId('p1')).toBeNull())
    expect(s.runtime.getRevision()).toBe(3)
  })

  it('rejects unauthorized resync and sends only the caller snapshot', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a'); await s.join('b')
    s.emit('message', 'a', { kind: 'resync', request: { protocolVersion: 1, roomId: 'room', playerId: 'p2', lastAppliedRevision: 0 } })
    s.emit('message', 'a', { kind: 'resync', request: { protocolVersion: 1, roomId: 'room', playerId: 'p1', lastAppliedRevision: 0 } })
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'a' && x.frame.kind === 'snapshot')).toBe(true))
    expect(s.sent.filter(x => x.peerId === 'a' && x.frame.kind === 'snapshot')).toHaveLength(1)
    expect(s.sent.filter(x => x.peerId === 'a').map(x => JSON.stringify(x.frame)).join('')).not.toContain('private-p2')
  })

  it('compensates failed admitted send without ghost membership and preserves revision stream', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    s.native.send.mockRejectedValueOnce(new Error('write_failed'))
    const invite = s.host.currentInvite!
    s.emit('connected', 'b'); s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(3))
    expect(s.runtime.hasMembership('p2')).toBe(false)
    expect(s.sent.filter((x): x is { peerId: string; frame: Extract<LanFrame, { kind: 'event' }> } => x.peerId === 'a' && x.frame.kind === 'event').map(x => x.frame.event.revision)).toEqual([2, 3])
    expect(s.host.currentInvite?.capability).not.toBe(invite.capability)
  })

  it('does not create a membership for an oversized admitted snapshot', async () => {
    const huge: typeof adapter = { ...adapter, projectPrivate: (_state, playerId) => ({ secret: playerId + 'x'.repeat(20_000) }) }
    const s = setup(huge); await s.host.start('room', '10.1.1.2')
    const invite = s.host.currentInvite!
    s.emit('connected', 'a'); s.emit('message', 'a', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(2))
    expect(s.runtime.hasMembership('p1')).toBe(false)
    await vi.waitFor(() => expect(s.sent).toMatchObject([{ peerId: 'a', frame: { kind: 'rejected', error: 'coordinator_rejected' } }]))
  })

  it('holds commands during admission and sends join revisions before later results', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async (peerId, frame) => {
      if (frame.kind === 'admitted') await wait
      s.sent.push({ peerId, frame })
    })
    const invite = s.host.currentInvite!
    s.emit('connected', 'b'); s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(2))
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'during') })
    expect(s.runtime.getRevision()).toBe(2)
    release()
    await vi.waitFor(() => expect(s.sent.some(item => item.peerId === 'b' && item.frame.kind === 'admitted')).toBe(true))
    const admittedB = s.sent.find(item => item.peerId === 'b' && item.frame.kind === 'admitted')!.frame
    if (admittedB.kind !== 'admitted') throw new Error('expected admission')
    s.emit('message', 'b', { kind: 'admissionAck', protocolVersion: 1, roomId: 'room', playerId: 'p2',
      admissionId: admittedB.admissionId! })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(3))
    expect(s.sent.filter(x => x.peerId === 'a').map(x => x.frame.kind)).toEqual([
      'admitted', 'admissionConfirmed', 'event', 'commandResult', 'event',
    ])
  })

  it('compensates a disconnect during membership creation', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async () => { await wait })
    const invite = s.host.currentInvite!
    s.emit('connected', 'a'); s.emit('message', 'a', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.hasMembership('p1')).toBe(true))
    s.emit('disconnected', 'a'); release()
    await vi.waitFor(() => expect(s.runtime.hasMembership('p1')).toBe(false))
  })

  it('closes active peers and aborts an in-flight admission', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async () => { await wait })
    const invite = s.host.currentInvite!
    s.emit('connected', 'b'); s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.hasMembership('p2')).toBe(true))
    await vi.waitFor(() => expect(s.native.send).toHaveBeenCalledWith('b', expect.objectContaining({ kind: 'admitted' })))
    await s.host.stop(); release()
    expect(s.runtime.hasMembership('p1')).toBe(false)
    expect(s.runtime.hasMembership('p2')).toBe(false)
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'after') })
    expect(s.runtime.getRevision()).toBe(4)
  })

  it('keeps a membership disconnected when its snapshot cannot be sent', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    s.native.send.mockRejectedValueOnce(new Error('write_failed'))
    s.emit('message', 'a', { kind: 'resync', request: { protocolVersion: 1, roomId: 'room', playerId: 'p1', lastAppliedRevision: 0 } })
    await vi.waitFor(() => expect(s.runtime.getConnectionId('p1')).toBeNull())
    expect(s.runtime.hasMembership('p1')).toBe(true)
  })

  it('does not log invitation capabilities or private projections', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      const s = setup(); const invite = await s.host.start('room', '10.1.1.2'); await s.join('a')
      expect(JSON.stringify(spy.mock.calls)).not.toContain(invite.capability)
      expect(JSON.stringify(spy.mock.calls)).not.toContain('private-p1')
    } finally { spy.mockRestore() }
  })

  it('does not let the local host mutate the runtime while a guest admission is pending', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const local = s.host.joinLocal()
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async () => { await wait })
    const invite = s.host.currentInvite!
    s.emit('connected', 'a'); s.emit('message', 'a', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(2))
    expect(() => s.host.processLocalCommand(command(local.playerId, 'local'))).toThrow('admission_pending')
    expect(s.runtime.getRevision()).toBe(2)
    release()
  })

  it('does not retain membership when the runtime room differs from the invite room', async () => {
    const s = setup(); await s.host.start('other', '10.1.1.2')
    const invite = s.host.currentInvite!
    s.emit('connected', 'a'); s.emit('message', 'a', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'a' && x.frame.kind === 'rejected')).toBe(true))
    expect(s.runtime.hasMembership('p1')).toBe(false)
    expect(s.sent.some(x => x.frame.kind === 'admitted')).toBe(false)
  })

  it('does not create a local member for a mismatched runtime room', async () => {
    const s = setup(); await s.host.start('other', '10.1.1.2')
    expect(() => s.host.joinLocal()).toThrow('room_mismatch')
    expect(s.runtime.hasMembership('p1')).toBe(false)
  })

  it('rejects expired and reused invitations without adding players', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const first = s.host.currentInvite!
    await s.join('a')
    await vi.waitFor(() => expect(s.host.currentInvite?.capability).not.toBe(first.capability))
    s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite: first })
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'b' && x.frame.kind === 'rejected')).toBe(true))
    const current = s.host.currentInvite!
    const now = vi.spyOn(Date, 'now').mockReturnValue(current.expiresAt)
    try { s.emit('message', 'c', { kind: 'joinRequest', protocolVersion: 1, invite: current }) }
    finally { now.mockRestore() }
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'c' && x.frame.kind === 'rejected')).toBe(true))
    expect(s.sent.find(x => x.peerId === 'c')?.frame).toMatchObject({ error: 'invite_expired' })
    expect(s.runtime.getRevision()).toBe(1)
  })

  it('waits for a command delivery to finish before creating the next membership', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async (peerId, frame) => {
      await wait
      s.sent.push({ peerId, frame })
    })
    s.emit('message', 'a', { kind: 'command', command: command('p1', 'first') })
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(2))
    const invite = s.host.currentInvite!
    s.emit('connected', 'b'); s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite })
    expect(s.runtime.getRevision()).toBe(2)
    release()
    await vi.waitFor(() => expect(s.runtime.getRevision()).toBe(3))
  })

  it('consumes a denied invite, rejects simultaneous use and leaves the host local without a socket', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2')
    const local = s.host.joinLocal()
    expect(local.playerId).toBe('p1')
    const invite = s.host.currentInvite!
    s.emit('connected', 'a'); s.emit('connected', 'b')
    s.emit('message', 'a', { kind: 'joinRequest', protocolVersion: 1, invite })
    s.emit('message', 'b', { kind: 'joinRequest', protocolVersion: 1, invite })
    await vi.waitFor(() => expect(s.sent.some(x => x.peerId === 'b' && x.frame.kind === 'rejected')).toBe(true))
    expect(s.sent.find(x => x.peerId === 'b')?.frame).toMatchObject({ error: 'invite_used' })
    expect(s.runtime.getConnectionId('p1')).toBeTruthy()
    await s.host.stop()
    expect(s.native.stop).toHaveBeenCalledOnce()
  })

  it('serializes consecutive local deliveries by recipient and revision', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a'); await s.join('b')
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async (peerId, frame) => {
      await held
      s.sent.push({ peerId, frame })
    })
    const local = s.host.joinLocal()
    s.host.processLocalCommand(command(local.playerId, 'local-1'))
    expect(eventRevisions(s.sent, 'a')).not.toContain(4)
    release()
    await vi.waitFor(() => expect(eventRevisions(s.sent, 'a')).toEqual([2, 3, 4]))
    expect(eventRevisions(s.sent, 'b')).toEqual([3, 4])
  })

  it('waits for a pending local delivery before stopping the native host', async () => {
    const s = setup(); await s.host.start('room', '10.1.1.2'); await s.join('a')
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    s.native.send.mockImplementationOnce(async (peerId, frame) => {
      await held
      s.sent.push({ peerId, frame })
    })
    s.host.joinLocal()
    await vi.waitFor(() => expect(s.native.send).toHaveBeenCalledWith('a', expect.objectContaining({ kind: 'event', event: expect.objectContaining({ revision: 2 }) })))
    const stopping = s.host.stop()
    expect(s.native.stop).not.toHaveBeenCalled()
    release()
    await stopping
    expect(s.native.stop).toHaveBeenCalledOnce()
    expect(eventRevisions(s.sent, 'a')).toEqual([2])
  })
})
