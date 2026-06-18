import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import { assertMimicaDeck } from './content/mimicaContent.validator'
import ptDeck from './content/decks/pt-BR.json'
import { beginMimicaTurn, chooseMimicaAction, continueAfterMimicaSummary, createMimicaSession, expireMimicaTurn, getCurrentMimicaAction, getMimicaWinners, getRemainingSeconds, isMimicaSessionCompatible, rankMimicaEntities, recordMimicaMiss, recordMimicaSuccess } from './mimica.session'
import type { MimicaConfig, MimicaPreparedChallenge, MimicaTeam } from './mimica.types'

const deck = assertMimicaDeck(ptDeck)
const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
  { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', isGuest: false },
]
const teams: MimicaTeam[] = [{ id: 'team-a', name: 'Time A' }, { id: 'team-b', name: 'Time B' }]
const individualConfig: MimicaConfig = { mode: 'individual', useTimer: false, turnDurationSeconds: 60, roundsPerEntity: 1 }
const teamConfig: MimicaConfig = { mode: 'teams', useTimer: true, turnDurationSeconds: 30, roundsPerEntity: 1 }
const preparedChallenges: MimicaPreparedChallenge[] = [
  { id: 'challenge-a-1', targetTeamId: 'team-a', authorTeamId: 'team-b', round: 1, text: 'Pilotar uma nave', points: 1 },
  { id: 'challenge-b-1', targetTeamId: 'team-b', authorTeamId: 'team-a', round: 1, text: 'Abrir um cofre', points: 1 },
]
const noShuffle = () => 0.999999

