import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import type { GameParticipant } from '../players/players.types'
import type { ImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.types'
import type { ImpostorDaPalavraAward, ImpostorDaPalavraBriefing, ImpostorDaPalavraConfig, ImpostorDaPalavraOpeningHistory, ImpostorDaPalavraRoundResult, ImpostorDaPalavraSession } from './impostorDaPalavra.types'
import { isImpostorLocalConfig } from './impostorSharedConfig'

const PHASES = ['role-pass', 'conversation-intro', 'clue-turn', 'discussion', 'accusation', 'final-guess', 'manual-score', 'round-summary', 'finished'] as const

export function createImpostorDaPalavraSession(
  participants: GameParticipant[],
  config: ImpostorDaPalavraConfig,
  deck: ImpostorDaPalavraDeck,
  random: () => number = Math.random,
  openingHistory: ImpostorDaPalavraOpeningHistory | null = null,
): ImpostorDaPalavraSession {
  assertSetup(participants, config, deck)
  const impostorQueue = createImpostorQueue(participants, random)
  const cardQueue = avoidFirst(shuffle(deck.cards.map((card) => card.id), random), openingHistory?.cardId)
  const [currentCardId, ...remainingCards] = cardQueue
  const speakingOrder = createSpeakingOrder(participants, openingHistory?.speakerIdentity, random)
  const now = new Date().toISOString()
  const base: ImpostorDaPalavraSession = {
    schemaVersion: 1,
    id: createId('impostor-da-palavra'),
    gameId: 'impostor-da-palavra',
    deckId: deck.deckId,
    deckVersion: deck.version,
    locale: deck.locale,
    phase: 'role-pass',
    participants: [...participants],
    config: { ...config },
    timerStartedAt: null,
    pendingFinalGuessCorrect: null,
    scores: Object.fromEntries(participants.map((participant) => [participant.id, 0])),
    round: 1,
    impostorQueue,
    currentImpostorId: impostorQueue[0],
    currentCardId,
    cardQueue: remainingCards,
    usedCardIds: [currentCardId],
    rolePassOrder: shuffle(participants.map((participant) => participant.id), random),
    rolePassIndex: 0,
    speakingOrder,
    clueTurnIndex: 0,
    questionAssignments: {},
    accusedParticipantId: null,
    lastRoundResult: null,
    createdAt: now,
    updatedAt: now,
  }
  return { ...base, questionAssignments: createQuestionAssignments(base, deck, random) }
}

export function participantIdentity(participant: GameParticipant) {
  return participant.sourcePlayerId ?? participant.id
}

export function getParticipantBriefing(session: ImpostorDaPalavraSession, deck: ImpostorDaPalavraDeck, participantId: string): ImpostorDaPalavraBriefing | null {
  if (!session.participants.some((participant) => participant.id === participantId)) return null
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  if (!card) return null
  if (participantId !== session.currentImpostorId) return { kind: 'word', word: card.word }
  if (session.config.impostorMode === 'no-word') return { kind: 'impostor' }
  if (session.config.impostorMode === 'hint') return { kind: 'impostor-hint', hint: card.impostorHint }
  return { kind: 'word', word: card.alternateWord }
}

export function advanceRolePass(session: ImpostorDaPalavraSession) {
  if (session.phase !== 'role-pass') return session
  if (session.rolePassIndex < session.rolePassOrder.length - 1) return touch({ ...session, rolePassIndex: session.rolePassIndex + 1 })
  return touch({ ...session, phase: 'conversation-intro' })
}

export function beginConversation(session: ImpostorDaPalavraSession) {
  if (session.phase !== 'conversation-intro') return session
  return touch({ ...session, phase: 'clue-turn', clueTurnIndex: 0,
    timerStartedAt: session.config.timerSeconds ? Date.now() : null })
}

export function advanceClueTurn(session: ImpostorDaPalavraSession) {
  if (session.phase !== 'clue-turn') return session
  if (session.clueTurnIndex < session.speakingOrder.length - 1) return touch({ ...session, clueTurnIndex: session.clueTurnIndex + 1 })
  return touch({ ...session, phase: 'discussion' })
}

export function beginAccusation(session: ImpostorDaPalavraSession) {
  if (session.phase !== 'discussion') return session
  return touch({ ...session, phase: 'accusation', accusedParticipantId: null })
}

export function selectAccusedParticipant(session: ImpostorDaPalavraSession, participantId: string) {
  if (session.phase !== 'accusation' || !session.participants.some((participant) => participant.id === participantId)) return session
  return touch({ ...session, accusedParticipantId: participantId })
}

export function confirmAccusation(session: ImpostorDaPalavraSession) {
  if (session.phase !== 'accusation' || !session.accusedParticipantId) return session
  if (session.config.scoringMode === 'individual') return touch({ ...session, phase: 'final-guess' })
  if (session.accusedParticipantId === session.currentImpostorId) return touch({ ...session, phase: 'final-guess' })
  return finishRound(session, false, null, [{ participantId: session.currentImpostorId, points: 2 }])
}

export function recordFinalGuess(session: ImpostorDaPalavraSession, correct: boolean) {
  if (session.phase !== 'final-guess' || !session.accusedParticipantId) return session
  if (session.config.scoringMode === 'individual') return touch({ ...session, phase: 'manual-score', pendingFinalGuessCorrect: correct })
  const awards: ImpostorDaPalavraAward[] = correct
    ? [{ participantId: session.currentImpostorId, points: 2 }]
    : session.participants.filter((participant) => participant.id !== session.currentImpostorId).map((participant) => ({ participantId: participant.id, points: 1 }))
  return finishRound(session, true, correct, awards)
}

/** One-phone votes remain verbal; a moderator marks only who voted correctly, after guessing. */
export function recordManualVoteWinners(session: ImpostorDaPalavraSession, correctVoterIds: string[]) {
  if (session.phase !== 'manual-score' || session.config.scoringMode !== 'individual') return session
  const ids = new Set(correctVoterIds)
  if (ids.size !== correctVoterIds.length || ids.has(session.currentImpostorId)
    || [...ids].some(id => !session.participants.some(person => person.id === id))) return session
  const majority = ids.size > session.participants.length / 2
  const awards: ImpostorDaPalavraAward[] = session.participants.map(person => ({
    participantId: person.id,
    points: person.id === session.currentImpostorId
      ? Number(session.accusedParticipantId !== session.currentImpostorId) + Number(session.pendingFinalGuessCorrect === true)
      : ids.has(person.id) ? majority ? 2 : 1 : 0,
  })).filter(award => award.points > 0)
  return finishRound(session, session.accusedParticipantId === session.currentImpostorId,
    session.pendingFinalGuessCorrect === true, awards)
}

/** Organizer may change the shared question before conversation starts. */
export function nextSharedQuestion(session: ImpostorDaPalavraSession, deck: ImpostorDaPalavraDeck) {
  if (session.phase !== 'conversation-intro' || session.config.conversationMode !== 'guided-questions') return session
  const card = deck.cards.find(item => item.id === session.currentCardId)
  if (!card || card.questionIds.length < 2) return session
  const currentId = Object.values(session.questionAssignments)[0]
  const index = card.questionIds.indexOf(currentId)
  const nextId = card.questionIds[(index + 1) % card.questionIds.length]
  return touch({ ...session, questionAssignments:
    Object.fromEntries(session.participants.map(person => [person.id, nextId])) })
}

export function drawFirstSpeaker(session: ImpostorDaPalavraSession, random: () => number = Math.random) {
  if (session.phase !== 'conversation-intro' || session.speakingOrder.length < 2) return session
  const speakingOrder = [...session.speakingOrder]
  const index = 1 + Math.min(speakingOrder.length - 2, Math.max(0, Math.floor(random() * (speakingOrder.length - 1))))
  ;[speakingOrder[0], speakingOrder[index]] = [speakingOrder[index], speakingOrder[0]]
  return touch({ ...session, speakingOrder })
}

export function continueAfterRound(session: ImpostorDaPalavraSession, deck: ImpostorDaPalavraDeck, random: () => number = Math.random) {
  if (session.phase !== 'round-summary' || !session.lastRoundResult) return session
  if (session.round >= session.participants.length) return touch({ ...session, phase: 'finished' })
  const [currentCardId, ...cardQueue] = session.cardQueue
  if (!currentCardId) return touch({ ...session, phase: 'finished' })
  const speakingOrder = createSpeakingOrder(session.participants, participantIdentityById(session, session.speakingOrder[0]), random)
  const next: ImpostorDaPalavraSession = {
    ...session,
    phase: 'role-pass',
    round: session.round + 1,
    currentImpostorId: session.impostorQueue[session.round],
    currentCardId,
    cardQueue,
    usedCardIds: [...session.usedCardIds, currentCardId],
    rolePassOrder: shuffle(session.participants.map((participant) => participant.id), random),
    rolePassIndex: 0,
    speakingOrder,
    clueTurnIndex: 0,
    questionAssignments: {},
    accusedParticipantId: null,
    lastRoundResult: null,
    timerStartedAt: null,
    pendingFinalGuessCorrect: null,
  }
  return touch({ ...next, questionAssignments: createQuestionAssignments(next, deck, random) })
}

export function rankParticipants(session: ImpostorDaPalavraSession) {
  return [...session.participants].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))
}

