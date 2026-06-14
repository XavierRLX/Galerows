import { describe, expect, it } from 'vitest'
import { getPackagedNemFerrandoDecks, resolvePackagedNemFerrandoDeck } from './nemFerrandoContent.service'
import { validateDeckParity, validateNemFerrandoDeck } from './nemFerrandoContent.validator'

describe('Nem Ferrando content', () => {
  it('validates every packaged locale and keeps IDs in parity', () => {
    const decks = getPackagedNemFerrandoDecks()
    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateNemFerrandoDeck(deck, deck.locale).valid)).toBe(true)
    expect(validateDeckParity(decks)).toEqual({ valid: true, errors: [] })
    expect(decks[0].cards.map((card) => card.number)).toEqual([1, 2, 3, 4])
    expect(decks[0].cards.reduce((total, card) => total + card.curiosities.length, 0)).toBe(12)
  })

  it('reports exact paths for invalid fields', () => {
    const invalid = { schemaVersion: 2, gameId: 'nem-ferrando', deckId: 'x', locale: 'pt-BR', version: 2, title: 'x', cards: [{ id: 'x', number: 0, theme: 'X', irons: 9, curiosities: [] }] }
    const result = validateNemFerrandoDeck(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('$.cards[0].irons deve ser um inteiro entre 1 e 5.')
    expect(result.errors).toContain('$.cards[0].curiosities deve ter pelo menos uma curiosidade.')
    expect(result.errors).toContain('$.cards[0].number deve ser um inteiro positivo.')
  })

  it('rejects duplicate or mismatched editorial numbers', () => {
    const decks = getPackagedNemFerrandoDecks()
    const duplicate = structuredClone(decks[0])
    duplicate.cards[1].number = duplicate.cards[0].number
    expect(validateNemFerrandoDeck(duplicate).errors).toContain('$.cards[1].number está duplicado.')
    const translated = structuredClone(decks[1])
    translated.cards[0].number = 99
    expect(validateDeckParity([decks[0], translated]).errors[0]).toMatch(/número da carta automoveis/i)
  })

  it('falls back to pt-BR when the selected packaged locale is invalid', () => {
    const decks = getPackagedNemFerrandoDecks()
    const sources = Object.fromEntries(decks.map((deck) => [deck.locale, deck])) as Record<'pt-BR' | 'en-US' | 'es-419', unknown>
    sources['en-US'] = { broken: true }
    const result = resolvePackagedNemFerrandoDeck('en-US', sources)
    expect(result.source).toBe('fallback')
    expect(result.deck.locale).toBe('pt-BR')
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
