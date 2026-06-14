import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import { normalizePlayerName } from '../players/players.model'
import type { GameParticipant } from '../players/players.types'
import type { NemFerrandoDeck } from './content/nemFerrandoContent.types'
import type { FinishedReason, IronLimit, NemFerrandoOpeningHistory, NemFerrandoRoundResult, NemFerrandoSession } from './nemFerrando.types'

export function participantIdentity(participant: GameParticipant) {
  return participant.sourcePlayerId ?? `guest:${normalizePlayerName(participant.name).toLocaleLowerCase('pt-BR')}`
}

export function createNemFerrandoSession(
  participants: GameParticipant[],
  ironLimit: IronLimit,
  deck: NemFerrandoDeck,
  random: () => number = Math.random,
  history: NemFerrandoOpeningHistory | null = null,
): NemFerrandoSession {
  if (participants.length < 2 || participants.length > 12) throw new Error('Selecione entre 2 e 12 jogadores.')
  const shuffledCards = avoidFirst(shuffle(deck.cards.map((card) => card.id), random), history?.cardId)
  const currentCardId = shuffledCards[0] ?? null
  const currentPlayerIndex = pickStartingPlayerIndex(participants, history?.playerIdentity, random)
  const now = new Date().toISOString()
  return {
    schemaVersion: 3,
    id: createId('nem-ferrando'),
    gameId: 'nem-ferrando',
    deckId: deck.deckId,
    deckVersion: deck.version,
    locale: deck.locale,
    phase: 'starting',
    participants,
    scores: Object.fromEntries(participants.map((participant) => [participant.id, 0])),
    currentPlayerIndex,
    round: 1,
    ironLimit,
    usedCuriosityIds: [],
    currentCardId,
    cardQueue: shuffledCards.slice(1),
    nextPassCardIds: [],
    passNumber: 1,
    passPosition: 1,
    passSize: shuffledCards.length,
    selectedCuriosityId: null,
    swappedThisTurn: false,
    lastRoundResult: null,
    pendingFinishedReason: null,
    finishedReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function revealFirstCard(session: NemFerrandoSession) {
  if (session.phase !== 'starting') return session
  return touch({ ...session, phase: 'choosing' })
}

export function selectCuriosity(session: NemFerrandoSession, curiosityId: string, deck: NemFerrandoDeck) {
  if (session.phase !== 'choosing') return session
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  if (!card?.curiosities.some((item) => item.id === curiosityId) || session.usedCuriosityIds.includes(curiosityId)) return session
  return touch({ ...session, selectedCuriosityId: curiosityId })
}

export function canSwapCard(session: NemFerrandoSession) {
  return session.phase === 'choosing' && !session.selectedCuriosityId && !session.swappedThisTurn && session.currentCardId !== null && session.cardQueue.length > 0
}

export function swapCard(session: NemFerrandoSession) {
  if (!canSwapCard(session) || !session.currentCardId) return session
  const [currentCardId, ...remainingQueue] = session.cardQueue
  if (!currentCardId) return session
  return touch({ ...session, currentCardId, cardQueue: [...remainingQueue, session.currentCardId], swappedThisTurn: true })
}

export function challengeGuess(session: NemFerrandoSession) {
  if (session.phase !== 'choosing' || !session.selectedCuriosityId) return session
  return touch({ ...session, phase: 'challenged' })
}

export function revealAnswer(session: NemFerrandoSession) {
  if (session.phase !== 'challenged') return session
  return touch({ ...session, phase: 'revealed' })
}

export function awardIrons(session: NemFerrandoSession, participantId: string, deck: NemFerrandoDeck) {
  if (session.phase !== 'revealed' || !session.selectedCuriosityId || !session.currentCardId) return session
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  if (!card || !session.participants.some((participant) => participant.id === participantId)) return session
  const previousScore = session.scores[participantId] ?? 0
  const newScore = previousScore + card.irons
  const scores = { ...session.scores, [participantId]: newScore }
  const usedCuriosityIds = [...session.usedCuriosityIds, session.selectedCuriosityId]
  const hasRemainingCuriosity = card.curiosities.some((curiosity) => !usedCuriosityIds.includes(curiosity.id))
  const nextPassCardIds = hasRemainingCuriosity ? [...session.nextPassCardIds, card.id] : session.nextPassCardIds
  const lastRoundResult: NemFerrandoRoundResult = { participantId, irons: card.irons, previousScore, newScore }
  let pendingFinishedReason: FinishedReason | null = null
  if (newScore >= session.ironLimit) pendingFinishedReason = 'iron-limit'
  else if (session.cardQueue.length === 0 && nextPassCardIds.length === 0) pendingFinishedReason = 'deck-exhausted'
  return touch({ ...session, scores, usedCuriosityIds, nextPassCardIds, phase: 'round-summary', lastRoundResult, pendingFinishedReason })
}

export function continueAfterSummary(session: NemFerrandoSession, random: () => number = Math.random) {
  if (session.phase !== 'round-summary' || !session.lastRoundResult) return session
  if (session.pendingFinishedReason) return touch({ ...session, phase: 'finished', finishedReason: session.pendingFinishedReason, pendingFinishedReason: null })

  let cardQueue = session.cardQueue
  let nextPassCardIds = session.nextPassCardIds
  let passNumber = session.passNumber
  let passPosition = session.passPosition + 1
  let passSize = session.passSize
  if (cardQueue.length === 0) {
    cardQueue = avoidFirst(shuffle(nextPassCardIds, random), session.currentCardId ?? undefined)
    nextPassCardIds = []
    passNumber += 1
    passPosition = 1
    passSize = cardQueue.length
  }
  const [currentCardId, ...remainingQueue] = cardQueue
  if (!currentCardId) return touch({ ...session, phase: 'finished', finishedReason: 'deck-exhausted', pendingFinishedReason: null })
  const nextPlayerIndex = (session.currentPlayerIndex + 1) % session.participants.length
  return touch({
    ...session,
    phase: 'choosing',
    currentPlayerIndex: nextPlayerIndex,
    round: session.round + (nextPlayerIndex === 0 ? 1 : 0),
    currentCardId,
    cardQueue: remainingQueue,
    nextPassCardIds,
    passNumber,
    passPosition,
    passSize,
    selectedCuriosityId: null,
    swappedThisTurn: false,
    lastRoundResult: null,
    pendingFinishedReason: null,
  })
}

export function rankParticipants(session: NemFerrandoSession) {
  return [...session.participants].sort((a, b) => (session.scores[a.id] ?? 0) - (session.scores[b.id] ?? 0))
}

export function getDeckProgress(session: NemFerrandoSession, deck: NemFerrandoDeck) {
  const total = deck.cards.reduce((sum, card) => sum + card.curiosities.length, 0)
  return { total, remaining: total - session.usedCuriosityIds.length }
}

export function isOpeningHistory(value: unknown): value is NemFerrandoOpeningHistory {
  if (typeof value !== 'object' || value === null) return false
  const history = value as Partial<NemFerrandoOpeningHistory>
  return history.schemaVersion === 1 && typeof history.cardId === 'string' && typeof history.playerIdentity === 'string'
}

export function isSessionCompatible(value: unknown, deck: NemFerrandoDeck): value is NemFerrandoSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Partial<NemFerrandoSession>
  const curiosityIds = new Set(deck.cards.flatMap((card) => card.curiosities.map((curiosity) => curiosity.id)))
  const cardIds = new Set(deck.cards.map((card) => card.id))
  const participantIds = new Set(session.participants?.map((participant) => participant.id) ?? [])
  const phases = ['setup', 'starting', 'choosing', 'challenged', 'revealed', 'round-summary', 'finished']
  const finishedReasons = ['iron-limit', 'deck-exhausted']
  return session.schemaVersion === 3
    && session.gameId === 'nem-ferrando'
    && session.deckId === deck.deckId
    && session.deckVersion === deck.version
    && Array.isArray(session.participants)
    && session.participants.length >= 2
    && session.participants.length <= 12
    && session.participants.every((participant) => typeof participant?.id === 'string' && typeof participant.name === 'string')
    && typeof session.scores === 'object' && session.scores !== null
    && session.participants.every((participant) => typeof session.scores?.[participant.id] === 'number')
    && typeof session.phase === 'string' && phases.includes(session.phase)
    && typeof session.currentPlayerIndex === 'number' && session.currentPlayerIndex >= 0 && session.currentPlayerIndex < session.participants.length
    && (session.ironLimit === 10 || session.ironLimit === 15 || session.ironLimit === 20)
    && Array.isArray(session.usedCuriosityIds) && session.usedCuriosityIds.every((id) => typeof id === 'string' && curiosityIds.has(id))
    && (session.currentCardId === null || (typeof session.currentCardId === 'string' && cardIds.has(session.currentCardId)))
    && isCardIdList(session.cardQueue, cardIds) && isCardIdList(session.nextPassCardIds, cardIds)
    && typeof session.passNumber === 'number' && session.passNumber >= 1
    && typeof session.passPosition === 'number' && session.passPosition >= 1
    && typeof session.passSize === 'number' && session.passSize >= 1
    && (session.selectedCuriosityId === null || (typeof session.selectedCuriosityId === 'string' && curiosityIds.has(session.selectedCuriosityId)))
    && typeof session.swappedThisTurn === 'boolean'
    && isRoundResult(session.lastRoundResult, participantIds)
    && (session.pendingFinishedReason === null || (typeof session.pendingFinishedReason === 'string' && finishedReasons.includes(session.pendingFinishedReason)))
    && (session.finishedReason === null || (typeof session.finishedReason === 'string' && finishedReasons.includes(session.finishedReason)))
}

function pickStartingPlayerIndex(participants: GameParticipant[], previousIdentity: string | undefined, random: () => number) {
  const eligible = participants.map((_, index) => index).filter((index) => participantIdentity(participants[index]) !== previousIdentity)
  const choices = eligible.length ? eligible : participants.map((_, index) => index)
  return choices[Math.floor(random() * choices.length)] ?? 0
}

function avoidFirst(items: string[], previousId: string | undefined) {
  if (!previousId || items.length < 2 || items[0] !== previousId) return items
  const replacementIndex = items.findIndex((item) => item !== previousId)
  if (replacementIndex <= 0) return items
  const copy = [...items]
  ;[copy[0], copy[replacementIndex]] = [copy[replacementIndex], copy[0]]
  return copy
}

function isCardIdList(value: unknown, cardIds: Set<string>) {
  return Array.isArray(value) && value.every((id) => typeof id === 'string' && cardIds.has(id))
}

function isRoundResult(value: unknown, participantIds: Set<string>) {
  if (value === null) return true
  if (typeof value !== 'object') return false
  const result = value as Partial<NemFerrandoRoundResult>
  return typeof result.participantId === 'string' && participantIds.has(result.participantId)
    && typeof result.irons === 'number' && typeof result.previousScore === 'number' && typeof result.newScore === 'number'
}

function touch(session: NemFerrandoSession): NemFerrandoSession {
  return { ...session, updatedAt: new Date().toISOString() }
}
