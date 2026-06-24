import type { GameParticipant } from '../players/players.types'
import type { GaleraMatchAward, GaleraMatchResult, GaleraRankingEntry, GaleraResultsSnapshot, RankedEntity, RankedTeam, RankingCurrentPlayer, RankingGameId } from './ranking.types'

export const emptyGaleraResultsSnapshot: GaleraResultsSnapshot = {
  schemaVersion: 1,
  matches: [],
}

export function normalizeGaleraResultsSnapshot(value: unknown): GaleraResultsSnapshot {
  if (!isGaleraResultsSnapshot(value)) return emptyGaleraResultsSnapshot
  return {
    schemaVersion: 1,
    matches: value.matches.filter((match) => match.awards.length > 0),
  }
}

export function recordGaleraMatch(snapshot: GaleraResultsSnapshot, match: GaleraMatchResult): GaleraResultsSnapshot {
  if (match.awards.length === 0) return snapshot
  if (snapshot.matches.some((item) => item.matchId === match.matchId)) return snapshot
  return { schemaVersion: 1, matches: [match, ...snapshot.matches] }
}

export function clearGaleraResults(): GaleraResultsSnapshot {
  return emptyGaleraResultsSnapshot
}

export function getRecentGaleraMatches(snapshot: GaleraResultsSnapshot, limit = 5) {
  return [...snapshot.matches]
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    .slice(0, limit)
}

export function getGaleraRanking(snapshot: GaleraResultsSnapshot, currentPlayers?: RankingCurrentPlayer[]): GaleraRankingEntry[] {
  const totals = new Map<string, GaleraRankingEntry>()
  const currentById = new Map((currentPlayers ?? []).map((player) => [player.id, player]))

  for (const player of currentPlayers ?? []) {
    totals.set(player.id, { sourcePlayerId: player.id, playerName: player.name, points: 0, wins: 0, matches: 0, isArchived: false })
  }

  for (const match of snapshot.matches) {
    const seenInMatch = new Set<string>()
    for (const award of match.awards) {
      const current = currentById.get(award.sourcePlayerId)
      const entry = totals.get(award.sourcePlayerId) ?? {
        sourcePlayerId: award.sourcePlayerId,
        playerName: current?.name ?? award.playerName,
        points: 0,
        wins: 0,
        matches: 0,
        isArchived: !current,
      }
      entry.playerName = current?.name ?? entry.playerName
      entry.points += award.points
      if (award.won) entry.wins += 1
      if (!seenInMatch.has(award.sourcePlayerId)) {
        entry.matches += 1
        seenInMatch.add(award.sourcePlayerId)
      }
      entry.isArchived = !currentById.has(award.sourcePlayerId)
      totals.set(award.sourcePlayerId, entry)
    }
  }

  const entries = [...totals.values()]
  const currentEntries = currentPlayers ? entries.filter((entry) => !entry.isArchived) : entries
  return currentEntries.sort((a, b) => b.points - a.points || b.wins - a.wins || b.matches - a.matches || a.playerName.localeCompare(b.playerName, 'pt-BR'))
}

export function createIndividualGaleraMatchResult(args: {
  matchId: string
  gameId: RankingGameId
  gameName: string
  finishedAt: string
  entities: RankedEntity[]
  scores: Record<string, number>
  lowerScoreWins?: boolean
}): GaleraMatchResult {
  const sorted = [...args.entities].sort((a, b) => {
    const left = args.scores[a.id] ?? 0
    const right = args.scores[b.id] ?? 0
    return args.lowerScoreWins ? left - right : right - left
  })
  const awards = awardByPosition(sorted, args.scores, Boolean(args.lowerScoreWins))
  return createMatchResult(args, args.entities.length, awards)
}

export function createTeamGaleraMatchResult(args: {
  matchId: string
  gameId: RankingGameId
  gameName: string
  finishedAt: string
  participants: GameParticipant[]
  teams: RankedTeam[]
  scores: Record<string, number>
}): GaleraMatchResult {
  const topScore = Math.max(...args.teams.map((team) => args.scores[team.id] ?? 0))
  const winners = args.teams.filter((team) => (args.scores[team.id] ?? 0) === topScore)
  const participantsById = new Map(args.participants.map((participant) => [participant.id, participant]))
  const awards = winners.flatMap((team) => {
    const opponentCount = args.teams
      .filter((other) => other.id !== team.id)
      .reduce((total, other) => total + other.memberIds.length, 0)
    return team.memberIds
      .map((participantId) => participantsById.get(participantId))
      .filter((participant): participant is GameParticipant => Boolean(participant?.sourcePlayerId))
      .map((participant) => createAward(participant.sourcePlayerId!, participant.name, opponentCount, true))
  })
  return createMatchResult(args, args.participants.length, awards)
}

