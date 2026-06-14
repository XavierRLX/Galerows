import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import type { NemFerrandoDeck } from './content/nemFerrandoContent.types'
import { assertNemFerrandoDeck } from './content/nemFerrandoContent.validator'
import ptDeck from './content/decks/pt-BR.json'
import { awardIrons, canSwapCard, challengeGuess, continueAfterSummary, createNemFerrandoSession, getDeckProgress, participantIdentity, rankParticipants, revealAnswer, revealFirstCard, selectCuriosity, swapCard } from './nemFerrando.session'

const deck = assertNemFerrandoDeck(ptDeck)
const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
]
const noShuffle = () => 0.999999

function playCurrentCard(session: ReturnType<typeof createNemFerrandoSession>, participantId = participants[0].id) {
  const card = deck.cards.find((item) => item.id === session.currentCardId)!
  const curiosity = card.curiosities.find((item) => !session.usedCuriosityIds.includes(item.id))!
  let next = selectCuriosity(session, curiosity.id, deck)
  next = revealAnswer(challengeGuess(next))
  return awardIrons(next, participantId, deck)
}

describe('Nem Ferrando smart queue', () => {
  it('creates a shuffled queue with every card exactly once and waits to reveal it', () => {
    const fiftyCards: NemFerrandoDeck = {
      ...deck,
      cards: Array.from({ length: 50 }, (_, index) => ({ id: `card-${index}`, number: index + 1, theme: `Card ${index}`, irons: 1, curiosities: [{ id: `curiosity-${index}`, question: `Question ${index}`, answer: index }] })),
    }
    const session = createNemFerrandoSession(participants, 20, fiftyCards, () => 0.42)
    const ids = [session.currentCardId, ...session.cardQueue]
    expect(session.phase).toBe('starting')
    expect(ids).toHaveLength(50)
    expect(new Set(ids).size).toBe(50)
    expect(session.passSize).toBe(50)
    expect(session.passPosition).toBe(1)
  })

  it('reveals the first card without changing queue or player', () => {
    const session = createNemFerrandoSession(participants, 20, deck, noShuffle)
    const revealed = revealFirstCard(session)
    expect(revealed.phase).toBe('choosing')
    expect(revealed.currentCardId).toBe(session.currentCardId)
    expect(revealed.cardQueue).toEqual(session.cardQueue)
    expect(revealed.currentPlayerIndex).toBe(session.currentPlayerIndex)
  })

  it('moves a swapped card to the end without advancing the passage', () => {
    let session = revealFirstCard(createNemFerrandoSession(participants, 20, deck, noShuffle))
    const originalCard = session.currentCardId
    const nextCard = session.cardQueue[0]
    expect(canSwapCard(session)).toBe(true)
    session = swapCard(session)
    expect(session.currentCardId).toBe(nextCard)
    expect(session.cardQueue.at(-1)).toBe(originalCard)
    expect(session.passPosition).toBe(1)
    expect(session.usedCuriosityIds).toEqual([])
    expect(swapCard(session)).toEqual(session)
  })

  it('shows every card before repeating one in a new passage', () => {
    let session = revealFirstCard(createNemFerrandoSession(participants, 20, deck, noShuffle))
    const firstPass: string[] = []
    for (let index = 0; index < deck.cards.length; index += 1) {
      firstPass.push(session.currentCardId!)
      session = playCurrentCard(session, participants[index % participants.length].id)
      expect(session.phase).toBe('round-summary')
      session = continueAfterSummary(session, noShuffle)
    }
    expect(new Set(firstPass).size).toBe(deck.cards.length)
    expect(session.phase).toBe('choosing')
    expect(session.passNumber).toBe(2)
    expect(session.passPosition).toBe(1)
    expect(firstPass).toContain(session.currentCardId)
  })

  it('only sends cards with unused curiosities to the next passage', () => {
    const oneUseDeck: NemFerrandoDeck = { ...deck, cards: deck.cards.map((card) => ({ ...card, irons: 1, curiosities: [card.curiosities[0]] })) }
    let session = revealFirstCard(createNemFerrandoSession(participants, 20, oneUseDeck, noShuffle))
    for (let index = 0; index < oneUseDeck.cards.length; index += 1) {
      const card = oneUseDeck.cards.find((item) => item.id === session.currentCardId)!
      session = selectCuriosity(session, card.curiosities[0].id, oneUseDeck)
      session = awardIrons(revealAnswer(challengeGuess(session)), participants[index % 2].id, oneUseDeck)
      if (index < oneUseDeck.cards.length - 1) session = continueAfterSummary(session, noShuffle)
    }
    expect(session.pendingFinishedReason).toBe('deck-exhausted')
    expect(session.nextPassCardIds).toEqual([])
    expect(continueAfterSummary(session, noShuffle).phase).toBe('finished')
  })

  it('avoids the previous opening card and starting player when alternatives exist', () => {
    const first = createNemFerrandoSession(participants, 20, deck, noShuffle)
    const history = { schemaVersion: 1 as const, cardId: first.currentCardId!, playerIdentity: participantIdentity(first.participants[first.currentPlayerIndex]) }
    const second = createNemFerrandoSession(participants, 20, deck, noShuffle, history)
    expect(second.currentCardId).not.toBe(first.currentCardId)
    expect(participantIdentity(second.participants[second.currentPlayerIndex])).not.toBe(history.playerIdentity)
  })

  it('reports progress and keeps ties in the ranking', () => {
    const session = { ...createNemFerrandoSession(participants, 20, deck, noShuffle), scores: { [participants[0].id]: 2, [participants[1].id]: 2 }, usedCuriosityIds: [deck.cards[0].curiosities[0].id] }
    expect(getDeckProgress(session, deck)).toEqual({ total: 12, remaining: 11 })
    expect(rankParticipants(session).map((item) => item.id)).toEqual(participants.map((item) => item.id))
  })
})
