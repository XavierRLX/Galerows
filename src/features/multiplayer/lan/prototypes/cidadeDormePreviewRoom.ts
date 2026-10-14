import { cidadeDormeLanGame, type CidadeDormeLanPrivate, type CidadeDormeLanPublic } from '../../cidadeDormeLanGame'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../../persistentRoom'
import type { RoomCommandResultV2, RoomSnapshotV2 } from '../../persistentProtocol'

const previewNames = ['Ana', 'Léo', 'Bia', 'Gui', 'Luna', 'Duda', 'Caio', 'Nina', 'Rafa', 'Ivo', 'Maya']

/** Development preview only: commands still pass through the real authoritative City adapter. */
export class CidadeDormePreviewRoom {
  private readonly runtime: AuthoritativeRoomRuntimeV2
  private nextGuest = 0

  constructor() {
    this.runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'cidade-preview', hostPlayerId: 'host',
      hostConnectionId: 'host-conn', adapter: new RoomLifecycleAdapter([cidadeDormeLanGame]),
      createPlayerId: () => `guest-${++this.nextGuest}`, clock: { now: () => 1_000 },
      random: () => 0.35 })
  }

  static name(playerId: string) {
    if (playerId === 'host') return 'Você'
    const index = Number(playerId.replace('guest-', '')) - 1
    return previewNames[index] ?? `Jogador ${index + 2}`
  }

  playerIds() { return this.snapshot('host').roomState.members.map(member => member.playerId) }

  joinNext(): string | null {
    if (this.playerIds().length >= 12) return null
    const index = this.nextGuest + 1
    const joined = this.runtime.joinGuest(`guest-${index}-conn`, previewNames[index - 1])
    return joined.ok ? joined.playerId : null
  }

  snapshot(playerId: string): RoomSnapshotV2 {
    const result = this.runtime.snapshotFor(playerId, this.connection(playerId))
    if (!result.ok) throw new Error(`preview_snapshot_${result.error}`)
    return result.snapshot
  }

  roomCommand(playerId: string, type: string, payload: unknown = null): RoomCommandResultV2 {
    return this.command(playerId, 'room', type, payload)
  }

  gameCommand(playerId: string, type: string, payload: unknown = null): RoomCommandResultV2 {
    return this.command(playerId, 'game', type, payload)
  }

  gameState(): CidadeDormeLanPublic {
    const frame = this.snapshot('host').gamePublicState
    if (frame?.gameId !== 'cidade-dorme') throw new Error('preview_game_not_started')
    return frame.data as CidadeDormeLanPublic
  }

  privateState(playerId: string): CidadeDormeLanPrivate | null {
    const frame = this.snapshot(playerId).privateState
    return frame?.gameId === 'cidade-dorme' ? frame.data as CidadeDormeLanPrivate : null
  }

  simulateCurrentAction(excludePlayerId?: string): boolean {
    const state = this.gameState()
    const type = state.step === 'killer-turn' ? 'KILL'
      : state.step === 'doctor-turn' ? 'PROTECT'
        : state.step === 'detective-turn' ? 'INVESTIGATE' : null
    if (!type) return false
    const actor = this.playerIds().find(id => id !== excludePlayerId && this.privateState(id)?.canAct)
    if (!actor) return false
    const candidates = state.players.filter(player => player.alive && player.id !== actor && (
      type !== 'KILL' || this.privateState(player.id)?.role !== 'killer'))
    for (const target of candidates) {
      if (this.gameCommand(actor, type, { playerId: target.id }).status === 'accepted') return true
    }
    return false
  }

  simulateRemainingVotes(excludePlayerId?: string): number {
    const state = this.gameState()
    if (state.step !== 'voting') return 0
    const target = state.players.find(player => player.alive && this.privateState(player.id)?.role === 'killer')
      ?? state.players.find(player => player.alive)
    if (!target) return 0
    let sent = 0
    for (const player of state.players) {
      if (player.id === excludePlayerId || !player.alive || this.privateState(player.id)?.voted) continue
      if (this.gameCommand(player.id, 'CAST_VOTE', { playerId: target.id }).status === 'accepted') sent++
    }
    return sent
  }

  private command(playerId: string, scope: 'room' | 'game', type: string, payload: unknown): RoomCommandResultV2 {
    const snapshot = this.snapshot(playerId)
    const clientSeq = snapshot.nextClientSeq
    return this.runtime.processCommand({ protocolVersion: 2, scope, roomId: snapshot.roomId,
      playerId, commandId: `preview-${playerId}-${clientSeq}`, clientSeq, type, payload,
      ...(scope === 'game' ? { gameSessionId: snapshot.roomState.currentGameSessionId } : {}) },
    this.connection(playerId)).result
  }

  private connection(playerId: string) { return playerId === 'host' ? 'host-conn' : `${playerId}-conn` }
}
