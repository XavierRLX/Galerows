import { describe, expect, it, vi } from 'vitest'
import { createLanInvite, hostVerificationCode } from './lanInvite'
import { LanRoomSession } from './lanRoomSession'
import type { LanFrame } from './lanWire'

const invite = () => createLanInvite({ roomId: 'room', hostIp: '10.1.1.2', port: 4321, fingerprint: 'ab'.repeat(32) })
const snapshot = { protocolVersion: 1, roomId: 'room', revision: 1,
  roomState: { playerIds: ['p1'], barriers: [] }, gamePublicState: { count: 0 }, privateState: { secret: 'mine' } }
const resumeToken = 'a'.repeat(64)
const admissionId = 'c'.repeat(64)
const projection = (revision: number, count: number) => ({ kind: 'event' as const, event: {
  protocolVersion: 1, roomId: 'room', revision, kind: 'projection' as const,
  roomState: snapshot.roomState, gamePublicState: { count }, privateState: { secret: 'mine' },
} })
function native() {
  let listener: ((event: { type: string; frame?: LanFrame }) => void) | undefined
  return {
    connect: vi.fn(async () => undefined),
    send: vi.fn(async (frame: LanFrame) => { void frame }),
    disconnect: vi.fn(async () => undefined),
    storeResumeCredential: vi.fn(async (credential: unknown) => { void credential }),
    rotateResumeCredential: vi.fn(async (roomId: string, playerId: string, resumeToken: string, expiresAt: number) => {
      void roomId; void playerId; void resumeToken; void expiresAt
    }),
    connectResume: vi.fn(async (roomId: string) => { void roomId }),
    clearResumeCredential: vi.fn(async (roomId: string) => { void roomId }),
    onEvent: vi.fn(async (callback: typeof listener) => { listener = callback; return { remove: async () => { listener = undefined } } }),
    emit: (event: { type: string; frame?: LanFrame }) => listener?.(event),
  }
}
async function admit(client: ReturnType<typeof native>) {
  const session = new LanRoomSession<{ count: number }, { secret: string }>(client)
  const entered = vi.fn(async () => hostVerificationCode(invite().fingerprint))
  const pending = session.connectInvite(invite(), entered)
  await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
  client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot,
    admissionId, resumeToken, resumeExpiresAt: Date.now() + 60_000 } })
  await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith({ kind: 'admissionAck', protocolVersion: 1,
    roomId: 'room', playerId: 'p1', admissionId }))
  client.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
    roomId: 'room', playerId: 'p1', admissionId } })
  return { pending, session, entered }
}

