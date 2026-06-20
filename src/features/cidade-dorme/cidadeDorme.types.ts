export type RoleKey = 'citizen' | 'killer' | 'detective' | 'doctor' | 'jester'

export type GamePhase =
  | 'setup'
  | 'revealRoles'
  | 'nightIntro'
  | 'killerTurn'
  | 'doctorTurn'
  | 'detectiveTurn'
  | 'nightResolution'
  | 'dayDiscussion'
  | 'voting'
  | 'gameOver'

export type PlayerStatus = 'alive' | 'eliminated'
export type RoleTeam = 'city' | 'killers' | 'neutral'
export type EliminationReason = 'night' | 'vote' | 'jester' | 'none'
export type DoctorSelfProtectLimit = 1 | 2 | 3 | 'unlimited'
export type DetectiveResult = 'suspect' | 'innocent'
export type GameWinner = 'city' | 'killers' | 'jester'
export type WinReason = 'city-eliminated-killers' | 'killers-parity' | 'jester-voted-out' | 'none'

export type CidadeDormePlayerInput = {
  id: string
  name: string
  sourcePlayerId?: string
  isGuest?: boolean
}

export type Player = CidadeDormePlayerInput & {
  roleKey: RoleKey | null
  status: PlayerStatus
  eliminatedAtRound?: number
  eliminationReason?: EliminationReason
}

export type RoleDefinition = {
  key: RoleKey
  name: string
  shortDescription: string
  objective: string
  wakesAtNight: boolean
  nightOrder?: number
  team: RoleTeam
}

export type GameSettings = {
  playerCount: number
  killersCount: number
  enableDoctor: boolean
  enableDetective: boolean
  enableJester: boolean
  revealRoleOnDeath: boolean
  doctorCanSelfProtect: boolean
  doctorSelfProtectLimit: DoctorSelfProtectLimit
  doctorCanRepeatProtection: boolean
  discussionTimerSeconds?: number
  votingTimerSeconds?: number
  themeId: string
}

export type NightAction = {
  round: number
  killerActorId?: string
  killerTargetId?: string
  protectedPlayerId?: string
  detectiveTargetId?: string
  detectiveResult?: DetectiveResult
  eliminatedPlayerId?: string
  wasProtected?: boolean
}

export type ManualVotingOutcome =
  | { kind: 'eliminated'; playerId: string }
  | { kind: 'tie' }

export type VotingResolutionKind = ManualVotingOutcome['kind']

export type VotingResolution = {
  kind: VotingResolutionKind
  round: number
  players: Player[]
  eliminatedPlayerId?: string
  jesterWinnerPlayerId?: string
}

export type VotingHistoryResult = {
  kind: VotingResolutionKind
  eliminatedPlayerId?: string
  jesterWinnerPlayerId?: string
}

export type NightResolution = {
  players: Player[]
  action: NightAction
}

export type WinConditionResult = {
  isGameOver: boolean
  winner: GameWinner | null
  winnerPlayerId?: string
  reason: WinReason
}

export type RoundHistory = {
  round: number
  nightAction: NightAction
  votingResult?: VotingHistoryResult
  eliminatedByVoteId?: string
  notes?: string[]
}

export type GameState = {
  schemaVersion: 1
  id: string
  gameId: 'cidade-dorme'
  phase: GamePhase
  round: number
  players: Player[]
  settings: GameSettings
  currentRevealIndex: number
  currentNightAction: NightAction
  history: RoundHistory[]
  winner?: GameWinner
  winnerPlayerId?: string
  createdAt: string
  updatedAt: string
}