export function createCidadeDormeGaleraMatchResult(args: {
  matchId: string
  finishedAt: string
  players: Array<RankedEntity & { roleKey: string | null }>
  winner?: 'city' | 'killers' | 'jester'
  winnerPlayerId?: string
}): GaleraMatchResult {
  const awards: GaleraMatchAward[] = []
  if (args.winner === 'city') {
    const winners = args.players.filter((player) => player.roleKey !== 'killer' && player.roleKey !== 'jester')
    const points = args.players.length - winners.length
    awards.push(...winners.filter(hasSourcePlayer).map((player) => createAward(player.sourcePlayerId, player.name, points, true)))
  } else if (args.winner === 'killers') {
    const winners = args.players.filter((player) => player.roleKey === 'killer')
    const points = args.players.length - winners.length
    awards.push(...winners.filter(hasSourcePlayer).map((player) => createAward(player.sourcePlayerId, player.name, points, true)))
  } else if (args.winner === 'jester') {
    const winner = args.players.find((player) => player.id === args.winnerPlayerId)
    if (winner?.sourcePlayerId) awards.push(createAward(winner.sourcePlayerId, winner.name, Math.max(0, args.players.length - 1), true))
  }
  return createMatchResult({
    matchId: args.matchId,
    gameId: 'cidade-dorme',
    gameName: 'Cidade Dorme',
    finishedAt: args.finishedAt,
  }, args.players.length, awards)
}

function awardByPosition(entities: RankedEntity[], scores: Record<string, number>, lowerScoreWins: boolean): GaleraMatchAward[] {
  let rankIndex = 0
  let previousScore: number | null = null
  return entities.flatMap((entity, index) => {
    const score = scores[entity.id] ?? 0
    if (previousScore === null || score !== previousScore) rankIndex = index
    previousScore = score
    if (!entity.sourcePlayerId) return []
    const points = Math.max(1, entities.length - rankIndex)
    const bestScore = scores[entities[0]?.id ?? ''] ?? 0
    const won = lowerScoreWins ? score === bestScore : score === bestScore
    return [createAward(entity.sourcePlayerId, entity.name, points, won)]
  })
}

function createMatchResult(args: { matchId: string; gameId: RankingGameId; gameName: string; finishedAt: string }, participantCount: number, awards: GaleraMatchAward[]): GaleraMatchResult {
  return {
    schemaVersion: 1,
    matchId: args.matchId,
    gameId: args.gameId,
    gameName: args.gameName,
    finishedAt: args.finishedAt,
    participantCount,
    awards,
  }
}

function createAward(sourcePlayerId: string, playerName: string, points: number, won: boolean): GaleraMatchAward {
  return { sourcePlayerId, playerName, points, won }
}

function hasSourcePlayer<T extends { sourcePlayerId?: string }>(value: T): value is T & { sourcePlayerId: string } {
  return typeof value.sourcePlayerId === 'string'
}

function isGaleraResultsSnapshot(value: unknown): value is GaleraResultsSnapshot {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1 && Array.isArray(value.matches) && value.matches.every(isGaleraMatchResult)
}

function isGaleraMatchResult(value: unknown): value is GaleraMatchResult {
  if (!isRecord(value)) return false
  const participantCount = value.participantCount
  return value.schemaVersion === 1
    && typeof value.matchId === 'string'
    && typeof value.gameId === 'string'
    && typeof value.gameName === 'string'
    && typeof value.finishedAt === 'string'
    && Number.isInteger(participantCount)
    && typeof participantCount === 'number'
    && participantCount >= 0
    && Array.isArray(value.awards)
    && value.awards.every(isGaleraMatchAward)
}

function isGaleraMatchAward(value: unknown): value is GaleraMatchAward {
  return isRecord(value)
    && typeof value.sourcePlayerId === 'string'
    && typeof value.playerName === 'string'
    && typeof value.points === 'number'
    && Number.isFinite(value.points)
    && value.points >= 0
    && typeof value.won === 'boolean'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
