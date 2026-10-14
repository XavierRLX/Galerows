import type { RoomSnapshotV2 } from '../../persistentProtocol'

export type LobbyRole = 'host' | 'guest'
export type LobbyGameId = 'toy' | 'counter' | 'impostor-da-palavra' | 'pista-unica' | 'cidade-dorme'

export const lobbyGameCatalog = {
  toy: { title: 'Cartas secretas', subtitle: 'Cada pessoa recebe uma informação só sua.', action: 'Enviar pista',
    icon: 'cards', minPlayers: 2, defaultValue: 2, maxValue: 5, configField: 'rounds', unit: 'rodadas' },
  counter: { title: 'Contagem em equipe', subtitle: 'Avancem juntos até atingir o objetivo.', action: 'Somar 1',
    icon: 'target', minPlayers: 2, defaultValue: 3, maxValue: 20, configField: 'target', unit: 'pontos' },
  'cidade-dorme': { title: 'Cidade Dorme', subtitle: 'Papéis secretos, noite e votação no celular de cada jogador.',
    action: 'Jogar', icon: 'cards', minPlayers: 4, defaultValue: 1, maxValue: 1,
    configField: 'roleOptions', unit: 'papéis' },
  'pista-unica': { title: 'Pista Única', subtitle: 'Cada pessoa escreve sua pista no próprio celular.',
    action: 'Jogar', icon: 'target', minPlayers: 3, defaultValue: 1, maxValue: 1,
    configField: 'categories', unit: 'categorias' },
  'impostor-da-palavra': { title: 'Impostor da Palavra', subtitle: 'Encontre o impostor antes que ele roube a palavra.',
    action: 'Jogar', icon: 'cards', minPlayers: 3, defaultValue: 1, maxValue: 1,
    configField: 'rounds', unit: 'rodada' },
} as const

export function lobbySummary(snapshot: RoomSnapshotV2, role: LobbyRole, ownId: string | null) {
  const state = snapshot.roomState
  const members = state.members.map((member, index) => ({
    ...member,
    label: member.displayName || (member.role === 'host' ? 'Anfitrião' : `Jogador ${String(index + 1).padStart(2, '0')}`),
    isYou: member.playerId === ownId,
  }))
  const connected = members.filter(member => member.connected)
  const dedicatedMayor = state.selectedGameId === 'cidade-dorme'
    && Boolean(state.selectedConfig && typeof state.selectedConfig === 'object'
      && 'conductionMode' in state.selectedConfig && state.selectedConfig.conductionMode === 'mayor')
  const playable = connected.filter(member => !dedicatedMayor || member.role !== 'host')
  const readyCount = playable.filter(member => member.ready).length
  const allReady = playable.length >= 2 && readyCount === playable.length
  const gameId: LobbyGameId | null = state.selectedGameId === 'toy' || state.selectedGameId === 'counter' || state.selectedGameId === 'impostor-da-palavra' || state.selectedGameId === 'pista-unica' || state.selectedGameId === 'cidade-dorme'
    ? state.selectedGameId : null
  const ownMember = members.find(member => member.isYou)
  return {
    members,
    connectedCount: connected.length,
    readyCount,
    readyTargetCount: playable.length,
    dedicatedMayor,
    gameId,
    game: gameId ? lobbyGameCatalog[gameId] : null,
    ownReady: Boolean(ownMember?.ready),
    canReady: Boolean(ownMember?.connected) && (!dedicatedMayor || ownMember?.role !== 'host')
      && (state.phase === 'lobby' || state.phase === 'configuring'),
    canStart: role === 'host' && state.phase === 'configuring' && gameId !== null
      && state.selectedConfig !== null && allReady
      && playable.length >= lobbyGameCatalog[gameId].minPlayers,
    phase: state.phase,
    phaseLabel: state.phase === 'lobby' ? 'Na sala' : state.phase === 'configuring'
      ? 'Preparando a rodada' : state.phase === 'playing' ? 'Partida em andamento' : 'Fim de rodada',
  }
}

export function gameConfig(gameId: LobbyGameId, value: number) {
  if (gameId === 'pista-unica' || gameId === 'cidade-dorme') throw new Error('invalid_config')
  const catalog = lobbyGameCatalog[gameId]
  if (!Number.isSafeInteger(value) || value < 1 || value > catalog.maxValue) throw new Error('invalid_config')
  return { [catalog.configField]: value }
}
