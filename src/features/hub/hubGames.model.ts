import type { GameModule } from '../games/games.types'

export function orderHubGames(
  games: readonly GameModule[],
  featuredGameId: string,
  favoriteGameIds: readonly string[],
  discoverGameId: string | null,
  sessionOrder: readonly string[],
): GameModule[] {
  const rank = new Map(sessionOrder.map((gameId, index) => [gameId, index]))
  const ordered = [...games].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  const priorityIds = [...new Set([featuredGameId, ...favoriteGameIds, discoverGameId].filter((id): id is string => Boolean(id)))]
  const priority = new Set(priorityIds)
  const remaining = ordered.filter((game) => !priority.has(game.id))
  return [
    ...priorityIds.flatMap((id) => ordered.filter((game) => game.id === id)),
    ...remaining.filter((game) => game.status !== 'coming-soon'),
    ...remaining.filter((game) => game.status === 'coming-soon'),
  ]
}