export function getWinners(session: ImpostorDaPalavraSession) {
  const highestScore = Math.max(...session.participants.map((participant) => session.scores[participant.id] ?? 0))
  return session.participants.filter((participant) => (session.scores[participant.id] ?? 0) === highestScore)
}

export function isOpeningHistory(value: unknown): value is ImpostorDaPalavraOpeningHistory {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1 && typeof value.cardId === 'string' && typeof value.speakerIdentity === 'string'
}

export function isSessionCompatible(value: unknown, deck: ImpostorDaPalavraDeck): value is ImpostorDaPalavraSession {
  if (!isRecord(value)) return false
  const session = value as Partial<ImpostorDaPalavraSession>
  if (!Array.isArray(session.participants) || session.participants.length < 3 || session.participants.length > 12) return false
  const participantIds = session.participants.map((participant) => participant?.id)
  if (participantIds.some((id) => typeof id !== 'string') || new Set(participantIds).size !== participantIds.length) return false
  const ids = new Set(participantIds as string[])
  const cardIds = new Set(deck.cards.map((card) => card.id))
  const questionIds = new Set(deck.questions.map((question) => question.id))
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  const validAssignments = isRecord(session.questionAssignments)
    && !!card
    && Object.entries(session.questionAssignments).every(([participantId, questionId]) => ids.has(participantId) && typeof questionId === 'string' && questionIds.has(questionId) && card.questionIds.includes(questionId))
  return Boolean(session.schemaVersion === 1
    && session.gameId === 'impostor-da-palavra'
    && session.deckId === deck.deckId
    && session.deckVersion === deck.version
    && session.locale === deck.locale
    && typeof session.id === 'string'
    && session.participants.every(isParticipant)
    && isConfig(session.config)
    && (session.timerStartedAt === undefined || session.timerStartedAt === null
      || (typeof session.timerStartedAt === 'number' && Number.isFinite(session.timerStartedAt) && session.timerStartedAt >= 0))
    && (session.pendingFinalGuessCorrect === undefined || session.pendingFinalGuessCorrect === null || typeof session.pendingFinalGuessCorrect === 'boolean')
    && isScoreRecord(session.scores, ids)
    && typeof session.phase === 'string' && (PHASES as readonly string[]).includes(session.phase)
    && Number.isInteger(session.round) && session.round! >= 1 && session.round! <= session.participants.length
    && isParticipantIdList(session.impostorQueue, ids, session.participants.length)
    && typeof session.currentImpostorId === 'string' && session.currentImpostorId === session.impostorQueue?.[session.round! - 1]
    && typeof session.currentCardId === 'string' && cardIds.has(session.currentCardId)
    && isUniqueIdList(session.cardQueue, cardIds)
    && isUniqueIdList(session.usedCardIds, cardIds) && session.usedCardIds?.includes(session.currentCardId)
    && !(session.cardQueue ?? []).some((id) => session.usedCardIds?.includes(id))
    && isPermutation(session.rolePassOrder, ids)
    && Number.isInteger(session.rolePassIndex) && session.rolePassIndex! >= 0 && session.rolePassIndex! < session.participants.length
    && isPermutation(session.speakingOrder, ids)
    && Number.isInteger(session.clueTurnIndex) && session.clueTurnIndex! >= 0 && session.clueTurnIndex! < session.participants.length
    && validAssignments
    && (session.config?.conversationMode === 'one-word' ? Object.keys(session.questionAssignments ?? {}).length === 0 : Object.keys(session.questionAssignments ?? {}).length === session.participants.length)
    && (session.accusedParticipantId === null || (typeof session.accusedParticipantId === 'string' && ids.has(session.accusedParticipantId)))
    && isRoundResult(session.lastRoundResult, ids, cardIds)
    && typeof session.createdAt === 'string'
    && typeof session.updatedAt === 'string')
}

