import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import type { GameParticipant } from '../players/players.types'
import { getPistaUnicaTarget, pistaUnicaTargets } from './pistaUnica.content'
import { PISTA_UNICA_CATEGORIES, type PistaUnicaCategory, type PistaUnicaClue, type PistaUnicaRoundResult, type PistaUnicaSession } from './pistaUnica.types'

const phases = ['pass-clue', 'write-clue', 'review', 'guess', 'round-result', 'finished'] as const

export function createPistaUnicaSession(participants: GameParticipant[], selectedCategories: PistaUnicaCategory[], random: () => number = Math.random): PistaUnicaSession {
  if (participants.length < 3 || participants.length > 12) throw new Error('O jogo exige entre 3 e 12 participantes.')
  if (new Set(participants.map((participant) => participant.id)).size !== participants.length) throw new Error('Os participantes precisam ter IDs únicos.')
  const categories = normalizeCategories(selectedCategories)
  const eligibleTargets = pistaUnicaTargets.filter((target) => categories.includes(target.category))
  if (eligibleTargets.length < participants.length) throw new Error('Escolha categorias com desafios suficientes para a partida.')
  const targetQueue = shuffle(eligibleTargets.map((target) => target.id), random)
  const currentTargetId = targetQueue[0]!
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: createId('pista-unica'),
    gameId: 'pista-unica',
    phase: 'pass-clue',
    participants: [...participants],
    selectedCategories: categories,
    scores: Object.fromEntries(participants.map((participant) => [participant.id, 0])),
    round: 1,
    currentGuesserIndex: 0,
    currentTargetId,
    targetQueue: targetQueue.slice(1),
    usedTargetIds: [currentTargetId],
    clueOrder: clueOrderFor(participants, 0),
    clueIndex: 0,
    clues: [],
    lastRoundResult: null,
    roundResults: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function openPistaUnicaClue(session: PistaUnicaSession) {
  return session.phase === 'pass-clue' ? touch({ ...session, phase: 'write-clue' }) : session
}

export function addPistaUnicaClue(session: PistaUnicaSession, participantId: string, rawText: string) {
  if (session.phase !== 'write-clue' || session.clueOrder[session.clueIndex] !== participantId) return session
  const text = cleanClue(rawText)
  if (!text) return session
  const clues = [...session.clues, { id: createId('pista'), participantId, text, included: true }]
  if (session.clueIndex < session.clueOrder.length - 1) return touch({ ...session, clues, clueIndex: session.clueIndex + 1, phase: 'pass-clue' })
  return touch({ ...session, clues, phase: 'review' })
}

export function updatePistaUnicaClue(session: PistaUnicaSession, clueId: string, rawText: string) {
  if (session.phase !== 'review') return session
  const text = cleanClue(rawText)
  if (!text) return session
  const clues = session.clues.map((clue) => clue.id === clueId ? { ...clue, text } : clue)
  return touch({ ...session, clues })
}

export function togglePistaUnicaClue(session: PistaUnicaSession, clueId: string) {
  if (session.phase !== 'review') return session
  const clues = session.clues.map((clue) => clue.id === clueId ? { ...clue, included: !clue.included } : clue)
  return touch({ ...session, clues })
}

export function beginPistaUnicaGuess(session: PistaUnicaSession) {
  if (session.phase !== 'review' || getVisiblePistaUnicaClues(session.clues).length === 0) return session
  return touch({ ...session, phase: 'guess' })
}

export function finishPistaUnicaRound(session: PistaUnicaSession, correct: boolean) {
  if (session.phase !== 'guess') return session
  const guesser = session.participants[session.currentGuesserIndex]
  if (!guesser) return session
  const result: PistaUnicaRoundResult = { round: session.round, guesserId: guesser.id, targetId: session.currentTargetId, correct, clueCount: getVisiblePistaUnicaClues(session.clues).length }
  const scores = correct ? { ...session.scores, [guesser.id]: (session.scores[guesser.id] ?? 0) + 1 } : session.scores
  return touch({ ...session, scores, phase: 'round-result', lastRoundResult: result, roundResults: [...session.roundResults, result] })
}

export function continuePistaUnicaSession(session: PistaUnicaSession) {
  if (session.phase !== 'round-result') return session
  if (session.round >= session.participants.length) return touch({ ...session, phase: 'finished' })
  const [nextTargetId, ...targetQueue] = session.targetQueue
  if (!nextTargetId) return touch({ ...session, phase: 'finished' })
  const nextGuesserIndex = (session.currentGuesserIndex + 1) % session.participants.length
  return touch({
    ...session,
    phase: 'pass-clue',
    round: session.round + 1,
    currentGuesserIndex: nextGuesserIndex,
    currentTargetId: nextTargetId,
    targetQueue,
    usedTargetIds: [...session.usedTargetIds, nextTargetId],
    clueOrder: clueOrderFor(session.participants, nextGuesserIndex),
    clueIndex: 0,
    clues: [],
    lastRoundResult: null,
  })
}

export function getVisiblePistaUnicaClues(clues: PistaUnicaClue[]) {
  const seen = new Set<string>()
  return clues.filter((clue) => {
    if (!clue.included) return false
    const normalized = normalizeClue(clue.text)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

export function normalizeClue(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

export function getPistaUnicaWinners(session: PistaUnicaSession) {
  const score = Math.max(...session.participants.map((participant) => session.scores[participant.id] ?? 0))
  return session.participants.filter((participant) => (session.scores[participant.id] ?? 0) === score)
}

export function isPistaUnicaSession(value: unknown): value is PistaUnicaSession {
  if (!isRecord(value)) return false
  const session = value as Partial<PistaUnicaSession>
  const participantIds = new Set(session.participants?.map((participant) => participant.id))
  return session.schemaVersion === 1 && session.gameId === 'pista-unica'
    && typeof session.id === 'string'
    && Array.isArray(session.participants) && session.participants.length >= 3 && session.participants.length <= 12 && participantIds.size === session.participants.length
    && session.participants.every(isParticipant)
    && Array.isArray(session.selectedCategories) && normalizeCategories(session.selectedCategories).length === session.selectedCategories.length
    && typeof session.phase === 'string' && (phases as readonly string[]).includes(session.phase)
    && isScoreRecord(session.scores, participantIds)
    && Number.isInteger(session.round) && session.round! >= 1 && session.round! <= session.participants.length
    && Number.isInteger(session.currentGuesserIndex) && session.currentGuesserIndex! >= 0 && session.currentGuesserIndex! < session.participants.length
    && typeof session.currentTargetId === 'string' && Boolean(getPistaUnicaTarget(session.currentTargetId))
    && Array.isArray(session.targetQueue) && session.targetQueue.every((id) => typeof id === 'string' && Boolean(getPistaUnicaTarget(id)))
    && Array.isArray(session.usedTargetIds) && session.usedTargetIds.includes(session.currentTargetId)
    && Array.isArray(session.clueOrder) && session.clueOrder.length === session.participants.length - 1 && session.clueOrder.every((id) => participantIds.has(id))
    && Number.isInteger(session.clueIndex) && session.clueIndex! >= 0 && session.clueIndex! < session.clueOrder.length
    && Array.isArray(session.clues) && session.clues.every((clue) => isClue(clue, participantIds))
    && (session.lastRoundResult === null || isRoundResult(session.lastRoundResult, participantIds))
    && Array.isArray(session.roundResults) && session.roundResults.every((result) => isRoundResult(result, participantIds))
    && typeof session.createdAt === 'string' && typeof session.updatedAt === 'string'
}

function clueOrderFor(participants: GameParticipant[], guesserIndex: number) {
  const guesserId = participants[guesserIndex]?.id
  return participants.filter((participant) => participant.id !== guesserId).map((participant) => participant.id)
}

function normalizeCategories(categories: readonly PistaUnicaCategory[]) {
  return [...new Set(categories.filter((category): category is PistaUnicaCategory => PISTA_UNICA_CATEGORIES.includes(category)))]
}

function cleanClue(value: string) { return value.replace(/\s+/g, ' ').trim().slice(0, 48) }
function touch(session: PistaUnicaSession) { return { ...session, updatedAt: new Date().toISOString() } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function isParticipant(value: unknown): value is GameParticipant { return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.isGuest === 'boolean' }
function isClue(value: unknown, participantIds: Set<string | undefined>) { return isRecord(value) && typeof value.id === 'string' && typeof value.participantId === 'string' && participantIds.has(value.participantId) && typeof value.text === 'string' && typeof value.included === 'boolean' }
function isScoreRecord(value: unknown, participantIds: Set<string | undefined>) { return isRecord(value) && Object.keys(value).length === participantIds.size && [...participantIds].every((id) => typeof id === 'string' && typeof value[id] === 'number' && Number.isFinite(value[id])) }
function isRoundResult(value: unknown, participantIds: Set<string | undefined>) { return isRecord(value) && Number.isInteger(value.round) && typeof value.guesserId === 'string' && participantIds.has(value.guesserId) && typeof value.targetId === 'string' && Boolean(getPistaUnicaTarget(value.targetId)) && typeof value.correct === 'boolean' && Number.isInteger(value.clueCount) }