describe('LanRoomSession', () => {
  it('clears the durable credential only after an authenticated leave confirmation', async () => {
    const client = native()
    const { pending, session } = await admit(client)
    await pending
    const leaving = session.leaveRoom('leave-1')
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith({ kind: 'leaveRequest',
      protocolVersion: 1, roomId: 'room', playerId: 'p1', commandId: 'leave-1' }))
    expect(client.clearResumeCredential).not.toHaveBeenCalled()
    client.emit({ type: 'message', frame: { kind: 'leaveConfirmed', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', commandId: 'leave-1', revision: 2 } })
    await leaving
    expect(client.clearResumeCredential).toHaveBeenCalledWith('room')
    expect(client.disconnect).toHaveBeenCalled()
  })

  it('treats a confirmed leave as final even if native socket closure reports an error', async () => {
    const client = native()
    const { pending, session } = await admit(client)
    await pending
    client.disconnect.mockRejectedValueOnce(new Error('already_closed'))
    const leaving = session.leaveRoom('leave-final')
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'leaveRequest' })))
    client.emit({ type: 'message', frame: { kind: 'leaveConfirmed', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', commandId: 'leave-final', revision: 2 } })
    await expect(leaving).resolves.toBeUndefined()
    expect(client.clearResumeCredential).toHaveBeenCalledWith('room')
  })

  it('keeps the credential and reports uncertainty when the leave ACK is lost', async () => {
    const client = native()
    const { pending, session } = await admit(client)
    await pending
    const leaving = session.leaveRoom('leave-2', 20)
    await expect(leaving).rejects.toThrow('leave_unconfirmed')
    expect(client.clearResumeCredential).not.toHaveBeenCalled()
  })

  it('ignores a leave confirmation for another player and keeps the credential', async () => {
    const client = native()
    const { pending, session } = await admit(client)
    await pending
    const leaving = session.leaveRoom('stable-id', 20)
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'leaveRequest' })))
    client.emit({ type: 'message', frame: { kind: 'leaveConfirmed', protocolVersion: 1,
      roomId: 'room', playerId: 'p2', commandId: 'stable-id', revision: 2 } })
    await expect(leaving).rejects.toThrow('leave_unconfirmed')
    expect(client.clearResumeCredential).not.toHaveBeenCalled()
  })

  it('keeps the socket and credential when the host reports failed revocation', async () => {
    const client = native()
    const { pending, session } = await admit(client)
    await pending
    const leaving = session.leaveRoom('stable-id')
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'leaveRequest' })))
    client.emit({ type: 'message', frame: { kind: 'leaveRejected', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', commandId: 'stable-id', error: 'revocation_failed' } })
    await expect(leaving).rejects.toThrow('revocation_failed')
    expect(client.clearResumeCredential).not.toHaveBeenCalled()
    expect(client.disconnect).not.toHaveBeenCalled()
  })
  it('can cancel a pending host-code comparison and close the native socket', async () => {
    const client = native()
    const session = new LanRoomSession(client)
    const pending = session.connectInvite(invite(), () => new Promise<string>(() => undefined))
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledOnce())
    await session.disconnect()
    expect(client.disconnect).toHaveBeenCalledOnce()
    void pending.catch(() => undefined)
  })
  it('reports TLS verification and waits for admission confirmation before reporting in room', async () => {
    const client = native()
    const session = new LanRoomSession(client)
    const phases: string[] = []
    const pending = session.connectInvite(invite(), async () => hostVerificationCode(invite().fingerprint), phase => phases.push(phase))
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
    expect(phases).toEqual(['connecting', 'verifying_host', 'joining'])
    client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot,
      admissionId, resumeToken, resumeExpiresAt: Date.now() + 60_000 } })
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'admissionAck' })))
    expect(phases).toEqual(['connecting', 'verifying_host', 'joining', 'confirming_credential'])
    client.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', admissionId } })
    await pending
    expect(phases.at(-1)).toBe('in_room')
  })
  it('does not ACK or expose admission when durable credential storage fails', async () => {
    const client = native()
    client.storeResumeCredential.mockRejectedValueOnce(new Error('vault_unavailable'))
    const session = new LanRoomSession(client)
    const pending = session.connectInvite(invite(), async () => hostVerificationCode(invite().fingerprint))
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
    client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot,
      admissionId, resumeToken, resumeExpiresAt: Date.now() + 60_000 } })
    await expect(pending).rejects.toThrow('vault_unavailable')
    expect(client.send).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'admissionAck' }))
    expect(client.disconnect).toHaveBeenCalled()
  })

  it('waits for host confirmation after persisting and ACKing the initial credential', async () => {
    const client = native()
    const session = new LanRoomSession(client)
    const pending = session.connectInvite(invite(), async () => hostVerificationCode(invite().fingerprint))
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
    client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot,
      admissionId, resumeToken, resumeExpiresAt: Date.now() + 60_000 } })
    await vi.waitFor(() => expect(client.storeResumeCredential).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith({ kind: 'admissionAck', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', admissionId }))
    let settled = false
    void pending.finally(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    client.emit({ type: 'message', frame: { kind: 'admissionConfirmed', protocolVersion: 1,
      roomId: 'room', playerId: 'p1', admissionId } })
    await expect(pending).resolves.toMatchObject({ playerId: 'p1' })
  })

  it('fails closed after persistence when the admission ACK cannot be sent', async () => {
    const client = native()
    client.send.mockImplementation(async frame => {
      if (frame.kind === 'admissionAck') throw new Error('socket_lost')
    })
    const session = new LanRoomSession(client)
    const pending = session.connectInvite(invite(), async () => hostVerificationCode(invite().fingerprint))
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
    client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot,
      admissionId, resumeToken, resumeExpiresAt: Date.now() + 60_000 } })
    await expect(pending).rejects.toThrow('admission_ack_failed')
    expect(client.storeResumeCredential).toHaveBeenCalledOnce()
    expect(client.disconnect).toHaveBeenCalled()
  })

  it('clears the stored credential on host shutdown but retains it after a lost socket', async () => {
    const endedNative = native()
    const { pending: endedPending, session: endedSession } = await admit(endedNative)
    await endedPending
    endedNative.emit({ type: 'message', frame: { kind: 'roomClosed', protocolVersion: 1, roomId: 'room' } })
    await vi.waitFor(() => expect(endedNative.clearResumeCredential).toHaveBeenCalledWith('room'))
    expect(endedSession.lastClosureReason).toBe('room_closed')
    const lostNative = native()
    const { pending: lostPending, session: lostSession } = await admit(lostNative)
    await lostPending
    lostNative.emit({ type: 'closed' })
    await vi.waitFor(() => expect(lostNative.disconnect).toHaveBeenCalled())
    expect(lostNative.clearResumeCredential).not.toHaveBeenCalled()
    expect(lostSession.lastClosureReason).toBe('connection_lost')
  })
  it('waits for TLS, manual code and admitted before exposing replica; applies an immediate event', async () => {
    const client = native()
    const { pending, entered } = await admit(client)
    client.emit({ type: 'message', frame: projection(2, 1) })
    const joined = await pending
    expect(entered).toHaveBeenCalledOnce()
    expect(client.connect).toHaveBeenCalledWith('10.1.1.2', 4321, 'ab'.repeat(32), 'room', expect.any(String))
    expect(joined.playerId).toBe('p1')
    expect(client.storeResumeCredential).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 'room', playerId: 'p1', resumeToken, host: '10.1.1.2', port: 4321,
    }))
    expect(joined.replica.getState()).toMatchObject({ lastAppliedRevision: 2, gamePublicState: { count: 1 }, privateState: { secret: 'mine' } })
  })

  it('resumes through the stored credential, applies an authorized snapshot and ACKs after persistence', async () => {
    const firstNative = native()
    const { pending } = await admit(firstNative)
    const first = await pending
    await first.transport.disconnect()
    const nextNative = native()
    const resumedSession = new LanRoomSession<{ count: number }, { secret: string }>(nextNative)
    const resumed = resumedSession.resume('room', 'p1', first.replica)
    await vi.waitFor(() => expect(nextNative.connectResume).toHaveBeenCalledWith('room'))
    nextNative.emit({ type: 'message', frame: { kind: 'resumed', protocolVersion: 1, playerId: 'p1',
      snapshot: { ...snapshot, revision: 4, gamePublicState: { count: 4 } },
      resumeToken: 'b'.repeat(64), resumeExpiresAt: Date.now() + 60_000 } })
    nextNative.emit({ type: 'message', frame: projection(5, 5) })
    const joined = await resumed
    expect(joined.replica).toBe(first.replica)
    expect(joined.replica.getState()).toMatchObject({ lastAppliedRevision: 5, gamePublicState: { count: 5 } })
    expect(nextNative.rotateResumeCredential).toHaveBeenCalledWith('room', 'p1', 'b'.repeat(64), expect.any(Number))
    expect(nextNative.send).toHaveBeenCalledWith({ kind: 'resumeAck', protocolVersion: 1, roomId: 'room', playerId: 'p1' })
  })

  it('restores a new replica from the authorized snapshot after guest process restart', async () => {
    const client = native()
    const session = new LanRoomSession<{ count: number }, { secret: string }>(client)
    const pending = session.resume('room')
    await vi.waitFor(() => expect(client.connectResume).toHaveBeenCalledWith('room'))
    client.emit({ type: 'message', frame: { kind: 'resumed', protocolVersion: 1, playerId: 'p1', snapshot,
      resumeToken: 'b'.repeat(64), resumeExpiresAt: Date.now() + 60_000 } })
    const joined = await pending
    expect(joined.playerId).toBe('p1')
    expect(joined.replica.getState()).toMatchObject({ lastAppliedRevision: 1, privateState: { secret: 'mine' } })
  })

  it('applies results without advancing revision, then handles duplicate, stale, marker and rejection', async () => {
    const client = native()
    const { pending } = await admit(client)
    const joined = await pending
    client.emit({ type: 'message', frame: { kind: 'commandResult', result: { protocolVersion: 1, roomId: 'room', commandId: 'c1', status: 'accepted', revision: 2 } } })
    expect(joined.replica.getState().lastAppliedRevision).toBe(1)
    client.emit({ type: 'message', frame: projection(2, 1) })
    client.emit({ type: 'message', frame: projection(2, 999) })
    client.emit({ type: 'message', frame: projection(1, 999) })
    client.emit({ type: 'message', frame: { kind: 'event', event: { protocolVersion: 1, roomId: 'room', revision: 3, kind: 'marker' } } })
    client.emit({ type: 'message', frame: { kind: 'commandResult', result: { protocolVersion: 1, roomId: 'room', commandId: 'c2', status: 'rejected', error: 'invalid_phase' } } })
    expect(joined.replica.getState()).toMatchObject({ lastAppliedRevision: 3, gamePublicState: { count: 1 } })
    expect(joined.replica.getCommandResult('c1')?.status).toBe('accepted')
    expect(joined.replica.getCommandResult('c2')?.status).toBe('rejected')
  })

  it('requests one resync on a revision gap and recovers from an authorized snapshot', async () => {
    const client = native()
    const { pending } = await admit(client)
    const joined = await pending
    client.emit({ type: 'message', frame: projection(4, 4) })
    client.emit({ type: 'message', frame: projection(5, 5) })
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith({ kind: 'resync', request: {
      protocolVersion: 1, roomId: 'room', playerId: 'p1', lastAppliedRevision: 1,
    } }))
    expect(client.send.mock.calls.filter(([frame]) => frame.kind === 'resync')).toHaveLength(1)
    client.emit({ type: 'message', frame: { kind: 'snapshot', snapshot: { ...snapshot, revision: 5,
      gamePublicState: { count: 5 }, privateState: { secret: 'mine' } } } })
    expect(joined.replica.getState()).toMatchObject({ lastAppliedRevision: 5, needsResync: false, gamePublicState: { count: 5 } })
  })

  it('rejects wrong human code before join and cleans up the native channel', async () => {
    const client = native()
    const session = new LanRoomSession(client)
    await expect(session.connectInvite(invite(), async () => 'WRONG-CODE')).rejects.toThrow('host_identity_mismatch')
    expect(client.send).not.toHaveBeenCalled()
    expect(client.disconnect).toHaveBeenCalled()
  })

  it('rejects an admission whose snapshot does not include its claimed player', async () => {
    const client = native()
    const session = new LanRoomSession(client)
    const pending = session.connectInvite(invite(), async () => hostVerificationCode(invite().fingerprint))
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'joinRequest' })))
    client.emit({ type: 'message', frame: { kind: 'admitted', protocolVersion: 1, playerId: 'p1', snapshot: {
      ...snapshot, roomState: { playerIds: ['p2'], barriers: [] },
    } } })
    await expect(pending).rejects.toThrow('invalid_admission')
    expect(client.disconnect).toHaveBeenCalled()
  })
})
