import type { GameModule } from './games.types'
import type { GameUsageSnapshot } from './gameUsage.types'

export const emptyGameUsageSnapshot: GameUsageSnapshot = {
  schemaVersion: 1,
  games: {},
}

export function normalizeGameUsageSnapshot(value: unknown): GameUsageSnapshot {
  if (!isGameUsageSnapshot(value)) return emptyGameUsageSnapshot
  return value
}

export function recordGameOpenedInSnapshot(snapshot: GameUsageSnapshot, gameId: string, now = new Date()): GameUsageSnapshot {
  const current = snapshot.games[gameId]
  return {
    schemaVersion: 1,
    games: {
      ...snapshot.games,
      [gameId]: {
        openedCount: (current?.openedCount ?? 0) + 1,
        lastOpenedAt: now.toISOString(),
      },
    },
  }
}

export function getMostPlayedGameId(games: GameModule[], snapshot: GameUsageSnapshot): string | null {
  let mostPlayed: GameModule | null = null

  for (const game of games) {
    if (game.status !== 'available') continue
    const usage = snapshot.games[game.id]
    if (!usage || usage.openedCount <= 0) continue

    if (!mostPlayed) {
      mostPlayed = game
      continue
    }

    const currentUsage = snapshot.games[mostPlayed.id]
    if (!currentUsage) {
      mostPlayed = game
      continue
    }

    if (usage.openedCount > currentUsage.openedCount) {
      mostPlayed = game
      continue
    }

    if (usage.openedCount === currentUsage.openedCount && Date.parse(usage.lastOpenedAt) > Date.parse(currentUsage.lastOpenedAt)) {
      mostPlayed = game
    }
  }

  return mostPlayed?.id ?? null
}

export function getMostRecentlyOpenedGameId(games: GameModule[], snapshot: GameUsageSnapshot): string | null {
  let mostRecentGameId: string | null = null
  let mostRecentTimestamp = Number.NEGATIVE_INFINITY

  for (const game of games) {
    if (game.status !== 'available') continue
    const usage = snapshot.games[game.id]
    if (!usage || usage.openedCount <= 0) continue
    const timestamp = Date.parse(usage.lastOpenedAt)
    if (Number.isNaN(timestamp) || timestamp <= mostRecentTimestamp) continue
    mostRecentGameId = game.id
    mostRecentTimestamp = timestamp
  }

  return mostRecentGameId
}

export function getDiscoverGameId(games: GameModule[], snapshot: GameUsageSnapshot, featuredGameId: string, random = Math.random): string | null {
  const unplayed = games.filter((game) => game.status === 'available' && (snapshot.games[game.id]?.openedCount ?? 0) === 0)
  const preferred = unplayed.filter((game) => game.id !== featuredGameId)
  const candidates = preferred.length > 0 ? preferred : unplayed
  if (candidates.length === 0) return null
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return candidates[index]?.id ?? null
}

function isGameUsageSnapshot(value: unknown): value is GameUsageSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GameUsageSnapshot>
  if (candidate.schemaVersion !== 1 || !candidate.games || typeof candidate.games !== 'object' || Array.isArray(candidate.games)) return false

  return Object.values(candidate.games).every((entry) => (
    !!entry
    && typeof entry === 'object'
    && Number.isInteger((entry as { openedCount?: unknown }).openedCount)
    && typeof (entry as { openedCount: number }).openedCount === 'number'
    && (entry as { openedCount: number }).openedCount >= 0
    && typeof (entry as { lastOpenedAt?: unknown }).lastOpenedAt === 'string'
  ))
}
