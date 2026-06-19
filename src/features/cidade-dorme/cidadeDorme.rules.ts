import { shuffle } from '../../lib/utils/shuffle'
import { CIDADE_DORME_MAX_PLAYERS, CIDADE_DORME_MIN_PLAYERS } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput, GameSettings, NightAction, NightResolution, Player, RoleKey, Vote, VoteTargetId, VotingResolution, WinConditionResult } from './cidadeDorme.types'

export function createRoleDeck(settings: GameSettings): RoleKey[] {
  assertSettings(settings)
  const roleDeck: RoleKey[] = Array.from({ length: settings.killersCount }, () => 'killer')
  if (settings.enableDoctor) roleDeck.push('doctor')
  if (settings.enableDetective) roleDeck.push('detective')
  if (settings.enableJester) roleDeck.push('jester')
  if (roleDeck.length > settings.playerCount) throw new Error('A composicao de papeis excede a quantidade de jogadores.')
  return [...roleDeck, ...Array.from({ length: settings.playerCount - roleDeck.length }, () => 'citizen' as const)]
}

export function assignRolesToPlayers(players: readonly CidadeDormePlayerInput[], settings: GameSettings, random: () => number = Math.random): Player[] {
  const errors = getStartGameErrors(players, settings)
  if (errors.length) throw new Error(errors[0])
  const shuffledRoles = shuffle(createRoleDeck(settings), random)
  return players.map((player, index) => ({
    ...player,
    roleKey: shuffledRoles[index] ?? null,
    status: 'alive',
  }))
}

export function canStartGame(players: readonly CidadeDormePlayerInput[], settings: GameSettings) {
  return getStartGameErrors(players, settings).length === 0
}

export function getStartGameErrors(players: readonly CidadeDormePlayerInput[], settings: GameSettings): string[] {
  const errors: string[] = []
  if (players.length < CIDADE_DORME_MIN_PLAYERS || players.length > CIDADE_DORME_MAX_PLAYERS) errors.push('Cidade Dorme exige entre 4 e 12 jogadores.')
  if (settings.playerCount !== players.length) errors.push('A quantidade configurada precisa bater com a lista de jogadores.')
  if (new Set(players.map((player) => player.id)).size !== players.length) errors.push('Os jogadores precisam ter IDs unicos.')
  if (new Set(players.map((player) => comparableName(player.name))).size !== players.length) errors.push('Os jogadores precisam ter nomes diferentes.')
  try {
    createRoleDeck(settings)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'A configuracao de papeis e invalida.')
  }
  return errors
}

export function getAlivePlayers(players: readonly Player[]) {
  return players.filter((player) => player.status === 'alive')
}

export function getAliveKillers(players: readonly Player[]) {
  return getAlivePlayers(players).filter((player) => player.roleKey === 'killer')
}

export function getAliveInnocents(players: readonly Player[]) {
  return getAlivePlayers(players).filter((player) => player.roleKey !== 'killer')
}

export function canDoctorProtect(doctorId: string, protectedPlayerId: string, settings: GameSettings, previousProtectedPlayerId?: string) {
  if (!settings.doctorCanSelfProtect && doctorId === protectedPlayerId) return false
  if (!settings.doctorCanRepeatProtection && previousProtectedPlayerId === protectedPlayerId) return false
  return true
}

export function resolveNight(players: readonly Player[], action: NightAction): NightResolution {
  const killerTarget = findAlivePlayer(players, action.killerTargetId)
  const protectedPlayer = findAlivePlayer(players, action.protectedPlayerId)
  const detectiveTarget = findAlivePlayer(players, action.detectiveTargetId)
  const wasProtected = Boolean(killerTarget && protectedPlayer && killerTarget.id === protectedPlayer.id)
  const eliminatedPlayerId = killerTarget && !wasProtected ? killerTarget.id : undefined
  const detectiveResult = detectiveTarget ? (detectiveTarget.roleKey === 'killer' ? 'suspect' : 'innocent') : undefined
  return {
    players: players.map((player) => eliminatedPlayerId === player.id ? eliminatePlayer(player, action.round, 'night') : { ...player }),
    action: {
      ...action,
      detectiveResult,
      eliminatedPlayerId,
      wasProtected,
    },
  }
}