function finishRound(session: ImpostorDaPalavraSession, accusationCorrect: boolean, finalGuessCorrect: boolean | null, awards: ImpostorDaPalavraAward[]) {
  const scores = { ...session.scores }
  for (const award of awards) scores[award.participantId] = (scores[award.participantId] ?? 0) + award.points
  const lastRoundResult: ImpostorDaPalavraRoundResult = {
    round: session.round,
    cardId: session.currentCardId,
    impostorId: session.currentImpostorId,
    accusedParticipantId: session.accusedParticipantId!,
    accusationCorrect,
    finalGuessCorrect,
    awards,
  }
  return touch({ ...session, scores, phase: 'round-summary', lastRoundResult })
}

function createSpeakingOrder(participants: GameParticipant[], previousIdentity: string | undefined, random: () => number) {
  const shuffled = shuffle(participants.map((participant) => participant.id), random)
  if (!previousIdentity || shuffled.length < 2) return shuffled
  const first = participants.find((participant) => participant.id === shuffled[0])
  if (!first || participantIdentity(first) !== previousIdentity) return shuffled
  const replacementIndex = shuffled.findIndex((id) => {
    const participant = participants.find((item) => item.id === id)
    return participant && participantIdentity(participant) !== previousIdentity
  })
  if (replacementIndex <= 0) return shuffled
  ;[shuffled[0], shuffled[replacementIndex]] = [shuffled[replacementIndex], shuffled[0]]
  return shuffled
}

