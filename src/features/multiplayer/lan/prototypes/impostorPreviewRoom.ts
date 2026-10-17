// Development/test harness only. Uses the existing authority in memory, without WSS.
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../../persistentRoom'
import { impostorLanGame, type ImpostorLanConfig, type ImpostorLanPrivate, type ImpostorLanPublic } from '../../impostorLanGame'
import type { RoomCommandV2 } from '../../persistentProtocol'

export function createImpostorPreviewRoom(count = 6, config: ImpostorLanConfig = {
  impostorMode: 'no-word', conversationMode: 'guided-questions', flow: 'individual-vote', timerSeconds: 120, scoringMode: 'individual',
}) {
  let serial = 0
  const runtime = new AuthoritativeRoomRuntimeV2({
    roomId: 'preview-impostor', hostPlayerId: 'host', hostConnectionId: 'host-connection',
    adapter: new RoomLifecycleAdapter([impostorLanGame]),
    createPlayerId: () => `guest-${++serial}`, random: () => .15, clock: { now: () => Date.now() },
  })
  const players = [{ id: 'host', conn: 'host-connection' }]
  for (let i = 1; i < count; i++) {
    const conn = `connection-${i}`
    const joined = runtime.joinGuest(conn)
    if (!joined.ok) throw new Error('Preview join failed')
    players.push({ id: joined.playerId, conn })
  }
  function view(index = 0) {
    const actor = players[index]
    const result = runtime.snapshotFor(actor.id, actor.conn)
    if (!result.ok) throw new Error(`Preview snapshot failed: ${result.error}`)
    return result.snapshot
  }
  function send(index: number, type: string, payload: unknown = null, scope: 'room' | 'game' = 'game') {
    const snapshot = view(index)
    const input: RoomCommandV2 = {
      protocolVersion: 2, roomId: snapshot.roomId, playerId: players[index].id,
      clientSeq: snapshot.nextClientSeq, commandId: crypto.randomUUID(), type, payload, scope,
      ...(scope === 'game' ? { gameSessionId: snapshot.roomState.currentGameSessionId! } : {}),
    }
    const result = runtime.processCommand(input, players[index].conn)
    if (result.result.status !== 'accepted') throw new Error(`Preview command rejected: ${type}`)
  }
  const names = ['Renan', 'Ana', 'Léo', 'Bia', 'Gui', 'Lu', 'Mariana Albuquerque', 'Pedro', 'Rafa', 'João', 'Fernanda', 'Gabriel']
  players.forEach((_, i) => send(i, 'SET_DISPLAY_NAME', { name: names[i] }, 'room'))
  send(0, 'SELECT_GAME', { gameId: 'impostor-da-palavra' }, 'room')
  send(0, 'CONFIGURE_GAME', config, 'room')
  players.forEach((_, i) => send(i, 'READY', { ready: true }, 'room'))
  send(0, 'START_GAME', null, 'room')
  const publicState = () => view().gamePublicState!.data as ImpostorLanPublic
  const privateState = (index: number) => view(index).privateState!.data as ImpostorLanPrivate
  return { players, view, send, publicState, privateState }
}
