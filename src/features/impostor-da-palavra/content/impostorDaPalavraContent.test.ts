import { afterEach, describe, expect, it } from 'vitest'
import { LocalPreferences } from '../../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../../lib/storage/storage.keys'
import {
  getPackagedImpostorDaPalavraDecks,
  loadImpostorDaPalavraDeck,
  resolvePackagedImpostorDaPalavraDeck,
} from './impostorDaPalavraContent.service'
import {
  validateImpostorDaPalavraDeck,
  validateImpostorDaPalavraDeckParity,
} from './impostorDaPalavraContent.validator'

const overrideKey = contentOverrideKey('impostor-da-palavra', 'en-US')

afterEach(async () => {
  await LocalPreferences.remove(overrideKey)
})

describe('Impostor da Palavra content', () => {
  it('validates all packaged locales and their editorial minimums', () => {
    const decks = getPackagedImpostorDaPalavraDecks()

    expect(decks).toHaveLength(3)
    expect(decks.every((deck) => validateImpostorDaPalavraDeck(deck, deck.locale).valid)).toBe(true)
    expect(validateImpostorDaPalavraDeckParity(decks)).toEqual({ valid: true, errors: [] })
    decks.forEach((deck) => {
      const questionIds = new Set(deck.questions.map((question) => question.id))
      expect(deck.cards).toHaveLength(50)
      expect(deck.questions).toHaveLength(12)
      deck.cards.forEach((card) => {
        expect(card.questionIds).toHaveLength(12)
        expect(new Set(card.questionIds).size).toBe(12)
        expect(card.questionIds.every((id) => questionIds.has(id))).toBe(true)
      })
    })
  })

  it('reports precise paths for duplicate, missing, and invalid references', () => {
    const invalid = structuredClone(getPackagedImpostorDaPalavraDecks()[0])
    invalid.cards[0].alternateWord = invalid.cards[0].word.toLocaleLowerCase()
    invalid.cards[0].questionIds[1] = invalid.cards[0].questionIds[0]
    invalid.cards[0].questionIds[2] = 'missing-question'
    invalid.questions[1].id = invalid.questions[0].id

    const result = validateImpostorDaPalavraDeck(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('$.cards[0].alternateWord deve ser diferente de word.')
    expect(result.errors).toContain('$.cards[0].questionIds[1] está duplicado nesta carta.')
    expect(result.errors).toContain('$.cards[0].questionIds[2] referencia uma pergunta inexistente.')
    expect(result.errors).toContain('$.questions[1].id está duplicado.')
  })

  it('rejects manifests below the required card and question minimums', () => {
    const invalid = structuredClone(getPackagedImpostorDaPalavraDecks()[0])
    invalid.cards = invalid.cards.slice(0, 35)
    invalid.questions = invalid.questions.slice(0, 11)

    const result = validateImpostorDaPalavraDeck(invalid)

    expect(result.errors).toContain('$.cards deve ter pelo menos 36 cartas.')
    expect(result.errors).toContain('$.questions deve ter pelo menos 12 perguntas.')
  })

  it('detects structural differences between localized decks', () => {
    const decks = getPackagedImpostorDaPalavraDecks()
    const translated = structuredClone(decks[1])
    translated.cards[0].questionIds.reverse()
    translated.questions.reverse()

    const result = validateImpostorDaPalavraDeckParity([decks[0], translated])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('en-US: os IDs e a ordem das perguntas não correspondem a pt-BR.')
    expect(result.errors).toContain('en-US: questionIds da carta garrafa-de-agua não correspondem a pt-BR.')
  })

  it('falls back to pt-BR when a packaged locale is invalid', () => {
    const decks = getPackagedImpostorDaPalavraDecks()
    const sources = Object.fromEntries(decks.map((deck) => [deck.locale, deck])) as Record<
      'pt-BR' | 'en-US' | 'es-419',
      unknown
    >
    sources['en-US'] = { broken: true }

    const result = resolvePackagedImpostorDaPalavraDeck('en-US', sources)

    expect(result.source).toBe('fallback')
    expect(result.deck.locale).toBe('pt-BR')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('loads a valid local override and rejects an invalid one', async () => {
    const override = structuredClone(getPackagedImpostorDaPalavraDecks()[1])
    override.title = 'Local test deck'
    await LocalPreferences.setJson(overrideKey, override)

    const loadedOverride = await loadImpostorDaPalavraDeck('en-US')
    expect(loadedOverride.source).toBe('override')
    expect(loadedOverride.deck.title).toBe('Local test deck')

    await LocalPreferences.setJson(overrideKey, { broken: true })
    const loadedPackaged = await loadImpostorDaPalavraDeck('en-US')
    expect(loadedPackaged.source).toBe('packaged')
    expect(loadedPackaged.deck.locale).toBe('en-US')
    expect(loadedPackaged.warnings.length).toBeGreaterThan(0)
  })
})
