import { shuffle } from '../../lib/utils/shuffle'
import type { UltimaPistaDeck } from './content/ultimaPistaContent.types'

export type UltimaPistaOrderMode = 'sequential' | 'shuffled'

export type UltimaPistaProgress = {
  schemaVersion: 1
  deckId: string
  orderMode: UltimaPistaOrderMode
  cardOrder: number[]
  solvedCardIds: number[]
  updatedAt: string
}

export type UltimaPistaPhase = 'browsing' | 'privacy-gate' | 'mediator-reading'

export function createUltimaPistaProgress(deck: UltimaPistaDeck, now: Date = new Date()): UltimaPistaProgress {
  return { schemaVersion: 1, deckId: deck.deckId, orderMode: 'sequential', cardOrder: deck.cards.map((card) => card.id), solvedCardIds: [], updatedAt: now.toISOString() }
}

export function normalizeUltimaPistaProgress(value: unknown, deck: UltimaPistaDeck, now: Date = new Date()): UltimaPistaProgress {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.deckId !== deck.deckId || !Array.isArray(value.solvedCardIds)) {
    return createUltimaPistaProgress(deck, now)
  }
  const validIds = new Set(deck.cards.map((card) => card.id))
  const cardOrder = normalizeCardOrder(value.cardOrder, deck)
  const sequentialOrder = deck.cards.map((card) => card.id)
  const orderMode: UltimaPistaOrderMode = value.orderMode === 'shuffled' || (value.orderMode !== 'sequential' && !ordersMatch(cardOrder, sequentialOrder)) ? 'shuffled' : 'sequential'
  const solvedCardIds = [...new Set(value.solvedCardIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && validIds.has(id)))]
    .sort((a, b) => a - b)
  return {
    schemaVersion: 1,
    deckId: deck.deckId,
    orderMode,
    cardOrder,
    solvedCardIds,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString(),
  }
}

export function shuffleUltimaPistaCards(progress: UltimaPistaProgress, deck: UltimaPistaDeck, random: () => number = Math.random, now: Date = new Date()): UltimaPistaProgress {
  if (deck.cards.length < 2) return progress
  const shuffledOrder = shuffle(deck.cards.map((card) => card.id), random)
  const cardOrder = shuffledOrder.every((id, index) => id === progress.cardOrder[index])
    ? [...shuffledOrder.slice(1), shuffledOrder[0]!]
    : shuffledOrder
  return { ...progress, orderMode: 'shuffled', cardOrder, updatedAt: now.toISOString() }
}

export function orderUltimaPistaCardsSequentially(progress: UltimaPistaProgress, deck: UltimaPistaDeck, now: Date = new Date()): UltimaPistaProgress {
  const cardOrder = deck.cards.map((card) => card.id)
  if (progress.orderMode === 'sequential' && ordersMatch(progress.cardOrder, cardOrder)) return progress
  return { ...progress, orderMode: 'sequential', cardOrder, updatedAt: now.toISOString() }
}

export function clearUltimaPistaSolvedCards(progress: UltimaPistaProgress, now: Date = new Date()): UltimaPistaProgress {
  if (progress.solvedCardIds.length === 0) return progress
  return { ...progress, solvedCardIds: [], updatedAt: now.toISOString() }
}

export function markUltimaPistaCardSolved(progress: UltimaPistaProgress, cardId: number, deck: UltimaPistaDeck, now: Date = new Date()) {
  if (!deck.cards.some((card) => card.id === cardId) || progress.solvedCardIds.includes(cardId)) return progress
  return { ...progress, solvedCardIds: [...progress.solvedCardIds, cardId].sort((a, b) => a - b), updatedAt: now.toISOString() }
}

export function toggleUltimaPistaCardSolved(progress: UltimaPistaProgress, cardId: number, deck: UltimaPistaDeck, now: Date = new Date()) {
  if (!deck.cards.some((card) => card.id === cardId)) return progress
  const solvedCardIds = progress.solvedCardIds.includes(cardId)
    ? progress.solvedCardIds.filter((id) => id !== cardId)
    : [...progress.solvedCardIds, cardId].sort((a, b) => a - b)
  return { ...progress, solvedCardIds, updatedAt: now.toISOString() }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCardOrder(value: unknown, deck: UltimaPistaDeck) {
  const deckIds = deck.cards.map((card) => card.id)
  if (!Array.isArray(value)) return deckIds
  const validIds = new Set(deckIds)
  const savedIds = [...new Set(value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && validIds.has(id)))]
  return [...savedIds, ...deckIds.filter((id) => !savedIds.includes(id))]
}

function ordersMatch(first: readonly number[], second: readonly number[]) {
  return first.length === second.length && first.every((id, index) => id === second[index])
}
