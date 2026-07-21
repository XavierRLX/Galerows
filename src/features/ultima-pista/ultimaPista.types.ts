import type { UltimaPistaDeck } from './content/ultimaPistaContent.types'

export type UltimaPistaProgress = {
  schemaVersion: 1
  deckId: string
  solvedCardIds: number[]
  updatedAt: string
}

export type UltimaPistaPhase = 'browsing' | 'privacy-gate' | 'mediator-reading'

export function createUltimaPistaProgress(deck: UltimaPistaDeck, now: Date = new Date()): UltimaPistaProgress {
  return { schemaVersion: 1, deckId: deck.deckId, solvedCardIds: [], updatedAt: now.toISOString() }
}

export function normalizeUltimaPistaProgress(value: unknown, deck: UltimaPistaDeck, now: Date = new Date()): UltimaPistaProgress {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.deckId !== deck.deckId || !Array.isArray(value.solvedCardIds)) {
    return createUltimaPistaProgress(deck, now)
  }
  const validIds = new Set(deck.cards.map((card) => card.id))
  const solvedCardIds = [...new Set(value.solvedCardIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && validIds.has(id)))]
    .sort((a, b) => a - b)
  return {
    schemaVersion: 1,
    deckId: deck.deckId,
    solvedCardIds,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString(),
  }
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
