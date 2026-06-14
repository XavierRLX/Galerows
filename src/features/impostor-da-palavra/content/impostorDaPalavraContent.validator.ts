import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { ImpostorDaPalavraDeck } from './impostorDaPalavraContent.types'

const SCHEMA_VERSION = 1
const MINIMUM_CARD_COUNT = 36
const MINIMUM_QUESTION_COUNT = 12

export function validateImpostorDaPalavraDeck(
  value: unknown,
  expectedLocale?: SupportedLocale,
): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }

  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === SCHEMA_VERSION, `deve ser ${SCHEMA_VERSION}`)
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'impostor-da-palavra') errors.push('$.gameId deve ser "impostor-da-palavra".')
  requireString(value, 'deckId', '$', errors)
  requireString(value, 'locale', '$', errors)
  if (!supportedLocales.includes(value.locale as SupportedLocale)) errors.push('$.locale não é suportado.')
  if (expectedLocale && value.locale !== expectedLocale) errors.push(`$.locale deve ser "${expectedLocale}".`)
  requireNumber(value, 'version', '$', errors, (item) => Number.isInteger(item) && item > 0, 'deve ser um inteiro positivo')
  requireString(value, 'title', '$', errors)

  const questionIds = validateQuestions(value.questions, errors)
  validateCards(value.cards, questionIds, errors)

  return { valid: errors.length === 0, errors }
}

export function assertImpostorDaPalavraDeck(
  value: unknown,
  expectedLocale?: SupportedLocale,
): ImpostorDaPalavraDeck {
  const validation = validateImpostorDaPalavraDeck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as ImpostorDaPalavraDeck
}

export function validateImpostorDaPalavraDeckParity(decks: ImpostorDaPalavraDeck[]): ContentValidation {
  const errors: string[] = []
  const reference = decks[0]
  if (!reference) return { valid: false, errors: ['Nenhum baralho foi informado.'] }

  const referenceQuestionIds = reference.questions.map((question) => question.id)
  const referenceCards = new Map(reference.cards.map((card) => [card.id, card.questionIds]))

  decks.slice(1).forEach((deck) => {
    if (deck.schemaVersion !== reference.schemaVersion) errors.push(`${deck.locale}: schemaVersion diferente de ${reference.locale}.`)
    if (deck.gameId !== reference.gameId) errors.push(`${deck.locale}: gameId diferente de ${reference.locale}.`)
    if (deck.deckId !== reference.deckId) errors.push(`${deck.locale}: deckId diferente de ${reference.locale}.`)
    if (deck.version !== reference.version) errors.push(`${deck.locale}: version diferente de ${reference.locale}.`)
    if (!sameValues(deck.questions.map((question) => question.id), referenceQuestionIds)) {
      errors.push(`${deck.locale}: os IDs e a ordem das perguntas não correspondem a ${reference.locale}.`)
    }
    if (!sameValues(deck.cards.map((card) => card.id), reference.cards.map((card) => card.id))) {
      errors.push(`${deck.locale}: os IDs e a ordem das cartas não correspondem a ${reference.locale}.`)
    }
    deck.cards.forEach((card) => {
      const expectedQuestionIds = referenceCards.get(card.id)
      if (expectedQuestionIds && !sameValues(card.questionIds, expectedQuestionIds)) {
        errors.push(`${deck.locale}: questionIds da carta ${card.id} não correspondem a ${reference.locale}.`)
      }
    })
  })

  return { valid: errors.length === 0, errors }
}

function validateQuestions(value: unknown, errors: string[]) {
  const ids = new Set<string>()
  if (!Array.isArray(value) || value.length < MINIMUM_QUESTION_COUNT) {
    errors.push(`$.questions deve ter pelo menos ${MINIMUM_QUESTION_COUNT} perguntas.`)
    return ids
  }

  value.forEach((question, index) => {
    const path = `$.questions[${index}]`
    if (!isRecord(question)) { errors.push(`${path} deve ser um objeto.`); return }
    const id = requireString(question, 'id', path, errors)
    if (id && ids.has(id)) errors.push(`${path}.id está duplicado.`)
    if (id) ids.add(id)
    requireString(question, 'text', path, errors)
  })
  return ids
}

function validateCards(value: unknown, availableQuestionIds: Set<string>, errors: string[]) {
  if (!Array.isArray(value) || value.length < MINIMUM_CARD_COUNT) {
    errors.push(`$.cards deve ter pelo menos ${MINIMUM_CARD_COUNT} cartas.`)
    return
  }

  const cardIds = new Set<string>()
  const words = new Set<string>()
  value.forEach((card, index) => {
    const path = `$.cards[${index}]`
    if (!isRecord(card)) { errors.push(`${path} deve ser um objeto.`); return }
    const id = requireString(card, 'id', path, errors)
    if (id && cardIds.has(id)) errors.push(`${path}.id está duplicado.`)
    if (id) cardIds.add(id)
    requireString(card, 'category', path, errors)
    const word = requireString(card, 'word', path, errors)
    const normalizedWord = word ? normalizeText(word) : null
    if (normalizedWord && words.has(normalizedWord)) errors.push(`${path}.word está duplicado.`)
    if (normalizedWord) words.add(normalizedWord)
    requireString(card, 'impostorHint', path, errors)
    const alternateWord = requireString(card, 'alternateWord', path, errors)
    if (word && alternateWord && normalizeText(word) === normalizeText(alternateWord)) {
      errors.push(`${path}.alternateWord deve ser diferente de word.`)
    }

    if (!Array.isArray(card.questionIds) || card.questionIds.length < MINIMUM_QUESTION_COUNT) {
      errors.push(`${path}.questionIds deve ter pelo menos ${MINIMUM_QUESTION_COUNT} IDs.`)
      return
    }
    const cardQuestionIds = new Set<string>()
    card.questionIds.forEach((questionId, questionIndex) => {
      const questionPath = `${path}.questionIds[${questionIndex}]`
      if (typeof questionId !== 'string' || !questionId.trim()) {
        errors.push(`${questionPath} deve ser um texto preenchido.`)
        return
      }
      if (cardQuestionIds.has(questionId)) errors.push(`${questionPath} está duplicado nesta carta.`)
      cardQuestionIds.add(questionId)
      if (!availableQuestionIds.has(questionId)) errors.push(`${questionPath} referencia uma pergunta inexistente.`)
    })
  })
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, path: string, errors: string[]) {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path}.${key} deve ser um texto preenchido.`)
    return null
  }
  return value
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  predicate: (value: number) => boolean,
  message: string,
) {
  const value = record[key]
  if (typeof value !== 'number' || !predicate(value)) {
    errors.push(`${path}.${key} ${message}.`)
    return null
  }
  return value
}
