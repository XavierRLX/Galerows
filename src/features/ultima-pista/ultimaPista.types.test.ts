import { describe, expect, it } from 'vitest'
import type { UltimaPistaDeck } from './content/ultimaPistaContent.types'
import { clearUltimaPistaSolvedCards, createUltimaPistaProgress, markUltimaPistaCardSolved, normalizeUltimaPistaProgress, orderUltimaPistaCardsSequentially, shuffleUltimaPistaCards, toggleUltimaPistaCardSolved } from './ultimaPista.types'

const deck: UltimaPistaDeck = {
  schemaVersion: 1,
  gameId: 'ultima-pista',
  deckId: 'test-deck',
  locale: 'pt-BR',
  version: 2,
  title: 'Teste',
  cards: [1, 2, 3].map((id) => ({ id, title: `Carta ${id}`, prompt: 'Enigma', story: 'História', essentialFacts: ['Fato A', 'Fato B'] })),
}

describe('Última Pista progress', () => {
  it('marks valid cards once and ignores unknown cards', () => {
    const initial = createUltimaPistaProgress(deck, new Date('2026-01-01T00:00:00.000Z'))
    const solved = markUltimaPistaCardSolved(initial, 2, deck, new Date('2026-01-02T00:00:00.000Z'))
    expect(solved.solvedCardIds).toEqual([2])
    expect(markUltimaPistaCardSolved(solved, 2, deck)).toBe(solved)
    expect(markUltimaPistaCardSolved(solved, 99, deck)).toBe(solved)
  })

  it('toggles a card between solved and unsolved', () => {
    const initial = createUltimaPistaProgress(deck)
    const solved = toggleUltimaPistaCardSolved(initial, 1, deck)
    expect(solved.solvedCardIds).toEqual([1])
    expect(toggleUltimaPistaCardSolved(solved, 1, deck).solvedCardIds).toEqual([])
  })

  it('preserves valid solved IDs across deck versions and removes deleted cards', () => {
    const normalized = normalizeUltimaPistaProgress({ schemaVersion: 1, deckId: 'test-deck', solvedCardIds: [3, 2, 99, 2], updatedAt: 'saved' }, deck)
    expect(normalized.solvedCardIds).toEqual([2, 3])
    expect(normalized.updatedAt).toBe('saved')
  })

  it('starts clean when the deck identity changes', () => {
    const normalized = normalizeUltimaPistaProgress({ schemaVersion: 1, deckId: 'old', solvedCardIds: [1], updatedAt: 'saved' }, deck)
    expect(normalized.solvedCardIds).toEqual([])
    expect(normalized.deckId).toBe('test-deck')
  })

  it('keeps a complete shuffled card order in the saved progress', () => {
    const initial = createUltimaPistaProgress(deck, new Date('2026-01-01T00:00:00.000Z'))
    const shuffled = shuffleUltimaPistaCards(initial, deck, () => 0, new Date('2026-01-02T00:00:00.000Z'))
    expect(shuffled.cardOrder).toEqual([2, 3, 1])
    expect(shuffled.orderMode).toBe('shuffled')
    expect(shuffled.updatedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('restores the numbered sequence after shuffling', () => {
    const shuffled = shuffleUltimaPistaCards(createUltimaPistaProgress(deck), deck, () => 0)
    const sequential = orderUltimaPistaCardsSequentially(shuffled, deck, new Date('2026-01-03T00:00:00.000Z'))
    expect(sequential.orderMode).toBe('sequential')
    expect(sequential.cardOrder).toEqual([1, 2, 3])
    expect(sequential.updatedAt).toBe('2026-01-03T00:00:00.000Z')
  })

  it('clears solved cards without changing the selected order mode', () => {
    const shuffled = shuffleUltimaPistaCards(createUltimaPistaProgress(deck), deck, () => 0)
    const solved = toggleUltimaPistaCardSolved(shuffled, 2, deck)
    const cleared = clearUltimaPistaSolvedCards(solved, new Date('2026-01-04T00:00:00.000Z'))
    expect(cleared.solvedCardIds).toEqual([])
    expect(cleared.orderMode).toBe('shuffled')
    expect(cleared.cardOrder).toEqual([2, 3, 1])
  })

  it('repairs an incomplete saved card order with the remaining deck cards', () => {
    const normalized = normalizeUltimaPistaProgress({ schemaVersion: 1, deckId: 'test-deck', cardOrder: [3, 99, 3], solvedCardIds: [], updatedAt: 'saved' }, deck)
    expect(normalized.cardOrder).toEqual([3, 1, 2])
    expect(normalized.orderMode).toBe('shuffled')
  })
})
