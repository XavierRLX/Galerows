import { describe, expect, it } from 'vitest'
import { addPlayer, createPlayerGroup, movePlayer, movePlayerToPosition, removePlayer, renameGroup, renamePlayer, validatePlayerName } from './players.model'

describe('player group model', () => {
  it('creates, edits, reorders, and removes players', () => {
    let group = createPlayerGroup()
    group = addPlayer(group, '  Ana  Maria ')
    group = addPlayer(group, 'Bruno')
    expect(group.players.map((player) => player.name)).toEqual(['Ana Maria', 'Bruno'])
    group = renamePlayer(group, group.players[1].id, 'Bia')
    group = movePlayer(group, group.players[1].id, -1)
    expect(group.players.map((player) => player.name)).toEqual(['Bia', 'Ana Maria'])
    group = addPlayer(group, 'Caio')
    group = movePlayerToPosition(group, group.players[2].id, 0)
    expect(group.players.map((player) => player.name)).toEqual(['Caio', 'Bia', 'Ana Maria'])
    group = removePlayer(group, group.players[0].id)
    group = renameGroup(group, ' Galera de sábado ')
    expect(group.name).toBe('Galera de sábado')
    expect(group.players.map((player) => player.name)).toEqual(['Bia', 'Ana Maria'])
  })

  it('rejects empty and duplicate names ignoring case and spaces', () => {
    const group = addPlayer(createPlayerGroup(), 'Ana Maria')
    expect(validatePlayerName(' ', group.players)).toBe('Informe um nome.')
    expect(validatePlayerName(' ana   maria ', group.players)).toBe('Este nome já está na sua galera.')
  })
})
