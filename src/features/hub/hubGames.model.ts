import type { GameModule } from '../games/games.types'

/** Keep the illustrated catalog predictable while respecting a player's own favorites. */
export function orderHubGames(
  games: readonly GameModule[],
  featuredGameId: string,
  favoriteGameIds: readonly string[],
  catalogOrder: readonly string[],
): GameModule[] {
  const rank = new Map([...new Set(catalogOrder)].map((gameId, index) => [gameId, index]))
  const ordered = [...games].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  const priorityIds = [...new Set([featuredGameId, ...favoriteGameIds])]
  const priority = new Set(priorityIds)
  const promoted = priorityIds.flatMap((id) => ordered.filter((game) => game.id === id && game.status === 'available'))
  const remaining = ordered.filter((game) => !priority.has(game.id) || game.status !== 'available')
  return [
    ...promoted,
    ...remaining.filter((game) => game.status === 'available'),
    ...remaining.filter((game) => game.status !== 'available'),
  ]
}

/** Insert full-width ads only after completed rows of two game posters. */
export function shouldInsertHubAdAfterCard(index: number, totalGames: number): boolean {
  return (index + 1) % 4 === 0 && index < totalGames - 1
}
