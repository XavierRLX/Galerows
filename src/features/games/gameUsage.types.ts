export type GameUsageEntry = {
  openedCount: number
  lastOpenedAt: string
}

export type GameUsageSnapshot = {
  schemaVersion: 1
  games: Record<string, GameUsageEntry>
}
