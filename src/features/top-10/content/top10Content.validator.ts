import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { Top10Deck, Top10Rank } from './top10Content.types'

const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function validateTop10Deck(value: unknown, expectedLocale?: SupportedLocale): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }
  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === 1, 'deve ser 1')
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'top-10') errors.push('$.gameId deve ser "top-10".')
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
    requireString(card, 'theme', path, errors)
    requireString(card, 'question', path, errors)
    if (!Array.isArray(card.answers) || card.answers.length !== 10) {
      errors.push(`${path}.answers deve ter exatamente 10 respostas.`)
      return
    }
    const answerRanks = new Set<number>()
    card.answers.forEach((answer, answerIndex) => {
      const answerPath = `${path}.answers[${answerIndex}]`
      if (!isRecord(answer)) { errors.push(`${answerPath} deve ser um objeto.`); return }
      const rank = requireNumber(answer, 'rank', answerPath, errors, isRank, 'deve ser um inteiro entre 1 e 10')
      if (rank !== null && answerRanks.has(rank)) errors.push(`${answerPath}.rank está duplicado.`)
      if (rank !== null) answerRanks.add(rank)
      requireString(answer, 'label', answerPath, errors)
      if (answer.note !== undefined && (typeof answer.note !== 'string' || !answer.note.trim())) errors.push(`${answerPath}.note deve ser um texto preenchido.`)
    })
    ranks.forEach((rank) => {
      if (!answerRanks.has(rank)) errors.push(`${path}.answers deve conter o rank ${rank}.`)
    })
  })
  return { valid: errors.length === 0, errors }
}

export function assertTop10Deck(value: unknown, expectedLocale?: SupportedLocale): Top10Deck {
  const validation = validateTop10Deck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as Top10Deck
}

export function validateDeckParity(decks: Top10Deck[]): ContentValidation {
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

function isRank(value: number): value is Top10Rank {
  return Number.isInteger(value) && value >= 1 && value <= 10
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
