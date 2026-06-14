import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import type { ImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.types'
import { advanceClueTurn, advanceRolePass, beginAccusation, beginConversation, confirmAccusation, continueAfterRound, createImpostorDaPalavraSession, getParticipantBriefing, getWinners, isSessionCompatible, rankParticipants, recordFinalGuess, selectAccusedParticipant } from './impostorDaPalavra.session'
import type { ImpostorDaPalavraConfig, ImpostorDaPalavraSession } from './impostorDaPalavra.types'

const participants: GameParticipant[] = [
  { id: 'ana-session', name: 'Ana', sourcePlayerId: 'ana', isGuest: false },
  { id: 'bia-session', name: 'Bia', sourcePlayerId: 'bia', isGuest: false },
  { id: 'caio-session', name: 'Caio', sourcePlayerId: 'caio', isGuest: false },
  { id: 'dani-session', name: 'Dani', sourcePlayerId: 'dani', isGuest: true },
]
const questionIds = Array.from({ length: 12 }, (_, index) => `question-${index + 1}`)
const deck: ImpostorDaPalavraDeck = {
  schemaVersion: 1,
  gameId: 'impostor-da-palavra',
  deckId: 'core',
  locale: 'pt-BR',
  version: 1,
  title: 'Impostor da Palavra',
  questions: questionIds.map((id, index) => ({ id, text: `Pergunta ${index + 1}` })),
  cards: Array.from({ length: 12 }, (_, index) => ({
    id: `card-${index + 1}`,
    category: 'objects',
    word: `Palavra ${index + 1}`,
    impostorHint: `Dica ${index + 1}`,
    alternateWord: `Alternativa ${index + 1}`,
    questionIds,
  })),
}
const noShuffle = () => 0.999999
const defaultConfig: ImpostorDaPalavraConfig = { impostorMode: 'no-word', conversationMode: 'one-word' }

describe('Impostor da Palavra session', () => {
  it('creates one impostor turn per participant and does not persist reveal state', () => {
    const session = createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle)
    expect(session.impostorQueue).toEqual(participants.map((participant) => participant.id))
    expect(new Set(session.impostorQueue)).toEqual(new Set(participants.map((participant) => participant.id)))
    expect(session.currentImpostorId).toBe(participants[0].id)
    expect(session.usedCardIds).toEqual([deck.cards[0].id])
    expect(Object.keys(session).some((key) => /reveal|visible|shown/i.test(key))).toBe(false)
  })

  it('derives the correct briefing for all three impostor modes', () => {
    const base = createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle)
    expect(getParticipantBriefing(base, deck, participants[1].id)).toEqual({ kind: 'word', word: deck.cards[0].word })
    expect(getParticipantBriefing(base, deck, base.currentImpostorId)).toEqual({ kind: 'impostor' })
    expect(getParticipantBriefing({ ...base, config: { ...base.config, impostorMode: 'hint' } }, deck, base.currentImpostorId)).toEqual({ kind: 'impostor-hint', hint: deck.cards[0].impostorHint })
    expect(getParticipantBriefing({ ...base, config: { ...base.config, impostorMode: 'alternate-word' } }, deck, base.currentImpostorId)).toEqual({ kind: 'word', word: deck.cards[0].alternateWord })
  })

  it('assigns a distinct guided question to every participant', () => {
    const session = createImpostorDaPalavraSession(participants, { ...defaultConfig, conversationMode: 'guided-questions' }, deck, noShuffle)
    expect(Object.keys(session.questionAssignments)).toHaveLength(participants.length)
    expect(new Set(Object.values(session.questionAssignments))).toHaveLength(participants.length)
    expect(Object.values(session.questionAssignments).every((id) => questionIds.includes(id))).toBe(true)
  })

  it('moves only through the expected phases and ignores invalid transitions', () => {
    let session = createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle)
    expect(beginConversation(session)).toBe(session)
    for (let index = 0; index < participants.length; index += 1) session = advanceRolePass(session)
    expect(session.phase).toBe('conversation-intro')
    session = beginConversation(session)
    for (let index = 0; index < participants.length; index += 1) session = advanceClueTurn(session)
    expect(session.phase).toBe('discussion')
    session = beginAccusation(session)
    expect(session.phase).toBe('accusation')
    expect(confirmAccusation(session)).toBe(session)
  })

  it('awards two points to the impostor after a wrong accusation', () => {
    let session = reachAccusation(createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle))
    session = selectAccusedParticipant(session, participants[1].id)
    session = confirmAccusation(session)
    expect(session.phase).toBe('round-summary')
    expect(session.scores[participants[0].id]).toBe(2)
    expect(session.lastRoundResult).toMatchObject({ accusationCorrect: false, finalGuessCorrect: null })
  })

  it('awards two points to an identified impostor who guesses the word', () => {
    let session = reachAccusation(createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle))
    session = confirmCorrectAccusation(session)
    expect(session.phase).toBe('final-guess')
    session = recordFinalGuess(session, true)
    expect(session.scores[participants[0].id]).toBe(2)
    expect(session.lastRoundResult?.finalGuessCorrect).toBe(true)
  })

  it('awards one point to every non-impostor after a failed final guess', () => {
    let session = reachAccusation(createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle))
    session = recordFinalGuess(confirmCorrectAccusation(session), false)
    expect(session.scores[participants[0].id]).toBe(0)
    expect(participants.slice(1).map((participant) => session.scores[participant.id])).toEqual([1, 1, 1])
  })

  it('uses every impostor and word once, varies the opening, then finishes', () => {
    let session = createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle)
    const impostors: string[] = []
    const cards: string[] = []
    const openings: string[] = []
    for (let round = 0; round < participants.length; round += 1) {
      impostors.push(session.currentImpostorId)
      cards.push(session.currentCardId)
      openings.push(session.speakingOrder[0])
      session = selectAccusedParticipant(reachAccusation(session), participantAfter(session.currentImpostorId))
      session = confirmAccusation(session)
      session = continueAfterRound(session, deck, noShuffle)
    }
    expect(session.phase).toBe('finished')
    expect(new Set(impostors)).toEqual(new Set(participants.map((participant) => participant.id)))
    expect(new Set(cards).size).toBe(participants.length)
    expect(openings.every((opening, index) => index === 0 || opening !== openings[index - 1])).toBe(true)
  })

  it('keeps tied winners and ranks highest scores first', () => {
    const session = { ...createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle), scores: { [participants[0].id]: 2, [participants[1].id]: 3, [participants[2].id]: 3, [participants[3].id]: 0 } }
    expect(rankParticipants(session).slice(0, 2).map((participant) => participant.id)).toEqual([participants[1].id, participants[2].id])
    expect(getWinners(session).map((participant) => participant.id)).toEqual([participants[1].id, participants[2].id])
  })

  it('validates schema, locale, deck IDs and queue integrity before resuming', () => {
    const session = createImpostorDaPalavraSession(participants, defaultConfig, deck, noShuffle)
    expect(isSessionCompatible(session, deck)).toBe(true)
    expect(isSessionCompatible({ ...session, schemaVersion: 2 }, deck)).toBe(false)
    expect(isSessionCompatible({ ...session, locale: 'en-US' }, deck)).toBe(false)
    expect(isSessionCompatible({ ...session, impostorQueue: [participants[0].id, participants[0].id, participants[2].id, participants[3].id] }, deck)).toBe(false)
    expect(isSessionCompatible({ ...session, currentCardId: 'missing-card' }, deck)).toBe(false)
  })
})

function reachAccusation(initial: ImpostorDaPalavraSession) {
  let session = initial
  for (let index = 0; index < participants.length; index += 1) session = advanceRolePass(session)
  session = beginConversation(session)
  for (let index = 0; index < participants.length; index += 1) session = advanceClueTurn(session)
  return beginAccusation(session)
}

function confirmCorrectAccusation(session: ImpostorDaPalavraSession) {
  return confirmAccusation(selectAccusedParticipant(session, session.currentImpostorId))
}

function participantAfter(participantId: string) {
  const index = participants.findIndex((participant) => participant.id === participantId)
  return participants[(index + 1) % participants.length].id
}
