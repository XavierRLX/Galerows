import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { TabooDeck, TabooDifficulty } from './tabooContent.types'

const difficulties: TabooDifficulty[] = ['easy', 'medium', 'hard']

export function validateTabooDeck(value: unknown, expectedLocale?: SupportedLocale): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }
  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === 1, 'deve ser 1')
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'taboo') errors.push('$.gameId deve ser "taboo".')
  requireString(value, 'deckId', '$', errors)
  requireString(value, 'locale', '$', errors)
  if (!supportedLocales.includes(value.locale as SupportedLocale)) errors.push('$.locale não é suportado.')
  if (expectedLocale && value.locale !== expectedLocale) errors.push(`$.locale deve ser "${expectedLocale}".`)
  requireNumber(value, 'version', '$', errors, (item) => Number.isInteger(item) && item > 0, 'deve ser um inteiro positivo')
  requireString(value, 'title', '$', errors)
  if (!Array.isArray(value.cards) || value.cards.length === 0) {
    errors.push('$.cards deve ter pelo menos uma carta.')
    return { valid: errors.length === 0, errors }
  }

  const cardIds = new Set<string>()
  value.cards.forEach((card, cardIndex) => {
    const path = `$.cards[${cardIndex}]`
    if (!isRecord(card)) { errors.push(`${path} deve ser um objeto.`); return }
    const cardId = requireString(card, 'id', path, errors)
    if (cardId && cardIds.has(cardId)) errors.push(`${path}.id está duplicado.`)
    if (cardId) cardIds.add(cardId)
    requireString(card, 'word', path, errors)
    if (card.category !== undefined && (typeof card.category !== 'string' || !card.category.trim())) errors.push(`${path}.category deve ser um texto preenchido.`)
    if (card.difficulty !== undefined && (typeof card.difficulty !== 'string' || !difficulties.includes(card.difficulty as TabooDifficulty))) errors.push(`${path}.difficulty deve ser easy, medium ou hard.`)
    if (!Array.isArray(card.forbiddenWords) || card.forbiddenWords.length !== 5) {
      errors.push(`${path}.forbiddenWords deve ter exatamente 5 palavras proibidas.`)
      return
    }
    const normalized = new Set<string>()
    card.forbiddenWords.forEach((word, wordIndex) => {
      const wordPath = `${path}.forbiddenWords[${wordIndex}]`
      if (typeof word !== 'string' || !word.trim()) {
        errors.push(`${wordPath} deve ser um texto preenchido.`)
        return
      }
      const key = word.trim().toLocaleLowerCase(value.locale === 'pt-BR' ? 'pt-BR' : undefined)
      if (normalized.has(key)) errors.push(`${wordPath} está duplicada na carta.`)
      normalized.add(key)
    })
  })
  return { valid: errors.length === 0, errors }
}

export function assertTabooDeck(value: unknown, expectedLocale?: SupportedLocale): TabooDeck {
  const validation = validateTabooDeck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as TabooDeck
}

export function validateTabooDeckParity(decks: TabooDeck[]): ContentValidation {
  const errors: string[] = []
  const reference = decks[0]
  if (!reference) return { valid: false, errors: ['Nenhum baralho foi informado.'] }
  const referenceIds = reference.cards.map((card) => card.id)
  decks.slice(1).forEach((deck) => {
    if (deck.schemaVersion !== reference.schemaVersion) errors.push(`${deck.locale}: schemaVersion diferente de ${reference.locale}.`)
    if (deck.gameId !== reference.gameId) errors.push(`${deck.locale}: gameId diferente de ${reference.locale}.`)
    if (deck.deckId !== reference.deckId) errors.push(`${deck.locale}: deckId diferente de ${reference.locale}.`)
    if (deck.version !== reference.version) errors.push(`${deck.locale}: version diferente de ${reference.locale}.`)
    if (deck.cards.map((card) => card.id).join('|') !== referenceIds.join('|')) errors.push(`${deck.locale}: os IDs e a ordem das cartas não correspondem a ${reference.locale}.`)
    deck.cards.forEach((card) => {
      if (card.forbiddenWords.length !== 5) errors.push(`${deck.locale}: a carta ${card.id} precisa ter 5 palavras proibidas.`)
    })
  })
  return { valid: errors.length === 0, errors }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, path: string, errors: string[]) {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) { errors.push(`${path}.${key} deve ser um texto preenchido.`); return null }
  return value
}

function requireNumber(record: Record<string, unknown>, key: string, path: string, errors: string[], predicate: (value: number) => boolean, message: string) {
  const value = record[key]
  if (typeof value !== 'number' || !predicate(value)) { errors.push(`${path}.${key} ${message}.`); return null }
  return value
}