describe('Mimica session', () => {
  it('creates individual and team sessions with fixed turns', () => {
    const individual = createMimicaSession(participants, [], { ...individualConfig, roundsPerEntity: 3 }, deck, noShuffle)
    const teamSession = createMimicaSession([], teams, teamConfig, deck, noShuffle)

    expect(individual.phase).toBe('turn-intro')
    expect(individual.turnQueue).toHaveLength(participants.length * 3)
    expect(Object.keys(individual.scores)).toEqual(participants.map((participant) => participant.id))
    expect(teamSession.turnQueue).toHaveLength(teams.length)
    expect(Object.keys(teamSession.scores)).toEqual(teams.map((team) => team.id))
  })

  it('creates team sessions with opponent-prepared challenges in team order', () => {
    const session = createMimicaSession([], teams, teamConfig, deck, noShuffle, null, 'opponent-prepared', preparedChallenges)

    expect(session.challengeSource).toBe('opponent-prepared')
    expect(session.turnQueue).toEqual(teams.map((team) => team.id))
    expect(session.currentCardId).toBeNull()
    expect(session.cardQueue).toEqual([])
    expect(session.preparedChallenges).toEqual(preparedChallenges)
  })

  it('rejects opponent-prepared sessions without every planned challenge', () => {
    expect(() => createMimicaSession([], teams, teamConfig, deck, noShuffle, null, 'opponent-prepared', preparedChallenges.slice(0, 1))).toThrow('Preencha todas as mímicas')
  })

  it('starts opponent-prepared turns directly into acting', () => {
    const startedAt = new Date('2026-06-13T12:00:00.000Z')
    const session = beginMimicaTurn(createMimicaSession([], teams, teamConfig, deck, noShuffle, null, 'opponent-prepared', preparedChallenges), startedAt)

    expect(session.phase).toBe('acting')
    expect(session.currentPreparedChallengeId).toBe('challenge-a-1')
    expect(session.turnStartedAt).toBe(startedAt.toISOString())
    expect(getCurrentMimicaAction(session, deck)?.label).toBe('Pilotar uma nave')
  })

  it('scores individual points with actor double and guesser base points', () => {
    let session = beginMimicaTurn(createMimicaSession(participants, [], individualConfig, deck, noShuffle))
    const actorId = session.turnQueue[session.currentTurnIndex]
    const guesser = participants.find((participant) => participant.id !== actorId)!
    const card = deck.cards.find((item) => item.id === session.currentCardId)!
    const action = card.actions[2]

    session = chooseMimicaAction(session, action.id, deck)
    session = recordMimicaSuccess(session, guesser.id, deck)

    expect(session.scores[actorId]).toBe(action.points * 2)
    expect(session.scores[guesser.id]).toBe(action.points)
    expect(session.lastTurnResult?.actorPoints).toBe(action.points * 2)
    expect(session.lastTurnResult?.guesserPoints).toBe(action.points)
  })

  it('does not let the actor score as the guesser', () => {
    let session = beginMimicaTurn(createMimicaSession(participants, [], individualConfig, deck, noShuffle))
    const actorId = session.turnQueue[session.currentTurnIndex]
    const card = deck.cards.find((item) => item.id === session.currentCardId)!

    session = chooseMimicaAction(session, card.actions[0].id, deck)
    const unchanged = recordMimicaSuccess(session, actorId, deck)

    expect(unchanged.phase).toBe('acting')
    expect(Object.values(unchanged.scores).every((score) => score === 0)).toBe(true)
  })

  it('scores team points directly for the current team', () => {
    let session = beginMimicaTurn(createMimicaSession([], teams, teamConfig, deck, noShuffle))
    const teamId = session.turnQueue[session.currentTurnIndex]
    const card = deck.cards.find((item) => item.id === session.currentCardId)!
    const action = card.actions[1]

    session = chooseMimicaAction(session, action.id, deck)
    session = recordMimicaSuccess(session, null, deck)

    expect(session.scores[teamId]).toBe(action.points)
    expect(session.lastTurnResult?.guesserId).toBeNull()
  })

  it('scores one point for opponent-prepared team challenges', () => {
    let session = beginMimicaTurn(createMimicaSession([], teams, teamConfig, deck, noShuffle, null, 'opponent-prepared', preparedChallenges))
    const teamId = session.turnQueue[session.currentTurnIndex]

    session = recordMimicaSuccess(session, null, deck)

    expect(session.scores[teamId]).toBe(1)
    expect(session.lastTurnResult?.cardId).toBeNull()
    expect(session.lastTurnResult?.action?.label).toBe('Pilotar uma nave')
    expect(session.pendingFinishedReason).toBeNull()
  })

  it('supports timer off and expires timed turns into scoring', () => {
    const startedAt = new Date('2026-06-13T12:00:00.000Z')
    let noTimer = beginMimicaTurn(createMimicaSession(participants, [], individualConfig, deck, noShuffle))
    const noTimerCard = deck.cards.find((item) => item.id === noTimer.currentCardId)!
    noTimer = chooseMimicaAction(noTimer, noTimerCard.actions[0].id, deck, startedAt)

    expect(noTimer.turnStartedAt).toBeNull()
    expect(getRemainingSeconds(noTimer, new Date('2026-06-13T12:30:00.000Z'))).toBe(60)

    let timed = beginMimicaTurn(createMimicaSession([], teams, teamConfig, deck, noShuffle))
    const timedCard = deck.cards.find((item) => item.id === timed.currentCardId)!
    timed = chooseMimicaAction(timed, timedCard.actions[0].id, deck, startedAt)
    expect(getRemainingSeconds(timed, new Date('2026-06-13T12:00:10.000Z'))).toBe(20)
    timed = expireMimicaTurn(timed, new Date('2026-06-13T12:00:30.000Z'))
    expect(timed.phase).toBe('scoring')
  })

  it('advances rounds and finishes after planned turns', () => {
    let session = createMimicaSession([], teams, teamConfig, deck, noShuffle)
    for (let index = 0; index < teams.length; index += 1) {
      session = beginMimicaTurn(session)
      const card = deck.cards.find((item) => item.id === session.currentCardId)!
      session = chooseMimicaAction(session, card.actions[0].id, deck)
      session = recordMimicaSuccess(session, null, deck)
      session = continueAfterMimicaSummary(session)
    }

    expect(session.phase).toBe('round-summary')
    expect(session.pendingFinishedReason).toBe('turns-complete')
    session = continueAfterMimicaSummary(session)
    expect(session.phase).toBe('finished')
    expect(rankMimicaEntities(session).map((team) => team.id)).toEqual(teams.map((team) => team.id))
    expect(getMimicaWinners(session)).toHaveLength(2)
  })

  it('finishes by deck exhaustion before planned turns end', () => {
    const tinyDeck = { ...deck, cards: deck.cards.slice(0, 1) }
    let session = beginMimicaTurn(createMimicaSession(participants, [], { ...individualConfig, roundsPerEntity: 2 }, tinyDeck, noShuffle))
    const card = tinyDeck.cards.find((item) => item.id === session.currentCardId)!

    session = chooseMimicaAction(session, card.actions[0].id, tinyDeck)
    session = recordMimicaMiss(session, tinyDeck)

    expect(session.pendingFinishedReason).toBe('deck-exhausted')
    session = continueAfterMimicaSummary(session)
    expect(session.phase).toBe('round-summary')
    session = continueAfterMimicaSummary(session)
    expect(session.phase).toBe('finished')
    expect(session.finishedReason).toBe('deck-exhausted')
  })

  it('finishes opponent-prepared sessions by planned turns even without deck cards', () => {
    const emptyDeck = { ...deck, cards: [] }
    let session = createMimicaSession([], teams, teamConfig, emptyDeck, noShuffle, null, 'opponent-prepared', preparedChallenges)
    for (let index = 0; index < teams.length; index += 1) {
      session = beginMimicaTurn(session)
      session = recordMimicaSuccess(session, null, emptyDeck)
      session = continueAfterMimicaSummary(session)
    }

    expect(session.phase).toBe('round-summary')
    expect(session.pendingFinishedReason).toBe('turns-complete')
  })

  it('treats legacy saved sessions as deck sessions', () => {
    const legacy = createMimicaSession(participants, [], individualConfig, deck, noShuffle) as unknown as Record<string, unknown>
    delete legacy.challengeSource
    delete legacy.preparedChallenges
    delete legacy.currentPreparedChallengeId

    expect(isMimicaSessionCompatible(legacy, deck)).toBe(true)
  })
})
