import { createId } from '../../lib/utils/createId'
import type { QuemSouEuSession, QuemSouEuWord } from './quemSouEu.types'

const maxWords = 5
const countdownSeconds = 5

export function normalizeQuemSouEuWords(words: string[]) {
  return words
    .map((word) => word.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxWords)
}

export function createQuemSouEuSession(words: string[], now = new Date()): QuemSouEuSession {
  const normalizedWords = normalizeQuemSouEuWords(words)
  if (!normalizedWords.length) throw new Error('Informe pelo menos uma palavra.')
  const timestamp = now.toISOString()
  return {
    schemaVersion: 1,
    id: createId('quem-sou-eu-session'),
    gameId: 'quem-sou-eu',
    phase: 'countdown',
    words: normalizedWords.map<QuemSouEuWord>((text) => ({ id: createId('quem-sou-eu-word'), text, status: null })),
    currentIndex: 0,
    countdownSeconds,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function revealQuemSouEuWord(session: QuemSouEuSession, now = new Date()): QuemSouEuSession {
  if (session.phase !== 'countdown') return session
  return touch({ ...session, phase: 'revealed' }, now)
}

export function markQuemSouEuCorrect(session: QuemSouEuSession, now = new Date()): QuemSouEuSession {
  return markCurrentWord(session, 'correct', now)
}

export function skipQuemSouEuWord(session: QuemSouEuSession, now = new Date()): QuemSouEuSession {
  return markCurrentWord(session, 'skipped', now)
}

export function getQuemSouEuSummary(session: QuemSouEuSession) {
  return {
    correct: session.words.filter((word) => word.status === 'correct').length,
    skipped: session.words.filter((word) => word.status === 'skipped').length,
    total: session.words.length,
  }
}

export function isQuemSouEuSession(value: unknown): value is QuemSouEuSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<QuemSouEuSession>
  return session.schemaVersion === 1
    && session.gameId === 'quem-sou-eu'
    && (session.phase === 'countdown' || session.phase === 'revealed' || session.phase === 'summary')
    && typeof session.currentIndex === 'number'
    && session.countdownSeconds === countdownSeconds
    && Array.isArray(session.words)
    && session.words.length >= 1
    && session.words.length <= maxWords
    && session.words.every((word) => isQuemSouEuWord(word))
}

function markCurrentWord(session: QuemSouEuSession, status: QuemSouEuWord['status'], now: Date) {
  if (session.phase !== 'revealed') return session
  const words = session.words.map((word, index) => index === session.currentIndex ? { ...word, status } : word)
  const nextIndex = session.currentIndex + 1
  return touch({
    ...session,
    words,
    currentIndex: Math.min(nextIndex, words.length - 1),
    phase: nextIndex >= words.length ? 'summary' : 'countdown',
  }, now)
}

function touch(session: QuemSouEuSession, now: Date): QuemSouEuSession {
  return { ...session, updatedAt: now.toISOString() }
}

function isQuemSouEuWord(value: unknown): value is QuemSouEuWord {
  if (!value || typeof value !== 'object') return false
  const word = value as Partial<QuemSouEuWord>
  return typeof word.id === 'string'
    && typeof word.text === 'string'
    && word.text.trim().length > 0
    && (word.status === null || word.status === 'correct' || word.status === 'skipped')
}
