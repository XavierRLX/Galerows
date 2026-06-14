export type Player = {
  id: string
  name: string
}

export type PlayerGroup = {
  schemaVersion: 1
  id: string
  name: string
  players: Player[]
  updatedAt: string
}

export type GameParticipant = {
  id: string
  name: string
  sourcePlayerId?: string
  isGuest: boolean
}
