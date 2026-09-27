import { describe, expect, it } from 'vitest'
import { parseCommand, parseResyncRequest, PROTOCOL_VERSION } from './protocol'

describe('multiplayer protocol', () => {
  it('accepts a structurally valid V1 command while leaving game payload unknown', () => {
    const parsed = parseCommand({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      playerId: 'player-1',
      commandId: 'command-1',
      type: 'TEST',
      payload: { value: 1 },
    })

    expect(parsed).toEqual({
      ok: true,
      command: {
        protocolVersion: 1,
        roomId: 'room-1',
        playerId: 'player-1',
        commandId: 'command-1',
        type: 'TEST',
        payload: { value: 1 },
      },
    })
  })

  it('rejects incompatible protocol before game-specific parsing', () => {
    expect(parseCommand({
      protocolVersion: 2,
      roomId: 'room-1',
      playerId: 'player-1',
      commandId: 'command-1',
      type: 'TEST',
      payload: null,
    })).toEqual({
      ok: false,
      error: 'incompatible_protocol',
      roomId: 'room-1',
      commandId: 'command-1',
    })
  })

  it('rejects malformed common envelope fields', () => {
    expect(parseCommand({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      commandId: 'command-1',
      type: 'TEST',
      payload: null,
    })).toMatchObject({ ok: false, error: 'invalid_payload' })
  })

  it('validates ResyncRequest at the protocol boundary', () => {
    expect(parseResyncRequest({
      protocolVersion: PROTOCOL_VERSION,
      roomId: 'room-1',
      playerId: 'player-1',
      lastAppliedRevision: 3,
    })).toEqual({
      ok: true,
      request: {
        protocolVersion: PROTOCOL_VERSION,
        roomId: 'room-1',
        playerId: 'player-1',
        lastAppliedRevision: 3,
      },
    })
    expect(parseResyncRequest({
      protocolVersion: 2,
      roomId: 'room-1',
      playerId: 'player-1',
      lastAppliedRevision: 3,
    })).toEqual({ ok: false, error: 'incompatible_protocol' })
  })
})
