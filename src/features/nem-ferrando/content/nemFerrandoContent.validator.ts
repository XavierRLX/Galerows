import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { NemFerrandoDeck } from './nemFerrandoContent.types'

export function validateNemFerrandoDeck(value: unknown, expectedLocale?: SupportedLocale): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }
  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === 2, 'deve ser 2')
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'nem-ferrando') errors.push('$.gameId deve ser "nem-ferrando".')
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
  const cardNumbers = new Set<number>()
  const curiosityIds = new Set<string>()
  value.cards.forEach((card, cardIndex) => {
    const path = `$.cards[${cardIndex}]`
    if (!isRecord(card)) { errors.push(`${path} deve ser um objeto.`); return }
    const cardId = requireString(card, 'id', path, errors)
    if (cardId && cardIds.has(cardId)) errors.push(`${path}.id está duplicado.`)
    if (cardId) cardIds.add(cardId)
    const cardNumber = requireNumber(card, 'number', path, errors, (item) => Number.isInteger(item) && item > 0, 'deve ser um inteiro positivo')
    if (cardNumber !== null && cardNumbers.has(cardNumber)) errors.push(`${path}.number está duplicado.`)
    if (cardNumber !== null) cardNumbers.add(cardNumber)
    requireString(card, 'theme', path, errors)
    requireNumber(card, 'irons', path, errors, (item) => Number.isInteger(item) && item >= 1 && item <= 5, 'deve ser um inteiro entre 1 e 5')
    if (!Array.isArray(card.curiosities) || card.curiosities.length === 0) {
      errors.push(`${path}.curiosities deve ter pelo menos uma curiosidade.`)
      return
    }
    card.curiosities.forEach((curiosity, curiosityIndex) => {
      const curiosityPath = `${path}.curiosities[${curiosityIndex}]`
      if (!isRecord(curiosity)) { errors.push(`${curiosityPath} deve ser um objeto.`); return }
      const curiosityId = requireString(curiosity, 'id', curiosityPath, errors)
      if (curiosityId && curiosityIds.has(curiosityId)) errors.push(`${curiosityPath}.id está duplicado.`)
      if (curiosityId) curiosityIds.add(curiosityId)
      requireString(curiosity, 'question', curiosityPath, errors)
      requireNumber(curiosity, 'answer', curiosityPath, errors, Number.isFinite, 'deve ser um número')
      if (curiosity.unit !== undefined && (typeof curiosity.unit !== 'string' || !curiosity.unit.trim())) errors.push(`${curiosityPath}.unit deve ser um texto preenchido.`)
    })
  })
  return { valid: errors.length === 0, errors }
}

export function assertNemFerrandoDeck(value: unknown, expectedLocale?: SupportedLocale): NemFerrandoDeck {
  const validation = validateNemFerrandoDeck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as NemFerrandoDeck
}

export function validateDeckParity(decks: NemFerrandoDeck[]): ContentValidation {
  const errors: string[] = []
  const reference = decks[0]
  if (!reference) return { valid: false, errors: ['Nenhum baralho foi informado.'] }
  const referenceIds = flattenIds(reference)
  decks.slice(1).forEach((deck) => {
    const ids = flattenIds(deck)
    if (ids.join('|') !== referenceIds.join('|')) errors.push(`${deck.locale}: os IDs das cartas e curiosidades não correspondem a ${reference.locale}.`)
    if (deck.deckId !== reference.deckId) errors.push(`${deck.locale}: deckId diferente do baralho de referência.`)
    if (deck.version !== reference.version) errors.push(`${deck.locale}: version diferente do baralho de referência.`)
    const referenceNumbers = new Map(reference.cards.map((card) => [card.id, card.number]))
    deck.cards.forEach((card) => {
      if (referenceNumbers.get(card.id) !== card.number) errors.push(`${deck.locale}: o número da carta ${card.id} não corresponde a ${reference.locale}.`)
    })
  })
  return { valid: errors.length === 0, errors }
}

function flattenIds(deck: NemFerrandoDeck) {
  return deck.cards.flatMap((card) => [card.id, ...card.curiosities.map((curiosity) => curiosity.id)]).sort()
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
