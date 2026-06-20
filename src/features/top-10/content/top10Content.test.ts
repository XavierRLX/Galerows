import { describe, expect, it } from 'vitest'
import { getPackagedTop10Decks, resolvePackagedTop10Deck } from './top10Content.service'
import { validateDeckParity, validateTop10Deck } from './top10Content.validator'

describe('Top 10 content', () => {
  it('validates every packaged locale and keeps card IDs in parity', () => {
    const decks = getPackagedTop10Decks()
    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateTop10Deck(deck, deck.locale).valid)).toBe(true)
    expect(validateDeckParity(decks)).toEqual({ valid: true, errors: [] })
    expect(decks[0].cards).toHaveLength(50)
    expect(decks[0].cards.every((card) => card.answers.length === 10)).toBe(true)
  })

  it('rejects cards without exactly 10 answers', () => {
    const deck = structuredClone(getPackagedTop10Decks()[0])
    deck.cards[0].answers.pop()
    const result = validateTop10Deck(deck)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('$.cards[0].answers deve ter exatamente 10 respostas.')
  })

  it('rejects duplicate and out-of-range ranks', () => {
    const duplicate = structuredClone(getPackagedTop10Decks()[0])
    duplicate.cards[0].answers[1].rank = 1
    expect(validateTop10Deck(duplicate).errors).toContain('$.cards[0].answers[1].rank está duplicado.')

    const invalid = structuredClone(getPackagedTop10Decks()[0])
    invalid.cards[0].answers[0].rank = 11 as 1
    expect(validateTop10Deck(invalid).errors).toContain('$.cards[0].answers[0].rank deve ser um inteiro entre 1 e 10.')
  })

  it('rejects non-numeric card IDs', () => {
    const deck = structuredClone(getPackagedTop10Decks()[0]) as unknown as { cards: Array<{ id: unknown }> }
    deck.cards[0].id = 'geo'
    expect(validateTop10Deck(deck).errors).toContain('$.cards[0].id deve ser um inteiro positivo.')
  })

  it('falls back to pt-BR when the selected packaged locale is invalid', () => {
    const decks = getPackagedTop10Decks()
    const sources = Object.fromEntries(decks.map((deck) => [deck.locale, deck])) as Record<'pt-BR' | 'en-US' | 'es-419', unknown>
    sources['en-US'] = { broken: true }
    const result = resolvePackagedTop10Deck('en-US', sources)
    expect(result.source).toBe('fallback')
    expect(result.deck.locale).toBe('pt-BR')
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
