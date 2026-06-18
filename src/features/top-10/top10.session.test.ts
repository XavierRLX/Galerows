import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import type { Top10Deck } from './content/top10Content.types'
import { buildReusableCardQueue, buildTop10MediatorQueue, continueAfterTop10Summary, createTop10Session, endTop10Card, getEligibleTop10ScoringEntities, getTop10Winners, revealTop10Answer } from './top10.session'
import type { Top10Team } from './top10.types'

const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
  { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', isGuest: false },
]
const teams: Top10Team[] = [
  { id: 'team-a', name: 'Time A' },
  { id: 'team-b', name: 'Time B' },
]
const deck: Top10Deck = {
  schemaVersion: 1,
  gameId: 'top-10',
  deckId: 'test',
  locale: 'pt-BR',
  version: 1,
  title: 'Teste',
  cards: [1, 2, 3].map((id) => ({
    id,
    theme: `Tema ${id}`,
    question: `Pergunta ${id}?`,
    answers: Array.from({ length: 10 }, (_, index) => ({ rank: index + 1 as 1, label: `Resposta ${id}-${index + 1}` })),
  })),
}
const noShuffle = () => 0

describe('Top 10 session', () => {
  it('creates individual and team matches', () => {
    const individual = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[0].id }, deck, noShuffle)
    expect(individual.phase).toBe('playing')
    expect(individual.schemaVersion).toBe(2)
    expect(Object.keys(individual.scores)).toEqual(participants.map((participant) => participant.id))
    expect(individual.mediatorQueue).toEqual(participants.map((participant) => participant.id))

    const teamSession = createTop10Session([], teams, { mode: 'teams', roundsPerEntity: 1, firstMediatorId: teams[1].id }, deck, noShuffle)
    expect(Object.keys(teamSession.scores)).toEqual(teams.map((team) => team.id))
    expect(teamSession.mediatorQueue).toEqual([teams[1].id, teams[0].id])
    expect(teamSession.cardQueue).toHaveLength(2)
  })

  it('scores rank 1 as 10 points and rank 10 as 1 point', () => {
    let session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[2].id }, deck, noShuffle)
    session = revealTop10Answer(session, 1, deck, participants[0].id)
    session = revealTop10Answer(session, 10, deck, participants[1].id)
    expect(session.scores[participants[0].id]).toBe(10)
    expect(session.scores[participants[1].id]).toBe(1)
  })

  it('does not score the same answer twice', () => {
    let session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[2].id }, deck, noShuffle)
    session = revealTop10Answer(session, 1, deck, participants[0].id)
    session = revealTop10Answer(session, 1, deck, participants[1].id)
    expect(session.scores[participants[0].id]).toBe(10)
    expect(session.scores[participants[1].id]).toBe(0)
  })

  it('reveals without scoring', () => {
    let session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[0].id }, deck, noShuffle)
    session = revealTop10Answer(session, 3, deck, null)
    expect(session.revealedAnswers['3'].points).toBe(0)
    expect(session.scores[participants[0].id]).toBe(0)
  })

  it('prevents scoring the current mediator', () => {
    let session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[0].id }, deck, noShuffle)
    expect(getEligibleTop10ScoringEntities(session).map((entity) => entity.id)).toEqual([participants[1].id, participants[2].id])
    session = revealTop10Answer(session, 1, deck, participants[0].id)
    expect(session.scores[participants[0].id]).toBe(0)
    expect(session.revealedAnswers['1']).toBeUndefined()
  })

  it('builds balanced mediator queues and reusable card queues', () => {
    expect(buildTop10MediatorQueue(participants, participants[1].id, 2)).toEqual([
      participants[1].id,
      participants[2].id,
      participants[0].id,
      participants[1].id,
      participants[2].id,
      participants[0].id,
    ])
    expect(buildReusableCardQueue(deck, 5, noShuffle)).toHaveLength(5)
  })

  it('ends cards manually and advances mediator and card until finished', () => {
    let session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[0].id }, deck, noShuffle)
    session = endTop10Card(session, deck)
    expect(session.phase).toBe('round-summary')
    expect(session.history).toHaveLength(1)
    expect(session.history[0].mediatorEntityId).toBe(participants[0].id)
    session = continueAfterTop10Summary(session)
    expect(session.phase).toBe('playing')
    expect(session.currentMediatorId).toBe(participants[1].id)
    session = continueAfterTop10Summary(endTop10Card(session, deck))
    session = continueAfterTop10Summary(endTop10Card(session, deck))
    expect(session.phase).toBe('finished')
  })

  it('keeps ties in winners', () => {
    const session = createTop10Session(participants, [], { mode: 'individual', roundsPerEntity: 1, firstMediatorId: participants[0].id }, deck, noShuffle)
    expect(getTop10Winners(session)).toHaveLength(3)
  })
})
