import { supportedLocales, type SupportedLocale } from '../../../i18n'
import type { ContentValidation } from '../../content/content.types'
import type { MimicaDeck, MimicaDifficulty } from './mimicaContent.types'

const difficulties: MimicaDifficulty[] = ['easy', 'medium', 'hard']

export function validateMimicaDeck(value: unknown, expectedLocale?: SupportedLocale): ContentValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['$ deve ser um objeto.'] }
  requireNumber(value, 'schemaVersion', '$', errors, (item) => item === 1, 'deve ser 1')
  requireString(value, 'gameId', '$', errors)
  if (value.gameId !== 'mimica') errors.push('$.gameId deve ser "mimica".')
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
    requireString(card, 'theme', path, errors)
    if (typeof card.difficulty !== 'string' || !difficulties.includes(card.difficulty as MimicaDifficulty)) errors.push(`${path}.difficulty deve ser easy, medium ou hard.`)
    if (!Array.isArray(card.actions) || card.actions.length !== 3) {
      errors.push(`${path}.actions deve ter exatamente 3 ações.`)
      return
    }
    const actionIds = new Set<string>()
    card.actions.forEach((action, actionIndex) => {
      const actionPath = `${path}.actions[${actionIndex}]`
      if (!isRecord(action)) { errors.push(`${actionPath} deve ser um objeto.`); return }
      const actionId = requireString(action, 'id', actionPath, errors)
      if (actionId && actionIds.has(actionId)) errors.push(`${actionPath}.id está duplicado na carta.`)
      if (actionId) actionIds.add(actionId)
      requireString(action, 'label', actionPath, errors)
      requireNumber(action, 'points', actionPath, errors, (item) => Number.isInteger(item) && item > 0, 'deve ser um inteiro positivo')
    })
  })
  return { valid: errors.length === 0, errors }
}

export function assertMimicaDeck(value: unknown, expectedLocale?: SupportedLocale): MimicaDeck {
  const validation = validateMimicaDeck(value, expectedLocale)
  if (!validation.valid) throw new Error(validation.errors.join('\n'))
  return value as MimicaDeck
}

export function validateMimicaDeckParity(decks: MimicaDeck[]): ContentValidation {
  const errors: string[] = []
  const reference = decks[0]
  if (!reference) return { valid: false, errors: ['Nenhum baralho foi informado.'] }
  const referenceCardIds = reference.cards.map((card) => card.id)
  const referenceActionIds = reference.cards.map((card) => card.actions.map((action) => action.id).join('|')).join('||')
  decks.slice(1).forEach((deck) => {
    if (deck.schemaVersion !== reference.schemaVersion) errors.push(`${deck.locale}: schemaVersion diferente de ${reference.locale}.`)
    if (deck.gameId !== reference.gameId) errors.push(`${deck.locale}: gameId diferente de ${reference.locale}.`)
    if (deck.deckId !== reference.deckId) errors.push(`${deck.locale}: deckId diferente de ${reference.locale}.`)
    if (deck.version !== reference.version) errors.push(`${deck.locale}: version diferente de ${reference.locale}.`)
    if (deck.cards.map((card) => card.id).join('|') !== referenceCardIds.join('|')) errors.push(`${deck.locale}: os IDs e a ordem das cartas não correspondem a ${reference.locale}.`)
    if (deck.cards.map((card) => card.actions.map((action) => action.id).join('|')).join('||') !== referenceActionIds) errors.push(`${deck.locale}: os IDs e a ordem das ações não correspondem a ${reference.locale}.`)
    deck.cards.forEach((card) => {
      if (card.actions.length !== 3) errors.push(`${deck.locale}: a carta ${card.id} precisa ter 3 ações.`)
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
