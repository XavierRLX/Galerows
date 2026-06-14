import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import { assertTabooDeck } from './content/tabooContent.validator'
import ptDeck from './content/decks/pt-BR.json'
import { beginTabooTurn, canSkip, continueAfterTabooSummary, createTabooSession, endTabooTurn, finishExpiredTurn, getRemainingSeconds, getTabooWinners, rankTabooEntities, recordCorrectGuess, skipTabooCard } from './taboo.session'
import type { TabooConfig, TabooTeam } from './taboo.types'

const deck = assertTabooDeck(ptDeck)
const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
  { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', isGuest: false },
]
const teams: TabooTeam[] = [{ id: 'team-a', name: 'Time A' }, { id: 'team-b', name: 'Time B' }]
const individualConfig: TabooConfig = { mode: 'individual', turnDurationSeconds: 60, allowSkips: true, skipLimit: 1, roundsPerEntity: 1 }
const teamConfig: TabooConfig = { mode: 'teams', turnDurationSeconds: 30, allowSkips: true, skipLimit: 3, roundsPerEntity: 1 }
const noShuffle = () => 0.999999

describe('Taboo session', () => {
  it('creates individual and team sessions with equal fixed turns', () => {
    const individual = createTabooSession(participants, [], individualConfig, deck, noShuffle)
    const teamSession = createTabooSession([], teams, teamConfig, deck, noShuffle)

    expect(individual.phase).toBe('turn-intro')
    expect(individual.turnQueue).toHaveLength(participants.length)
    expect(Object.keys(individual.scores)).toEqual(participants.map((participant) => participant.id))
    expect(teamSession.turnQueue).toHaveLength(teams.length)
    expect(Object.keys(teamSession.scores)).toEqual(teams.map((team) => team.id))
  })

  it('scores individual points for the guesser, not the clue giver', () => {
    let session = beginTabooTurn(createTabooSession(participants, [], individualConfig, deck, noShuffle))
    const clueGiverId = session.turnQueue[session.currentTurnIndex]
    const guesser = participants.find((participant) => participant.id !== clueGiverId)!

    session = recordCorrectGuess(session, guesser.id)

    expect(session.scores[guesser.id]).toBe(1)
    expect(session.scores[clueGiverId]).toBe(0)
    expect(session.currentTurnCorrect).toBe(1)
  })

  it('scores team points directly for the current team', () => {
    let session = beginTabooTurn(createTabooSession([], teams, teamConfig, deck, noShuffle))
    const teamId = session.turnQueue[session.currentTurnIndex]

    session = recordCorrectGuess(session)

    expect(session.scores[teamId]).toBe(1)
    expect(session.currentTurnCorrect).toBe(1)
  })

  it('limits skips and keeps them scoreless', () => {
    let session = beginTabooTurn(createTabooSession(participants, [], individualConfig, deck, noShuffle))

    expect(canSkip(session)).toBe(true)
    session = skipTabooCard(session)

    expect(session.skipsUsedThisTurn).toBe(1)
    expect(canSkip(session)).toBe(false)
    expect(Object.values(session.scores).every((score) => score === 0)).toBe(true)
  })

  it('expires a turn when the timer reaches zero', () => {
    const startedAt = new Date('2026-06-13T12:00:00.000Z')
    let session = beginTabooTurn(createTabooSession(participants, [], individualConfig, deck, noShuffle), startedAt)

    expect(getRemainingSeconds(session, new Date('2026-06-13T12:00:30.000Z'))).toBe(30)
    session = finishExpiredTurn(session, new Date('2026-06-13T12:01:00.000Z'))

    expect(session.phase).toBe('turn-summary')
    expect(session.lastTurnResult?.correct).toBe(0)
  })

  it('finishes after every entity has one turn and preserves ties', () => {
    let session = beginTabooTurn(createTabooSession([], teams, teamConfig, deck, noShuffle))
    session = recordCorrectGuess(session)
    session = endTabooTurn(session)
    session = continueAfterTabooSummary(session)
    session = beginTabooTurn(session)
    session = recordCorrectGuess(session)
    session = endTabooTurn(session)

    expect(session.pendingFinishedReason).toBe('turns-complete')
    session = continueAfterTabooSummary(session)
    expect(session.phase).toBe('finished')
    expect(rankTabooEntities(session).map((team) => team.id)).toEqual(teams.map((team) => team.id))
    expect(getTabooWinners(session)).toHaveLength(2)
  })
})
