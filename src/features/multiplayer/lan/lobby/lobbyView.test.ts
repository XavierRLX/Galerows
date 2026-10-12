import { describe, expect, it } from 'vitest'
import { gameConfig, lobbySummary } from './lobbyView'
import type { RoomSnapshotV2 } from '../../persistentProtocol'

function sample(phase: RoomSnapshotV2['roomState']['phase'] = 'configuring'): RoomSnapshotV2 {
  return {
    protocolVersion: 2, roomId: 'room', revision: 7, nextClientSeq: 1,
    privateState: null, gamePublicState: null,
    roomState: {
      hostPlayerId: 'h', phase,
      members: [
        { playerId: 'h', role: 'host', connected: true, ready: true, participation: 'active' },
        { playerId: 'g', role: 'guest', connected: true, ready: true, participation: 'active' },
      ],
      selectedGameId: 'toy', selectedConfig: { rounds: 2 }, currentGameSessionId: null,
      lastPublicResult: null, barriers: [],
    },
  }
}

describe('PL-03 lobby presentation model', () => {
  it('marks own player and calculates explicit host readiness without exposing secrets', () => {
    const host = lobbySummary(sample(), 'host', 'h')
    expect(host.members.map(m => [m.label, m.isYou])).toEqual([
      ['Anfitrião', true], ['Jogador 02', false],
    ])
    expect(host.canStart).toBe(true)
    expect(host.readyCount).toBe(2)
    expect(lobbySummary(sample(), 'guest', 'g').canStart).toBe(false)
  })
  it('prevents start if any connected member is unready or game not configured', () => {
    const notReady = sample()
    notReady.roomState.members = [
      notReady.roomState.members[0], { ...notReady.roomState.members[1], ready: false },
    ]
    expect(lobbySummary(notReady, 'host', 'h').canStart).toBe(false)
    const noGame = sample()
    noGame.roomState.selectedConfig = null
    expect(lobbySummary(noGame, 'host', 'h').canStart).toBe(false)
    expect(lobbySummary(sample('lobby'), 'host', 'h').canStart).toBe(false)
  })
  it('keeps disconnected member visible but not ready, and uses phase-specific CTA', () => {
    const disconnected = sample()
    disconnected.roomState.members = [
      disconnected.roomState.members[0], { ...disconnected.roomState.members[1], connected: false, ready: true },
    ]
    const result = lobbySummary(disconnected, 'host', 'h')
    expect(result.members).toHaveLength(2)
    expect(result.connectedCount).toBe(1)
    expect(result.canStart).toBe(false)
    expect(lobbySummary(sample('results'), 'host', 'h').phaseLabel).toBe('Fim de rodada')
    expect(lobbySummary(sample('playing'), 'guest', 'g').canReady).toBe(false)
  })
  it('validates only synthetic game configurations', () => {
    expect(gameConfig('toy', 2)).toEqual({ rounds: 2 })
    expect(gameConfig('counter', 3)).toEqual({ target: 3 })
    expect(() => gameConfig('counter', 30)).toThrow('invalid_config')
    expect(() => gameConfig('toy', 0)).toThrow('invalid_config')
  })
})
