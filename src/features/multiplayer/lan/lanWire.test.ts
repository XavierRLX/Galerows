import { describe, expect, it } from 'vitest'
import { decodeLanFrame, encodeLanFrame, LAN_MAX_FRAME_BYTES } from './lanWire'

describe('LAN 4A wire framing', () => {
  const hello = { kind: 'hello', roomId: 'room-1', inviteToken: 'test-token', protocolVersion: 1 } as const
  it('roundtrips a handshake without internet services', () => {
    expect(decodeLanFrame(encodeLanFrame(hello))).toEqual({ ok: true, frame: hello })
  })
  it('rejects malformed JSON and unrecognized message types', () => {
    expect(decodeLanFrame('{')).toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodeLanFrame('{"kind":"execute"}')).toEqual({ ok: false, error: 'invalid_frame' })
  })
  it('rejects frames larger than the byte limit', () => {
    expect(decodeLanFrame('x'.repeat(LAN_MAX_FRAME_BYTES + 1))).toEqual({ ok: false, error: 'frame_too_large' })
  })
  it('rejects unsupported protocol versions', () => {
    expect(decodeLanFrame(JSON.stringify({ ...hello, protocolVersion: 999 }))).toEqual({ ok: false, error: 'incompatible_protocol' })
  })
  it('does not accept command frames without protocol fields', () => {
    expect(decodeLanFrame(JSON.stringify({ kind: 'command', command: { type: 'move' } }))).toEqual({ ok: false, error: 'invalid_frame' })
  })
  it('roundtrips the v1 leave exchange and rejects malformed confirmations', () => {
    const request = { kind: 'leaveRequest', protocolVersion: 1, roomId: 'room', playerId: 'p1', commandId: 'leave-1' } as const
    const confirmed = { kind: 'leaveConfirmed', protocolVersion: 1, roomId: 'room', playerId: 'p1',
      commandId: 'leave-1', revision: 4 } as const
    expect(decodeLanFrame(encodeLanFrame(request))).toEqual({ ok: true, frame: request })
    expect(decodeLanFrame(encodeLanFrame(confirmed))).toEqual({ ok: true, frame: confirmed })
    expect(decodeLanFrame(JSON.stringify({ ...confirmed, revision: -1 }))).toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodeLanFrame(JSON.stringify({ ...request, protocolVersion: 2 }))).toEqual({ ok: false, error: 'incompatible_protocol' })
  })

  it('roundtrips explicit join, admission and typed rejection frames', async () => {
    const { createLanInvite } = await import('./lanInvite')
    const invite = createLanInvite({ roomId: 'room-1', hostIp: '10.245.112.98', port: 36157,
      fingerprint: 'ab'.repeat(32) })
    const frames = [
      { kind: 'joinRequest', protocolVersion: 1, invite },
      { kind: 'rejected', protocolVersion: 1, error: 'invite_used' },
      { kind: 'admissionAck', protocolVersion: 1, roomId: 'room-1', playerId: 'player-1', admissionId: 'c'.repeat(64) },
      { kind: 'admissionConfirmed', protocolVersion: 1, roomId: 'room-1', playerId: 'player-1', admissionId: 'c'.repeat(64) },
      { kind: 'admitted', protocolVersion: 1, playerId: 'player-1', snapshot: {
        protocolVersion: 1, roomId: 'room-1', revision: 0,
        roomState: { playerIds: ['player-1'], barriers: [] }, gamePublicState: {}, privateState: null,
      } },
    ] as const
    for (const frame of frames) expect(decodeLanFrame(encodeLanFrame(frame))).toEqual({ ok: true, frame })
  })

  it('rejects malformed admission, oversized snapshots and unsupported join versions', () => {
    expect(decodeLanFrame(JSON.stringify({ kind: 'admitted', protocolVersion: 1, playerId: 'p' })))
      .toEqual({ ok: false, error: 'invalid_frame' })
    expect(decodeLanFrame(JSON.stringify({ kind: 'joinRequest', protocolVersion: 99, invite: {} })))
      .toEqual({ ok: false, error: 'incompatible_protocol' })
    expect(() => encodeLanFrame({ kind: 'admitted', protocolVersion: 1, playerId: 'p', snapshot: {
      protocolVersion: 1, roomId: 'r', revision: 0,
      roomState: { playerIds: [], barriers: [] }, gamePublicState: 'x'.repeat(LAN_MAX_FRAME_BYTES), privateState: null,
    } })).toThrow('frame_too_large')
  })

  it('fits a representative room snapshot below the current 16 KiB frame contract', () => {
    const playerIds = Array.from({ length: 16 }, (_, index) => `player-${index}`)
    const frame = { kind: 'admitted', protocolVersion: 1, playerId: 'player-0', snapshot: {
      protocolVersion: 1, roomId: 'room-1', revision: 42,
      roomState: { playerIds, barriers: Array.from({ length: 32 }, (_, index) => ({
        id: `barrier-${index}`, type: 'round', expectedCount: 16, completedCount: 8, isComplete: false,
      })) }, gamePublicState: { phase: 'waiting', note: 'a'.repeat(2048) }, privateState: { note: 'b'.repeat(512) },
    } } as const
    const encoded = encodeLanFrame(frame)
    expect(new TextEncoder().encode(encoded).length).toBeLessThan(LAN_MAX_FRAME_BYTES)
    expect(decodeLanFrame(encoded).ok).toBe(true)
  })

  it('roundtrips authoritative result, projection event and snapshot envelopes', () => {
    const roomState = { playerIds: ['p1'], barriers: [] }
    const frames = [
      { kind: 'commandResult', result: { protocolVersion: 1, roomId: 'room-1', commandId: 'c1', status: 'accepted', revision: 2 } },
      { kind: 'event', event: { protocolVersion: 1, roomId: 'room-1', revision: 2,
        kind: 'projection', roomState, gamePublicState: { count: 1 }, privateState: { secret: 'p1' } } },
      { kind: 'snapshot', snapshot: { protocolVersion: 1, roomId: 'room-1', revision: 2,
        roomState, gamePublicState: { count: 1 }, privateState: { secret: 'p1' } } },
    ] as const
    for (const frame of frames) {
      const raw = encodeLanFrame(frame)
      expect(decodeLanFrame(raw)).toEqual({ ok: true, frame })
      expect(new TextEncoder().encode(raw).length).toBeLessThan(LAN_MAX_FRAME_BYTES)
    }
  })

  it('rejects an oversized event as one logical message even if WebSocket could fragment it', () => {
    const oversized = { kind: 'event', event: { protocolVersion: 1, roomId: 'room-1', revision: 2,
      kind: 'projection', roomState: { playerIds: ['p1'], barriers: [] },
      gamePublicState: { blob: 'x'.repeat(LAN_MAX_FRAME_BYTES) }, privateState: null } } as const
    expect(() => encodeLanFrame(oversized)).toThrow('frame_too_large')
    expect(decodeLanFrame(JSON.stringify(oversized))).toEqual({ ok: false, error: 'frame_too_large' })
  })
})
