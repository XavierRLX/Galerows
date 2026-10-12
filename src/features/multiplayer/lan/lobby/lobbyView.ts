import type { RoomSnapshotV2 } from '../../persistentProtocol'

export type LobbyRole = 'host' | 'guest'
export type LobbyGameId = 'toy' | 'counter'

export const lobbyGameCatalog = {
  toy: { title: 'Cartas secretas', subtitle: 'Cada pessoa recebe uma informação só sua.', action: 'Enviar pista',
    icon: 'cards', minPlayers: 2, defaultValue: 2, maxValue: 5, configField: 'rounds', unit: 'rodadas' },
  counter: { title: 'Contagem em equipe', subtitle: 'Avancem juntos até atingir o objetivo.', action: 'Somar 1',
    icon: 'target', minPlayers: 2, defaultValue: 3, maxValue: 20, configField: 'target', unit: 'pontos' },
} as const

export function lobbySummary(snapshot: RoomSnapshotV2, role: LobbyRole, ownId: string | null) {
  const state = snapshot.roomState
  const members = state.members.map((member, index) => ({
    ...member,
    label: member.displayName || (member.role === 'host' ? 'Anfitrião' : `Jogador ${String(index + 1).padStart(2, '0')}`),
    isYou: member.playerId === ownId,
  }))
  const connected = members.filter(member => member.connected)
  const readyCount = connected.filter(member => member.ready).length
  const allReady = connected.length >= 2 && readyCount === connected.length
  const gameId: LobbyGameId | null = state.selectedGameId === 'toy' || state.selectedGameId === 'counter'
    ? state.selectedGameId : null
  const ownMember = members.find(member => member.isYou)
  return {
    members,
    connectedCount: connected.length,
    readyCount,
    gameId,
    game: gameId ? lobbyGameCatalog[gameId] : null,
    ownReady: Boolean(ownMember?.ready),
    canReady: Boolean(ownMember?.connected) && (state.phase === 'lobby' || state.phase === 'configuring'),
    canStart: role === 'host' && state.phase === 'configuring' && gameId !== null
      && state.selectedConfig !== null && allReady,
    phase: state.phase,
    phaseLabel: state.phase === 'lobby' ? 'Na sala' : state.phase === 'configuring'
      ? 'Preparando a rodada' : state.phase === 'playing' ? 'Partida em andamento' : 'Fim de rodada',
  }
}

export function gameConfig(gameId: LobbyGameId, value: number) {
  const catalog = lobbyGameCatalog[gameId]
  if (!Number.isSafeInteger(value) || value < 1 || value > catalog.maxValue) throw new Error('invalid_config')
  return { [catalog.configField]: value }
}