export function resolveVoting(players: readonly Player[], votes: readonly Vote[], settings: GameSettings, round: number): VotingResolution {
  const alivePlayerIds = new Set(getAlivePlayers(players).map((player) => player.id))
  const validVotes = votes.filter((vote) => alivePlayerIds.has(vote.voterId) && isValidVoteTarget(vote.targetId, alivePlayerIds, settings.allowSkipVote))
  const tally = tallyVotes(validVotes)
  const entries = Object.entries(tally) as [VoteTargetId, number][]
  if (!entries.length) return { kind: 'noVotes', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })) }

  const highestVotes = Math.max(...entries.map(([, count]) => count))
  const topTargets = entries.filter(([, count]) => count === highestVotes).map(([targetId]) => targetId)
  if (topTargets.length > 1) {
    if (settings.tieRule === 'revoteTied') return { kind: 'revote', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })), tiedTargetIds: topTargets }
    if (settings.tieRule === 'mediatorDecision') return { kind: 'mediatorDecision', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })), tiedTargetIds: topTargets }
    return { kind: 'tie', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })), tiedTargetIds: topTargets }
  }

  const [targetId] = topTargets
  if (!targetId || targetId === 'skip') return { kind: 'skipped', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })) }

  const eliminated = players.find((player) => player.id === targetId && player.status === 'alive')
  if (!eliminated) return { kind: 'noVotes', round, votes: validVotes, tally, players: players.map((player) => ({ ...player })) }

  return {
    kind: 'eliminated',
    round,
    votes: validVotes,
    tally,
    players: players.map((player) => player.id === targetId ? eliminatePlayer(player, round, 'vote') : { ...player }),
    eliminatedPlayerId: targetId,
    jesterWinnerPlayerId: eliminated.roleKey === 'jester' ? targetId : undefined,
  }
}

export function resolveMediatorDecisionVoting(players: readonly Player[], votes: readonly Vote[], settings: GameSettings, round: number, chosenTargetId: VoteTargetId): VotingResolution {
  const preview = resolveVoting(players, votes, settings, round)
  if (preview.kind !== 'mediatorDecision') return preview
  if (!preview.tiedTargetIds?.includes(chosenTargetId)) return preview
  if (chosenTargetId === 'skip') return { ...preview, kind: 'skipped' }

  const eliminated = preview.players.find((player) => player.id === chosenTargetId && player.status === 'alive')
  if (!eliminated) return preview

  return {
    ...preview,
    kind: 'eliminated',
    players: preview.players.map((player) => player.id === chosenTargetId ? eliminatePlayer(player, round, 'vote') : { ...player }),
    eliminatedPlayerId: chosenTargetId,
    jesterWinnerPlayerId: eliminated.roleKey === 'jester' ? chosenTargetId : undefined,
  }
}

export function checkWinCondition(players: readonly Player[], settings: GameSettings): WinConditionResult {
  const votedOutJesters = players.filter((player) => player.roleKey === 'jester' && player.status === 'eliminated' && player.eliminationReason === 'vote')
  const parallelWinners = settings.jesterWinMode === 'parallel' ? votedOutJesters.map((player) => ({ winner: 'jester' as const, playerId: player.id })) : []
  if (settings.jesterWinMode === 'instant' && votedOutJesters[0]) {
    return { isGameOver: true, winner: 'jester', winnerPlayerId: votedOutJesters[0].id, parallelWinners: [], reason: 'jester-voted-out' }
  }

  const aliveKillers = getAliveKillers(players)
  const aliveInnocents = getAliveInnocents(players)
  if (aliveKillers.length === 0) return { isGameOver: true, winner: 'city', parallelWinners, reason: 'city-eliminated-killers' }
  if (aliveKillers.length >= aliveInnocents.length) return { isGameOver: true, winner: 'killers', parallelWinners, reason: 'killers-parity' }
  return { isGameOver: false, winner: null, parallelWinners, reason: 'none' }
}

function assertSettings(settings: GameSettings) {
  if (!Number.isInteger(settings.playerCount) || settings.playerCount < CIDADE_DORME_MIN_PLAYERS || settings.playerCount > CIDADE_DORME_MAX_PLAYERS) throw new Error('Cidade Dorme exige entre 4 e 12 jogadores.')
  if (!Number.isInteger(settings.killersCount) || settings.killersCount < 1) throw new Error('A partida precisa ter pelo menos 1 assassino.')
  if (settings.killersCount >= settings.playerCount) throw new Error('A partida precisa ter jogadores inocentes.')
}

function findAlivePlayer(players: readonly Player[], playerId: string | undefined) {
  if (!playerId) return null
  return players.find((player) => player.id === playerId && player.status === 'alive') ?? null
}

function eliminatePlayer(player: Player, round: number, eliminationReason: Player['eliminationReason']): Player {
  return { ...player, status: 'eliminated', eliminatedAtRound: round, eliminationReason }
}

function isValidVoteTarget(targetId: VoteTargetId, alivePlayerIds: Set<string>, allowSkipVote: boolean) {
  if (targetId === 'skip') return allowSkipVote
  return alivePlayerIds.has(targetId)
}

function tallyVotes(votes: readonly Vote[]) {
  return votes.reduce<Record<VoteTargetId, number>>((tally, vote) => {
    tally[vote.targetId] = (tally[vote.targetId] ?? 0) + 1
    return tally
  }, {})
}

function comparableName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}
