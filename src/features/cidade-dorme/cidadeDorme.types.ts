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
  | 'voteResolution'
  | 'gameOver'

export type PlayerStatus = 'alive' | 'eliminated'
export type RoleTeam = 'city' | 'killers' | 'neutral'
export type EliminationReason = 'night' | 'vote' | 'jester' | 'none'
export type TieRule = 'noElimination' | 'revoteTied' | 'mediatorDecision'
export type JesterWinMode = 'instant' | 'parallel'
export type DetectiveResult = 'suspect' | 'innocent'
export type VoteTargetId = string | 'skip'
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
  allowSkipVote: boolean
  tieRule: TieRule
  doctorCanSelfProtect: boolean
  doctorCanRepeatProtection: boolean
  jesterWinMode: JesterWinMode
  discussionTimerSeconds?: number
  votingTimerSeconds?: number
  themeId: string
}

export type NightAction = {
  round: number
  killerTargetId?: string
  protectedPlayerId?: string
  detectiveTargetId?: string
  detectiveResult?: DetectiveResult
  eliminatedPlayerId?: string
  wasProtected?: boolean
}

export type Vote = {
  voterId: string
  targetId: VoteTargetId
}

export type VotingResolutionKind = 'eliminated' | 'skipped' | 'tie' | 'revote' | 'mediatorDecision' | 'noVotes'

export type VotingResolution = {
  kind: VotingResolutionKind
  round: number
  votes: Vote[]
  tally: Record<VoteTargetId, number>
  players: Player[]
  eliminatedPlayerId?: string
  tiedTargetIds?: VoteTargetId[]
  jesterWinnerPlayerId?: string
}

export type NightResolution = {
  players: Player[]
  action: NightAction
}

export type ParallelWinner = {
  winner: 'jester'
  playerId: string
}

export type WinConditionResult = {
  isGameOver: boolean
  winner: GameWinner | null
  winnerPlayerId?: string
  parallelWinners: ParallelWinner[]
  reason: WinReason
}

export type RoundHistory = {
  round: number
  nightAction: NightAction
  votes: Vote[]
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
  currentVotes: Vote[]
  history: RoundHistory[]
  parallelWinners?: ParallelWinner[]
  winner?: GameWinner
  winnerPlayerId?: string
  createdAt: string
  updatedAt: string
}
