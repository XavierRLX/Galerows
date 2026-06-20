import { shuffle } from '../../lib/utils/shuffle'
import { CIDADE_DORME_MAX_PLAYERS, CIDADE_DORME_MIN_PLAYERS } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput, GameSettings, ManualVotingOutcome, NightAction, NightResolution, Player, RoleKey, VotingResolution, WinConditionResult } from './cidadeDorme.types'

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

export function canDoctorProtect(doctorId: string, protectedPlayerId: string, settings: GameSettings, previousProtectedPlayerId?: string, selfProtectCount = 0) {
  if (!settings.doctorCanSelfProtect && doctorId === protectedPlayerId) return false
  if (doctorId === protectedPlayerId && settings.doctorSelfProtectLimit !== 'unlimited' && selfProtectCount >= settings.doctorSelfProtectLimit) return false
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

export function resolveVotingOutcome(players: readonly Player[], outcome: ManualVotingOutcome, round: number): VotingResolution {
  if (outcome.kind === 'tie') {
    return { kind: 'tie', round, players: players.map((player) => ({ ...player })) }
  }

  const eliminated = players.find((player) => player.id === outcome.playerId && player.status === 'alive')
  if (!eliminated) return { kind: 'tie', round, players: players.map((player) => ({ ...player })) }

  return {
    kind: 'eliminated',
    round,
    players: players.map((player) => player.id === outcome.playerId ? eliminatePlayer(player, round, 'vote') : { ...player }),
    eliminatedPlayerId: outcome.playerId,
    jesterWinnerPlayerId: eliminated.roleKey === 'jester' ? outcome.playerId : undefined,
  }
}

export function checkWinCondition(players: readonly Player[], _settings: GameSettings): WinConditionResult {
  void _settings
  const votedOutJesters = players.filter((player) => player.roleKey === 'jester' && player.status === 'eliminated' && player.eliminationReason === 'vote')
  if (votedOutJesters[0]) {
    return { isGameOver: true, winner: 'jester', winnerPlayerId: votedOutJesters[0].id, reason: 'jester-voted-out' }
  }

  const aliveKillers = getAliveKillers(players)
  const aliveInnocents = getAliveInnocents(players)
  if (aliveKillers.length === 0) return { isGameOver: true, winner: 'city', reason: 'city-eliminated-killers' }
  if (aliveKillers.length >= aliveInnocents.length) return { isGameOver: true, winner: 'killers', reason: 'killers-parity' }
  return { isGameOver: false, winner: null, reason: 'none' }
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

function comparableName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}
