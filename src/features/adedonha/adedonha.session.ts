import { createId } from '../../lib/utils/createId'
import type { AdedonhaCategory, AdedonhaScore, AdedonhaSession, AdedonhaSharePayload } from './adedonha.types'

export const adedonhaLetters = 'ABCDEFGHIJKLMNOPRSTUV'.split('')

export const defaultAdedonhaCategories = [
  'Nome',
  'Animal',
  'Cidade',
  'Fruta',
  'Objeto',
  'Comida',
  'Filme ou série',
  'Profissão',
]

export const funAdedonhaCategories = [
  'Minha sogra é...',
  'Desculpa esfarrapada',
  'Coisa que dá vergonha',
  'Algo que ninguém pesquisa no Google',
  'Nome de golpe',
  'Pessoa que chega atrasada',
  'Coisa de festa ruim',
  'Motivo para terminar',
  'Algo que dá medo no boleto',
  'Apelido de amigo',
  'Lugar para não levar o crush',
  'Coisa que parece rica mas é pobre',
  'Frase de quem perdeu',
  'Algo que todo mundo finge entender',
  'Presente duvidoso',
  'Comida que divide opiniões',
]

export function normalizeAdedonhaCategories(categories: string[]) {
  const seen = new Set<string>()
  return categories
    .map((category) => category.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((category) => {
      const key = category.toLocaleLowerCase('pt-BR')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 16)
}

export function createAdedonhaSession(categories: string[], letter = drawAdedonhaLetter(), now = new Date()): AdedonhaSession {
  const normalized = normalizeAdedonhaCategories(categories)
  if (!normalized.length) throw new Error('Adicione pelo menos um tema.')
  const timestamp = now.toISOString()
  return {
    schemaVersion: 1,
    id: createId('adedonha-session'),
    gameId: 'adedonha',
    phase: 'choosing-letter',
    categories: normalized.map<AdedonhaCategory>((title) => ({ id: createId('adedonha-category'), title })),
    letter,
    answers: {},
    scores: {},
    rounds: [],
    playerName: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateAdedonhaAnswer(session: AdedonhaSession, categoryId: string, answer: string, now = new Date()): AdedonhaSession {
  return { ...session, answers: { ...session.answers, [categoryId]: answer }, updatedAt: now.toISOString() }
}

export function updateAdedonhaScore(session: AdedonhaSession, categoryId: string, score: AdedonhaScore, now = new Date()): AdedonhaSession {
  return { ...session, scores: { ...session.scores, [categoryId]: score }, updatedAt: now.toISOString() }
}

export function updateAdedonhaPlayerName(session: AdedonhaSession, playerName: string, now = new Date()): AdedonhaSession {
  return { ...session, playerName: playerName.replace(/\s+/g, ' ').trimStart().slice(0, 32), updatedAt: now.toISOString() }
}

export function drawAdedonhaLetter(random: () => number = Math.random) {
  return adedonhaLetters[Math.floor(random() * adedonhaLetters.length)] ?? 'A'
}

export function changeAdedonhaLetter(session: AdedonhaSession, random: () => number = Math.random, now = new Date()): AdedonhaSession {
  const next = drawAdedonhaLetter(random)
  return { ...session, letter: next === session.letter && adedonhaLetters.length > 1 ? adedonhaLetters[(adedonhaLetters.indexOf(next) + 1) % adedonhaLetters.length] : next, answers: {}, scores: {}, phase: 'choosing-letter', updatedAt: now.toISOString() }
}

export function selectAdedonhaLetter(session: AdedonhaSession, letter: string, now = new Date()): AdedonhaSession {
  const normalized = letter.slice(0, 1).toLocaleUpperCase('pt-BR')
  return { ...session, letter: adedonhaLetters.includes(normalized) ? normalized : session.letter, answers: {}, scores: {}, phase: 'choosing-letter', updatedAt: now.toISOString() }
}

export function beginAdedonhaAnswers(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  return { ...session, phase: 'answering', updatedAt: now.toISOString() }
}

export function beginAdedonhaScoring(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  const scores = Object.fromEntries(session.categories.map((category) => [category.id, session.answers[category.id]?.trim() ? 10 : 0])) as Record<string, AdedonhaScore>
  return { ...session, phase: 'scoring', scores: { ...scores, ...session.scores }, updatedAt: now.toISOString() }
}

export function finishAdedonhaScoring(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  const timestamp = now.toISOString()
  const round = {
    id: createId('adedonha-round'),
    letter: session.letter,
    answers: session.answers,
    scores: session.scores,
    total: getAdedonhaRoundTotal(session),
    finishedAt: timestamp,
  }
  return { ...session, phase: 'summary', rounds: [...session.rounds, round], updatedAt: timestamp }
}

export function restartAdedonhaRound(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  return { ...session, phase: 'choosing-letter', letter: drawAdedonhaLetter(), answers: {}, scores: {}, updatedAt: now.toISOString() }
}

export function finishAdedonhaMatch(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  return { ...session, phase: 'finished', updatedAt: now.toISOString() }
}

export function clearAdedonhaAnswers(session: AdedonhaSession, now = new Date()): AdedonhaSession {
  return { ...session, answers: {}, scores: {}, phase: 'answering', updatedAt: now.toISOString() }
}

export function getAdedonhaRoundTotal(session: AdedonhaSession) {
  return session.categories.reduce((total, category) => total + (session.scores[category.id] ?? 0), 0)
}

export function getAdedonhaMatchTotal(session: AdedonhaSession) {
  return session.rounds.reduce((total, round) => total + round.total, 0)
}

export function encodeAdedonhaShare(categories: AdedonhaCategory[], letter: string) {
  const payload: AdedonhaSharePayload = { v: 1, c: categories.map((category) => category.title), l: letter }
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
}

export function decodeAdedonhaShare(code: string): AdedonhaSharePayload | null {
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as Partial<AdedonhaSharePayload>
    if (payload.v !== 1 || typeof payload.l !== 'string' || !Array.isArray(payload.c)) return null
    const categories = normalizeAdedonhaCategories(payload.c.filter((item): item is string => typeof item === 'string'))
    if (!categories.length) return null
    return { v: 1, c: categories, l: payload.l.slice(0, 1).toLocaleUpperCase('pt-BR') || 'A' }
  } catch {
    return null
  }
}

export function isAdedonhaSession(value: unknown): value is AdedonhaSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AdedonhaSession>
  return session.schemaVersion === 1
    && session.gameId === 'adedonha'
    && Array.isArray(session.categories)
    && session.categories.length > 0
    && typeof session.letter === 'string'
    && typeof session.answers === 'object'
    && (session.phase === undefined || session.phase === 'choosing-letter' || session.phase === 'answering' || session.phase === 'scoring' || session.phase === 'summary' || session.phase === 'finished')
}
