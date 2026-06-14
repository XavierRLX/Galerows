import { afterEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import { getPackagedTabooDecks, loadTabooDeck } from './tabooContent.service'
import { validateTabooDeck, validateTabooDeckParity } from './tabooContent.validator'

const overrideKey = contentOverrideKey('taboo', 'en-US')

afterEach(async () => {
  await LocalPreferences.remove(overrideKey)
})

describe('Taboo content', () => {
  it('validates all packaged locales and parity', () => {
    const decks = getPackagedTabooDecks()

    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateTabooDeck(deck, deck.locale).valid)).toBe(true)
    expect(validateTabooDeckParity(decks)).toEqual({ valid: true, errors: [] })
    decks.forEach((deck) => {
      expect(deck.cards.length).toBeGreaterThanOrEqual(12)
      deck.cards.forEach((card) => expect(card.forbiddenWords).toHaveLength(5))
    })
  })

  it('rejects duplicate IDs, wrong locale and cards without exactly 5 forbidden words', () => {
    const invalid = structuredClone(getPackagedTabooDecks()[0])
    invalid.locale = 'en-US'
    invalid.cards[1].id = invalid.cards[0].id
    invalid.cards[0].word = ''
    invalid.cards[0].forbiddenWords = invalid.cards[0].forbiddenWords.slice(0, 4)

    const result = validateTabooDeck(invalid, 'pt-BR')

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('$.locale deve ser "pt-BR".')
    expect(result.errors).toContain('$.cards[1].id está duplicado.')
    expect(result.errors).toContain('$.cards[0].word deve ser um texto preenchido.')
    expect(result.errors).toContain('$.cards[0].forbiddenWords deve ter exatamente 5 palavras proibidas.')
  })

  it('detects parity changes between localized decks', () => {
    const decks = getPackagedTabooDecks()
    const translated = structuredClone(decks[1])
    translated.cards.reverse()

    const result = validateTabooDeckParity([decks[0], translated])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('en-US: os IDs e a ordem das cartas não correspondem a pt-BR.')
  })

  it('loads a valid local override and ignores an invalid one', async () => {
    const override = structuredClone(getPackagedTabooDecks()[1])
    override.title = 'Local Taboo'
    await LocalPreferences.setJson(overrideKey, override)

    const loadedOverride = await loadTabooDeck('en-US')
    expect(loadedOverride.source).toBe('override')
    expect(loadedOverride.deck.title).toBe('Local Taboo')

    await LocalPreferences.setJson(overrideKey, { broken: true })
    const packaged = await loadTabooDeck('en-US')
    expect(packaged.source).toBe('packaged')
    expect(packaged.deck.locale).toBe('en-US')
  })
})