function createQuestionAssignments(session: ImpostorDaPalavraSession, deck: ImpostorDaPalavraDeck, random: () => number) {
  if (session.config.conversationMode === 'one-word') return {}
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  if (!card || card.questionIds.length < session.participants.length) throw new Error('A palavra não possui perguntas suficientes para todos os participantes.')
  const question = shuffle(card.questionIds, random)[0]
  return Object.fromEntries(session.speakingOrder.map(participantId => [participantId, question]))
}

function createImpostorQueue(participants: GameParticipant[], random: () => number) {
  return Array.from({ length: participants.length }, () => shuffle(participants.map((participant) => participant.id), random)[0])
}

function assertSetup(participants: GameParticipant[], config: ImpostorDaPalavraConfig, deck: ImpostorDaPalavraDeck) {
  if (participants.length < 3 || participants.length > 12) throw new Error('O jogo exige entre 3 e 12 participantes.')
  if (new Set(participants.map((participant) => participant.id)).size !== participants.length) throw new Error('Os participantes precisam ter IDs únicos.')
  if (!isConfig(config)) throw new Error('A configuração do jogo é inválida.')
  if (deck.cards.length < participants.length) throw new Error('O baralho não possui palavras suficientes para a partida.')
  if (config.conversationMode === 'guided-questions' && deck.cards.some((card) => new Set(card.questionIds).size < participants.length)) {
    throw new Error('Todas as palavras precisam ter perguntas suficientes para os participantes.')
  }
}

function avoidFirst(items: string[], previousId: string | undefined) {
  if (!previousId || items.length < 2 || items[0] !== previousId) return items
  const replacementIndex = items.findIndex((item) => item !== previousId)
  if (replacementIndex <= 0) return items
  ;[items[0], items[replacementIndex]] = [items[replacementIndex], items[0]]
  return items
}

function participantIdentityById(session: ImpostorDaPalavraSession, participantId: string) {
  const participant = session.participants.find((item) => item.id === participantId)
  return participant ? participantIdentity(participant) : undefined
}

function isConfig(value: unknown): value is ImpostorDaPalavraConfig {
  return isImpostorLocalConfig(value)
}

function isParticipant(value: unknown): value is GameParticipant {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.isGuest === 'boolean'
}

function isScoreRecord(value: unknown, participantIds: Set<string>) {
  if (!isRecord(value) || Object.keys(value).length !== participantIds.size) return false
  return [...participantIds].every((id) => typeof value[id] === 'number' && Number.isFinite(value[id]) && (value[id] as number) >= 0)
}

function isPermutation(value: unknown, expectedIds: Set<string>) {
  return Array.isArray(value) && value.length === expectedIds.size && new Set(value).size === expectedIds.size && value.every((id) => typeof id === 'string' && expectedIds.has(id))
}

function isParticipantIdList(value: unknown, expectedIds: Set<string>, expectedLength: number) {
  return Array.isArray(value) && value.length === expectedLength && value.every((id) => typeof id === 'string' && expectedIds.has(id))
}

function isUniqueIdList(value: unknown, validIds: Set<string>) {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && validIds.has(id))
}

function isRoundResult(value: unknown, participantIds: Set<string>, cardIds: Set<string>) {
  if (value === null) return true
  if (!isRecord(value) || !Array.isArray(value.awards)) return false
  return Number.isInteger(value.round)
    && typeof value.cardId === 'string' && cardIds.has(value.cardId)
    && typeof value.impostorId === 'string' && participantIds.has(value.impostorId)
    && typeof value.accusedParticipantId === 'string' && participantIds.has(value.accusedParticipantId)
    && typeof value.accusationCorrect === 'boolean'
    && (value.finalGuessCorrect === null || typeof value.finalGuessCorrect === 'boolean')
    && value.awards.every((award) => isRecord(award) && typeof award.participantId === 'string' && participantIds.has(award.participantId) && typeof award.points === 'number' && award.points > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function touch(session: ImpostorDaPalavraSession): ImpostorDaPalavraSession {
  return { ...session, updatedAt: new Date().toISOString() }
}
