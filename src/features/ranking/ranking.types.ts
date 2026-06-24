import type { Player } from '../players/players.types'

export type RankingGameId =
  | 'nem-ferrando'
  | 'impostor-da-palavra'
  | 'top-10'
  | 'mimica'
  | 'taboo'
  | 'cidade-dorme'

export type GaleraMatchAward = {
  sourcePlayerId: string
  playerName: string
  points: number
  won: boolean
}

export type GaleraMatchResult = {
  schemaVersion: 1
  matchId: string
  gameId: RankingGameId
  gameName: string
  finishedAt: string
  participantCount: number
  awards: GaleraMatchAward[]
}

export type GaleraResultsSnapshot = {
  schemaVersion: 1
  matches: GaleraMatchResult[]
}

export type GaleraRankingEntry = {
  sourcePlayerId: string
  playerName: string
  points: number
  wins: number
  matches: number
  isArchived: boolean
}

export type RankedEntity = {
  id: string
  name: string
  sourcePlayerId?: string
}

export type RankedTeam = {
  id: string
  name: string
  memberIds: string[]
}

export type RankingCurrentPlayer = Pick<Player, 'id' | 'name'>
