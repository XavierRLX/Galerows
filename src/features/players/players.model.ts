import { createId } from '../../lib/utils/createId'
import type { GameParticipant, Player, PlayerGroup } from './players.types'

export function normalizePlayerName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function comparableName(value: string) {
  return normalizePlayerName(value).toLocaleLowerCase('pt-BR')
}

export function validatePlayerName(value: string, players: Player[], ignoredId?: string): string | null {
  const name = normalizePlayerName(value)
  if (!name) return 'Informe um nome.'
  if (name.length > 32) return 'Use no máximo 32 caracteres.'
  if (players.some((player) => player.id !== ignoredId && comparableName(player.name) === comparableName(name))) {
    return 'Este nome já está na sua galera.'
  }
  return null
}

export function createPlayerGroup(name = 'Minha Galera'): PlayerGroup {
  return { schemaVersion: 1, id: createId('group'), name, players: [], updatedAt: new Date().toISOString() }
}

export function isPlayerGroup(value: unknown): value is PlayerGroup {
  if (typeof value !== 'object' || value === null) return false
  const group = value as Partial<PlayerGroup>
  return group.schemaVersion === 1 && typeof group.id === 'string' && typeof group.name === 'string' && Array.isArray(group.players)
    && group.players.every((player) => typeof player?.id === 'string' && typeof player.name === 'string')
}

export function addPlayer(group: PlayerGroup, rawName: string): PlayerGroup {
  const error = validatePlayerName(rawName, group.players)
  if (error) throw new Error(error)
  return touch(group, [...group.players, { id: createId('player'), name: normalizePlayerName(rawName) }])
}

export function renamePlayer(group: PlayerGroup, playerId: string, rawName: string): PlayerGroup {
  const error = validatePlayerName(rawName, group.players, playerId)
  if (error) throw new Error(error)
  return touch(group, group.players.map((player) => player.id === playerId ? { ...player, name: normalizePlayerName(rawName) } : player))
}

export function removePlayer(group: PlayerGroup, playerId: string): PlayerGroup {
  return touch(group, group.players.filter((player) => player.id !== playerId))
}

export function movePlayer(group: PlayerGroup, playerId: string, direction: -1 | 1): PlayerGroup {
  const currentIndex = group.players.findIndex((player) => player.id === playerId)
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.players.length) return group
  const players = [...group.players]
  ;[players[currentIndex], players[targetIndex]] = [players[targetIndex], players[currentIndex]]
  return touch(group, players)
}

export function renameGroup(group: PlayerGroup, rawName: string): PlayerGroup {
  const name = normalizePlayerName(rawName)
  if (!name) throw new Error('Informe o nome da galera.')
  if (name.length > 40) throw new Error('Use no máximo 40 caracteres.')
  return { ...group, name, updatedAt: new Date().toISOString() }
}

export function playerToParticipant(player: Player): GameParticipant {
  return { id: createId('participant'), name: player.name, sourcePlayerId: player.id, isGuest: false }
}

export function createGuestParticipant(name: string): GameParticipant {
  return { id: createId('participant'), name: normalizePlayerName(name), isGuest: true }
}

function touch(group: PlayerGroup, players: Player[]): PlayerGroup {
  return { ...group, players, updatedAt: new Date().toISOString() }
}
