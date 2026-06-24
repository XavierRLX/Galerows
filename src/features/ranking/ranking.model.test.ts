import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import { createCidadeDormeGaleraMatchResult, createIndividualGaleraMatchResult, createTeamGaleraMatchResult, emptyGaleraResultsSnapshot, getGaleraRanking, recordGaleraMatch } from './ranking.model'

const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
  { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', isGuest: false },
  { id: 'guest-session', name: 'Duda', isGuest: true },
]

describe('galera ranking model', () => {
  it('awards individual points by position with ties and guests counting in the field', () => {
    const match = createIndividualGaleraMatchResult({
      matchId: 'match-1',
      gameId: 'top-10',
      gameName: 'Top 10',
      finishedAt: '2026-06-24T12:00:00.000Z',
      entities: participants,
      scores: {
        'ana-session': 10,
        'bia-session': 10,
        'guest-session': 5,
        'caio-session': 0,
      },
    })

    expect(match.awards).toEqual([
      { sourcePlayerId: 'ana', playerName: 'Ana', points: 4, won: true },
      { sourcePlayerId: 'bia', playerName: 'Bia', points: 4, won: true },
      { sourcePlayerId: 'caio', playerName: 'Caio', points: 1, won: false },
    ])
  })

  it('ignores duplicate match registration', () => {
    const match = createIndividualGaleraMatchResult({
      matchId: 'match-1',
      gameId: 'nem-ferrando',
      gameName: 'Nem Ferrando',
      finishedAt: '2026-06-24T12:00:00.000Z',
      entities: participants.slice(0, 2),
      scores: { 'ana-session': 0, 'bia-session': 5 },
      lowerScoreWins: true,
    })

    const once = recordGaleraMatch(emptyGaleraResultsSnapshot, match)
    const twice = recordGaleraMatch(once, match)

    expect(twice.matches).toHaveLength(1)
  })

  it('aggregates ranking by points, wins and current galera players', () => {
    const first = createIndividualGaleraMatchResult({
      matchId: 'match-1',
      gameId: 'impostor-da-palavra',
      gameName: 'Impostor da Palavra',
      finishedAt: '2026-06-24T12:00:00.000Z',
      entities: participants.slice(0, 3),
      scores: { 'ana-session': 2, 'bia-session': 1, 'caio-session': 0 },
    })
    const second = createIndividualGaleraMatchResult({
      matchId: 'match-2',
      gameId: 'taboo',
      gameName: 'Dica Proibida',
      finishedAt: '2026-06-24T13:00:00.000Z',
      entities: participants.slice(0, 2),
      scores: { 'ana-session': 0, 'bia-session': 3 },
    })
    const snapshot = recordGaleraMatch(recordGaleraMatch(emptyGaleraResultsSnapshot, first), second)

    expect(getGaleraRanking(snapshot, [{ id: 'ana', name: 'Ana Maria' }, { id: 'bia', name: 'Bia' }])).toEqual([
      { sourcePlayerId: 'ana', playerName: 'Ana Maria', points: 4, wins: 1, matches: 2, isArchived: false },
      { sourcePlayerId: 'bia', playerName: 'Bia', points: 4, wins: 1, matches: 2, isArchived: false },
    ])
  })

  it('awards team winners by opponent roster size', () => {
    const match = createTeamGaleraMatchResult({
      matchId: 'match-team',
      gameId: 'mimica',
      gameName: 'Mímica',
      finishedAt: '2026-06-24T12:00:00.000Z',
      participants,
      teams: [
        { id: 'team-a', name: 'Time A', memberIds: ['ana-session', 'bia-session'] },
        { id: 'team-b', name: 'Time B', memberIds: ['guest-session', 'caio-session'] },
      ],
      scores: { 'team-a': 3, 'team-b': 1 },
    })

    expect(match.awards).toEqual([
      { sourcePlayerId: 'ana', playerName: 'Ana', points: 2, won: true },
      { sourcePlayerId: 'bia', playerName: 'Bia', points: 2, won: true },
    ])
  })

  it('awards Cidade Dorme winners by winning side', () => {
    const city = createCidadeDormeGaleraMatchResult({
      matchId: 'cidade-1',
      finishedAt: '2026-06-24T12:00:00.000Z',
      winner: 'city',
      players: [
        { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', roleKey: 'citizen' },
        { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', roleKey: 'doctor' },
        { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', roleKey: 'killer' },
        { id: 'guest-session', name: 'Duda', roleKey: 'jester' },
      ],
    })
    const jester = createCidadeDormeGaleraMatchResult({
      matchId: 'cidade-2',
      finishedAt: '2026-06-24T12:00:00.000Z',
      winner: 'jester',
      winnerPlayerId: 'bia-session',
      players: [
        { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', roleKey: 'citizen' },
        { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', roleKey: 'jester' },
        { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', roleKey: 'killer' },
      ],
    })

    expect(city.awards).toEqual([
      { sourcePlayerId: 'ana', playerName: 'Ana', points: 2, won: true },
      { sourcePlayerId: 'bia', playerName: 'Bia', points: 2, won: true },
    ])
    expect(jester.awards).toEqual([{ sourcePlayerId: 'bia', playerName: 'Bia', points: 2, won: true }])
  })
})
