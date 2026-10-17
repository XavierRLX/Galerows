import { shuffle } from '../../lib/utils/shuffle'
import { CIDADE_DORME_MAX_PLAYERS, CIDADE_DORME_MIN_PLAYERS, getJesterCount } from './cidadeDorme.setup'
import type { CidadeDormePlayerInput, GameSettings, ManualVotingOutcome, NightAction, NightResolution, Player, RoleKey, VotingResolution, WinConditionResult } from './cidadeDorme.types'

export function createRoleDeck(settings: GameSettings): RoleKey[] {
  assertSettings(settings)
  const roleDeck: RoleKey[] = ['killer', ...Array.from({ length: settings.killersCount - 1 }, () => 'traitor' as const)]
  if (settings.enableDoctor) roleDeck.push('doctor')
  if (settings.enableDetective) roleDeck.push('detective')
  if (settings.enableWatchman) roleDeck.push('watchman')
  if (settings.enableSleepwalker) roleDeck.push('sleepwalker')
  roleDeck.push(...Array.from({ length: getJesterCount(settings) }, () => 'jester' as const))
  if (roleDeck.length >= settings.playerCount) throw new Error('A composicao precisa preservar pelo menos 1 Cidadao.')
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

/** All surviving members of the killer team, whether active or still dormant. */
export function getAliveKillers(players: readonly Player[]) {
  return getAlivePlayers(players).filter(player => player.roleKey === 'killer' || player.roleKey === 'traitor')
}

/** Immutable succession priority for this GameSession, never exposed in public projections. */
export function getMurderOrder(players: readonly Player[], random: () => number = Math.random): string[] {
  const leader = players.find(player => player.roleKey === 'killer')
  if (!leader) return []
  return [leader.id, ...shuffle(players.filter(player => player.roleKey === 'traitor')
    .map(player => player.id), random)]
}

/** Disconnects never change priority; only player elimination does. */
export function getActiveKiller(players: readonly Player[], priority: readonly string[]): Player | undefined {
  return priority.map(id => players.find(player => player.id === id && player.status === 'alive'))
    .find((player): player is Player => player !== undefined)
}

export function getAliveInnocents(players: readonly Player[]) {
  return getAlivePlayers(players).filter((player) => player.roleKey !== 'killer' && player.roleKey !== 'traitor')
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
  const detectiveResult = detectiveTarget
    ? ((detectiveTarget.roleKey === 'killer' || (detectiveTarget.roleKey === 'traitor' && detectiveTarget.id === action.killerActorId)) ? 'suspect' : 'innocent')
    : undefined
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

/** Movement is calculated from alive identities and active killer at night, never from a simulated turn. */
export function getWatchmanObservation(players: readonly Player[], targetId: string, activeKillerId: string | undefined): 'passed' | 'stayed' {
  const target = players.find(player => player.id === targetId && player.status === 'alive')
  if (!target) return 'stayed'
  return target.id === activeKillerId || target.roleKey === 'doctor' || target.roleKey === 'detective'
    || target.roleKey === 'sleepwalker' ? 'passed' : 'stayed'
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
  if (settings.killersCount > 3) throw new Error('No maximo 2 Traidores.')
  if (!Number.isInteger(getJesterCount(settings)) || getJesterCount(settings) < 0 || getJesterCount(settings) > 2) throw new Error('No maximo 2 Coringas.')
  if (settings.playerCount < 7 && (settings.enableWatchman || settings.enableSleepwalker)) throw new Error('Vigia e Sonambulo exigem pelo menos 7 jogadores.')
  if (settings.killersCount >= settings.playerCount / 2) throw new Error('A equipe assassina nao pode iniciar em paridade.')
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
