import { expect, it } from 'vitest'
import { defineMultiplayerGame } from '../multiplayerGames'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../persistentRoom'
import { roomFrameFits } from '../persistentProtocol'
import type { RoomCommandV2 } from '../persistentProtocol'

const bulky = defineMultiplayerGame<{ size: number }, { text: string }>({
  gameId: 'size-check', minPlayers: 1, maxPlayers: 1,
  validateConfig: input => {
    if (typeof input !== 'object' || input === null || !('size' in input)
      || !Number.isSafeInteger(input.size) || (input.size as number) < 1) return { ok: false }
    return { ok: true, config: { size: input.size as number } }
  },
  createInitialState: config => ({ text: 'x'.repeat(config.size) }),
  applyCommand: state => ({ accepted: true, changed: false, state }),
  projectPublic: state => ({ text: state.text }),
  projectPrivate: () => null,
})

function room(size: number) {
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'room-size', hostPlayerId: 'host', hostConnectionId: 'host-conn',
    adapter: new RoomLifecycleAdapter([bulky]),
  })
  const send = (seq: number, type: string, payload: unknown) => runtime.processCommand({
    protocolVersion: 2, scope: 'room', roomId: 'room-size', playerId: 'host',
    commandId: `h-${seq}`, clientSeq: seq, type, payload,
  } satisfies RoomCommandV2, 'host-conn')
  expect(send(1, 'SELECT_GAME', { gameId: 'size-check' }).result.status).toBe('accepted')
  expect(send(2, 'CONFIGURE_GAME', { size }).result.status).toBe('accepted')
  expect(send(3, 'READY', { ready: true }).result.status).toBe('accepted')
  return { runtime, start: () => send(4, 'START_GAME', null) }
}

it('preflights the complete 16 KiB wire envelope before committing a session', () => {
  const small = room(1)
  expect(small.start().result.status).toBe('accepted')
  const baseline = small.runtime.snapshotFor('host', 'host-conn')
  if (!baseline.ok || !baseline.snapshot.gamePublicState) throw new Error('missing baseline')
  const original = baseline.snapshot
  const event = { ...original, kind: 'projection' }
  const overhead = JSON.stringify({ kind: 'eventV2', protocolVersion: 2, event }).length - 1
  const candidateLength = 16 * 1024 - overhead + 1
  const candidate = {
    ...original,
    roomState: { ...original.roomState, selectedConfig: { size: candidateLength } },
    gamePublicState: { ...original.gamePublicState, data: { text: 'x'.repeat(candidateLength) } },
  }
  expect(roomFrameFits(candidate)).toBe(true)
  expect(roomFrameFits({ kind: 'eventV2', protocolVersion: 2, event: { ...candidate, kind: 'projection' } }))
    .toBe(false)

  const large = room(candidateLength)
  const revisionBeforeStart = large.runtime.getRevision()
  expect(large.start().result).toMatchObject({ status: 'rejected', error: 'frame_too_large' })
  expect(large.runtime.getRevision()).toBe(revisionBeforeStart)
  expect(large.runtime.snapshotFor('host', 'host-conn')).toMatchObject({
    ok: true, snapshot: { roomState: { phase: 'configuring' }, nextClientSeq: 4 },
  })
})
