import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { UltimaPistaDeck } from './ultimaPistaContent.types'

export function validateUltimaPistaDeck(value: unknown, expectedLocale?: SupportedLocale): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }
  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === 1, 'deve ser 1')
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'ultima-pista') errors.push('$.gameId deve ser "ultima-pista".')
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

  const cardIds = new Set<number>()
  value.cards.forEach((card, cardIndex) => {
    const path = `$.cards[${cardIndex}]`
    if (!isRecord(card)) { errors.push(`${path} deve ser um objeto.`); return }
    const cardId = requireNumber(card, 'id', path, errors, (item) => Number.isInteger(item) && item > 0, 'deve ser um inteiro positivo')
    if (cardId !== null && cardIds.has(cardId)) errors.push(`${path}.id está duplicado.`)
    if (cardId !== null) cardIds.add(cardId)
    requireString(card, 'title', path, errors)
    requireString(card, 'prompt', path, errors)
    requireString(card, 'story', path, errors)
    if (!Array.isArray(card.essentialFacts) || card.essentialFacts.length < 2 || card.essentialFacts.length > 5) {
      errors.push(`${path}.essentialFacts deve ter entre 2 e 5 itens.`)
      return
    }
    const normalizedFacts = new Set<string>()
    card.essentialFacts.forEach((fact, factIndex) => {
      const factPath = `${path}.essentialFacts[${factIndex}]`
      if (typeof fact !== 'string' || !fact.trim()) { errors.push(`${factPath} deve ser um texto preenchido.`); return }
      const normalized = fact.trim().toLocaleLowerCase('pt-BR')
      if (normalizedFacts.has(normalized)) errors.push(`${factPath} está duplicado.`)
      normalizedFacts.add(normalized)
    })
  })
  return { valid: errors.length === 0, errors }
}

export function assertUltimaPistaDeck(value: unknown, expectedLocale?: SupportedLocale): UltimaPistaDeck {
  const validation = validateUltimaPistaDeck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as UltimaPistaDeck
}

export function validateUltimaPistaDeckParity(decks: UltimaPistaDeck[]): ContentValidation {
  const errors: string[] = []
  const reference = decks[0]
  if (!reference) return { valid: false, errors: ['Nenhum baralho foi informado.'] }
  const referenceIds = reference.cards.map((card) => card.id).sort((a, b) => a - b)
  decks.slice(1).forEach((deck) => {
    const ids = deck.cards.map((card) => card.id).sort((a, b) => a - b)
    if (ids.join('|') !== referenceIds.join('|')) errors.push(`${deck.locale}: os IDs das cartas não correspondem a ${reference.locale}.`)
    if (deck.deckId !== reference.deckId) errors.push(`${deck.locale}: deckId diferente do baralho de referência.`)
    if (deck.version !== reference.version) errors.push(`${deck.locale}: version diferente do baralho de referência.`)
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
