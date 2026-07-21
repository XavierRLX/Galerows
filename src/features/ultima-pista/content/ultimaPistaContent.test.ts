import { describe, expect, it } from 'vitest'
import { getPackagedUltimaPistaDecks, resolvePackagedUltimaPistaDeck } from './ultimaPistaContent.service'
import { validateUltimaPistaDeck, validateUltimaPistaDeckParity } from './ultimaPistaContent.validator'

describe('Última Pista content', () => {
  it('validates the three packaged locales with matching card IDs', () => {
    const decks = getPackagedUltimaPistaDecks()
    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateUltimaPistaDeck(deck, deck.locale).valid)).toBe(true)
    expect(validateUltimaPistaDeckParity(decks)).toEqual({ valid: true, errors: [] })
    expect(decks[0].cards).toHaveLength(15)
  })

  it('rejects duplicate IDs and an invalid essential-fact count', () => {
    const duplicate = structuredClone(getPackagedUltimaPistaDecks()[0])
    duplicate.cards[1].id = duplicate.cards[0].id
    expect(validateUltimaPistaDeck(duplicate).errors).toContain('$.cards[1].id está duplicado.')

    const incomplete = structuredClone(getPackagedUltimaPistaDecks()[0])
    incomplete.cards[0].essentialFacts = ['Apenas um fato.']
    expect(validateUltimaPistaDeck(incomplete).errors).toContain('$.cards[0].essentialFacts deve ter entre 2 e 5 itens.')
  })

  it('falls back to pt-BR when a packaged locale is invalid', () => {
    const decks = getPackagedUltimaPistaDecks()
    const sources = Object.fromEntries(decks.map((deck) => [deck.locale, deck])) as Record<'pt-BR' | 'en-US' | 'es-419', unknown>
    sources['en-US'] = { broken: true }
    const result = resolvePackagedUltimaPistaDeck('en-US', sources)
    expect(result.source).toBe('fallback')
    expect(result.deck.locale).toBe('pt-BR')
  })
})
