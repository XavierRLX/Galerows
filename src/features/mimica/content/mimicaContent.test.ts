import { afterEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import { getPackagedMimicaDecks, loadMimicaDeck } from './mimicaContent.service'
import { validateMimicaDeck, validateMimicaDeckParity } from './mimicaContent.validator'

const overrideKey = contentOverrideKey('mimica', 'en-US')

afterEach(async () => {
  await LocalPreferences.remove(overrideKey)
})

describe('Mimica content', () => {
  it('validates all packaged locales and parity', () => {
    const decks = getPackagedMimicaDecks()

    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateMimicaDeck(deck, deck.locale).valid)).toBe(true)
    expect(validateMimicaDeckParity(decks)).toEqual({ valid: true, errors: [] })
    decks.forEach((deck) => {
      expect(deck.cards.length).toBeGreaterThanOrEqual(6)
      deck.cards.forEach((card) => expect(card.actions).toHaveLength(3))
    })
  })

  it('rejects duplicate IDs, wrong locale, invalid points and cards without exactly 3 actions', () => {
    const invalid = structuredClone(getPackagedMimicaDecks()[0])
    invalid.locale = 'en-US'
    invalid.cards[1].id = invalid.cards[0].id
    invalid.cards[0].theme = ''
    invalid.cards[0].actions = invalid.cards[0].actions.slice(0, 2)
    invalid.cards[1].actions[0].points = 0

    const result = validateMimicaDeck(invalid, 'pt-BR')

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('$.locale deve ser "pt-BR".')
    expect(result.errors).toContain('$.cards[1].id está duplicado.')
    expect(result.errors).toContain('$.cards[0].theme deve ser um texto preenchido.')
    expect(result.errors).toContain('$.cards[0].actions deve ter exatamente 3 ações.')
    expect(result.errors).toContain('$.cards[1].actions[0].points deve ser um inteiro positivo.')
  })

  it('detects parity changes between localized decks', () => {
    const decks = getPackagedMimicaDecks()
    const translated = structuredClone(decks[1])
    translated.cards.reverse()

    const result = validateMimicaDeckParity([decks[0], translated])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('en-US: os IDs e a ordem das cartas não correspondem a pt-BR.')
  })

  it('loads a valid local override and ignores an invalid one', async () => {
    const override = structuredClone(getPackagedMimicaDecks()[1])
    override.title = 'Local Charades'
    await LocalPreferences.setJson(overrideKey, override)

    const loadedOverride = await loadMimicaDeck('en-US')
    expect(loadedOverride.source).toBe('override')
    expect(loadedOverride.deck.title).toBe('Local Charades')

    await LocalPreferences.setJson(overrideKey, { broken: true })
    const packaged = await loadMimicaDeck('en-US')
    expect(packaged.source).toBe('packaged')
    expect(packaged.deck.locale).toBe('en-US')
  })
})
