import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import { normalizePlayerName } from '../players/players.model'
import type { GameParticipant } from '../players/players.types'
import type { TabooDeck } from './content/tabooContent.types'
import type { TabooConfig, TabooFinishedReason, TabooOpeningHistory, TabooSession, TabooSkipLimit, TabooTeam, TabooTurnResult } from './taboo.types'

const PHASES = ['turn-intro', 'playing', 'turn-summary', 'finished'] as const
const MODES = ['individual', 'teams'] as const
const DURATIONS = [30, 60, 90, 120] as const
const SKIP_LIMITS: TabooSkipLimit[] = ['unlimited', 1, 3, 5]
const FINISHED_REASONS = ['turns-complete', 'deck-exhausted'] as const

export function createTabooSession(
  participants: GameParticipant[],
  teams: TabooTeam[],
  config: TabooConfig,
  deck: TabooDeck,
  random: () => number = Math.random,
  openingHistory: TabooOpeningHistory | null = null,
): TabooSession {
  assertSetup(participants, teams, config, deck)
  const entities = config.mode === 'individual' ? participants.map((participant) => participant.id) : teams.map((team) => team.id)
  const shuffledEntities = avoidFirst(shuffle(entities, random), openingHistory?.entityIdentity, (id) => entityIdentity(id, participants, teams))
  const turnQueue = Array.from({ length: config.roundsPerEntity }).flatMap(() => shuffledEntities)
  const cardIds = avoidFirst(shuffle(deck.cards.map((card) => card.id), random), openingHistory?.cardId, (id) => id)
  const [currentCardId, ...cardQueue] = cardIds
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: createId('taboo'),
    gameId: 'taboo',
    deckId: deck.deckId,
    deckVersion: deck.version,
    locale: deck.locale,
    phase: 'turn-intro',
    participants: [...participants],
    teams: [...teams],
    config: { ...config },
    scores: Object.fromEntries(entities.map((id) => [id, 0])),
    turnQueue,
    currentTurnIndex: 0,
    currentCardId: currentCardId ?? null,
    cardQueue,
    usedCardIds: currentCardId ? [currentCardId] : [],
    turnStartedAt: null,
    currentTurnCorrect: 0,
    skipsUsedThisTurn: 0,
    lastTurnResult: null,
    pendingFinishedReason: currentCardId ? null : 'deck-exhausted',
    finishedReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function beginTabooTurn(session: TabooSession, now: Date = new Date()) {
  if (session.phase !== 'turn-intro' || !session.currentCardId) return session
  return touch({ ...session, phase: 'playing', turnStartedAt: now.toISOString() })
}

export function recordCorrectGuess(session: TabooSession, guesserId?: string) {
  if (session.phase !== 'playing') return session
  const currentEntityId = getCurrentEntityId(session)
  if (!currentEntityId) return session
  const scoringId = session.config.mode === 'individual' ? guesserId : currentEntityId
  if (!scoringId || !canScore(session, scoringId)) return session
  const scores = { ...session.scores, [scoringId]: (session.scores[scoringId] ?? 0) + 1 }
  const advanced = advanceCard({ ...session, scores, currentTurnCorrect: session.currentTurnCorrect + 1 })
  if (!advanced.currentCardId) return finishTurn(advanced, 'deck-exhausted')
  return touch(advanced)
}

export function skipTabooCard(session: TabooSession) {
  if (session.phase !== 'playing' || !canSkip(session)) return session
  const advanced = advanceCard({ ...session, skipsUsedThisTurn: session.skipsUsedThisTurn + 1 })
  if (!advanced.currentCardId) return finishTurn(advanced, 'deck-exhausted')
  return touch(advanced)
}

export function endTabooTurn(session: TabooSession, reason?: TabooFinishedReason) {
  if (session.phase !== 'playing') return session
  const advanced = session.currentCardId ? advanceCard(session) : session
  const finishedReason = reason ?? (!advanced.currentCardId ? 'deck-exhausted' : nextTurnIndex(advanced) >= advanced.turnQueue.length ? 'turns-complete' : null)
  return finishTurn(advanced, finishedReason)
}

export function finishExpiredTurn(session: TabooSession, now: Date = new Date()) {
  if (session.phase !== 'playing' || getRemainingSeconds(session, now) > 0) return session
  return endTabooTurn(session)
}

export function continueAfterTabooSummary(session: TabooSession) {
  if (session.phase !== 'turn-summary' || !session.lastTurnResult) return session
  if (session.pendingFinishedReason) return touch({ ...session, phase: 'finished', finishedReason: session.pendingFinishedReason, pendingFinishedReason: null })
  return touch({
    ...session,
    phase: 'turn-intro',
    currentTurnIndex: nextTurnIndex(session),
    turnStartedAt: null,
    currentTurnCorrect: 0,
    skipsUsedThisTurn: 0,
    lastTurnResult: null,
  })
}

export function getRemainingSeconds(session: TabooSession, now: Date = new Date()) {
  if (session.phase !== 'playing' || !session.turnStartedAt) return session.config.turnDurationSeconds
  const elapsed = Math.floor((now.getTime() - new Date(session.turnStartedAt).getTime()) / 1000)
  return Math.max(0, session.config.turnDurationSeconds - elapsed)
}

export function canSkip(session: TabooSession) {
  if (session.phase !== 'playing' || !session.config.allowSkips) return false
  return session.config.skipLimit === 'unlimited' || session.skipsUsedThisTurn < session.config.skipLimit
}

export function getSkipsRemaining(session: TabooSession) {
  if (!session.config.allowSkips) return 0
  if (session.config.skipLimit === 'unlimited') return Infinity
  return Math.max(0, session.config.skipLimit - session.skipsUsedThisTurn)
}

export function getCurrentEntityId(session: TabooSession) {
  return session.turnQueue[session.currentTurnIndex] ?? null
}

export function getCurrentEntityName(session: TabooSession) {
  const id = getCurrentEntityId(session)
  if (!id) return ''
  if (session.config.mode === 'individual') return session.participants.find((participant) => participant.id === id)?.name ?? ''
  return session.teams.find((team) => team.id === id)?.name ?? ''
}

export function getEligibleGuessers(session: TabooSession) {
  const currentEntityId = getCurrentEntityId(session)
  return session.participants.filter((participant) => participant.id !== currentEntityId)
}

export function rankTabooEntities(session: TabooSession) {
  const entities = session.config.mode === 'individual' ? session.participants : session.teams
  return [...entities].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))
}

export function getTabooWinners(session: TabooSession) {
  const ranking = rankTabooEntities(session)
  const topScore = session.scores[ranking[0]?.id] ?? 0
  return ranking.filter((entity) => (session.scores[entity.id] ?? 0) === topScore)
}

export function entityIdentity(id: string, participants: GameParticipant[], teams: TabooTeam[]) {
  const participant = participants.find((item) => item.id === id)
  if (participant) return participant.sourcePlayerId ?? `guest:${normalizePlayerName(participant.name).toLocaleLowerCase('pt-BR')}`
  const team = teams.find((item) => item.id === id)
  return team ? `team:${normalizePlayerName(team.name).toLocaleLowerCase('pt-BR')}` : id
}

export function isTabooOpeningHistory(value: unknown): value is TabooOpeningHistory {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1 && typeof value.cardId === 'string' && typeof value.entityIdentity === 'string'
}

export function isTabooSessionCompatible(value: unknown, deck: TabooDeck): value is TabooSession {
  if (!isRecord(value)) return false
  const session = value as Partial<TabooSession>
  if (!isConfig(session.config)) return false
  const participants = Array.isArray(session.participants) ? session.participants : []
  const teams = Array.isArray(session.teams) ? session.teams : []
  const entityIds = new Set(session.config.mode === 'individual' ? participants.map((participant) => participant?.id) : teams.map((team) => team?.id))
  const cardIds = new Set(deck.cards.map((card) => card.id))
  return Boolean(session.schemaVersion === 1
    && session.gameId === 'taboo'
    && session.deckId === deck.deckId
    && session.deckVersion === deck.version
    && session.locale === deck.locale
    && typeof session.id === 'string'
    && participants.every(isParticipant)
    && teams.every(isTeam)
    && entityIds.size === (session.config.mode === 'individual' ? participants.length : teams.length)
    && isScoreRecord(session.scores, entityIds)
    && typeof session.phase === 'string' && (PHASES as readonly string[]).includes(session.phase)
    && isEntityList(session.turnQueue, entityIds)
    && Number.isInteger(session.currentTurnIndex) && session.currentTurnIndex! >= 0 && session.currentTurnIndex! < session.turnQueue!.length
    && (session.currentCardId === null || (typeof session.currentCardId === 'string' && cardIds.has(session.currentCardId)))
    && isUniqueIdList(session.cardQueue, cardIds)
    && isUniqueIdList(session.usedCardIds, cardIds)
    && (session.currentCardId === null || session.usedCardIds?.includes(session.currentCardId))
    && (session.turnStartedAt === null || typeof session.turnStartedAt === 'string')
    && Number.isInteger(session.currentTurnCorrect) && session.currentTurnCorrect! >= 0
    && Number.isInteger(session.skipsUsedThisTurn) && session.skipsUsedThisTurn! >= 0
    && isTurnResult(session.lastTurnResult, entityIds)
    && (session.pendingFinishedReason === null || (typeof session.pendingFinishedReason === 'string' && (FINISHED_REASONS as readonly string[]).includes(session.pendingFinishedReason)))
    && (session.finishedReason === null || (typeof session.finishedReason === 'string' && (FINISHED_REASONS as readonly string[]).includes(session.finishedReason)))
    && typeof session.createdAt === 'string'
    && typeof session.updatedAt === 'string')
}

function advanceCard(session: TabooSession): TabooSession {
  const [currentCardId, ...cardQueue] = session.cardQueue
  return {
    ...session,
    currentCardId: currentCardId ?? null,
    cardQueue,
    usedCardIds: currentCardId ? [...session.usedCardIds, currentCardId] : session.usedCardIds,
  }
}

function finishTurn(session: TabooSession, finishedReason: TabooFinishedReason | null) {
  const entityId = getCurrentEntityId(session) ?? ''
  const result: TabooTurnResult = {
    turn: session.currentTurnIndex + 1,
    entityId,
    correct: session.currentTurnCorrect,
    skips: session.skipsUsedThisTurn,
    points: session.currentTurnCorrect,
  }
  const pendingFinishedReason = finishedReason ?? (nextTurnIndex(session) >= session.turnQueue.length ? 'turns-complete' : null)
  return touch({ ...session, phase: 'turn-summary', turnStartedAt: null, lastTurnResult: result, pendingFinishedReason })
}

function nextTurnIndex(session: TabooSession) {
  return session.currentTurnIndex + 1
}

function canScore(session: TabooSession, scoringId: string) {
  if (session.config.mode === 'individual') return session.participants.some((participant) => participant.id === scoringId) && scoringId !== getCurrentEntityId(session)
  return session.teams.some((team) => team.id === scoringId)
}

function assertSetup(participants: GameParticipant[], teams: TabooTeam[], config: TabooConfig, deck: TabooDeck) {
  if (!isConfig(config)) throw new Error('A configuração do jogo é inválida.')
  if (config.mode === 'individual' && (participants.length < 2 || participants.length > 12)) throw new Error('Selecione entre 2 e 12 jogadores.')
  if (config.mode === 'teams' && teams.length < 2) throw new Error('Crie pelo menos 2 times.')
  if (config.mode === 'teams' && new Set(teams.map((team) => normalizePlayerName(team.name).toLocaleLowerCase('pt-BR'))).size !== teams.length) throw new Error('Os times precisam ter nomes diferentes.')
  if (deck.cards.length < Math.max(1, participants.length, teams.length)) throw new Error('O baralho não possui cartas suficientes.')
}

function avoidFirst(items: string[], previousIdentity: string | undefined, identityFor: (id: string) => string) {
  if (!previousIdentity || items.length < 2 || identityFor(items[0]) !== previousIdentity) return items
  const replacementIndex = items.findIndex((item) => identityFor(item) !== previousIdentity)
  if (replacementIndex <= 0) return items
  ;[items[0], items[replacementIndex]] = [items[replacementIndex], items[0]]
  return items
}

function isConfig(value: unknown): value is TabooConfig {
  if (!isRecord(value)) return false
  return typeof value.mode === 'string' && (MODES as readonly string[]).includes(value.mode)
    && typeof value.turnDurationSeconds === 'number' && (DURATIONS as readonly number[]).includes(value.turnDurationSeconds)
    && typeof value.allowSkips === 'boolean'
    && (typeof value.skipLimit === 'string' || typeof value.skipLimit === 'number') && SKIP_LIMITS.includes(value.skipLimit as TabooSkipLimit)
    && typeof value.roundsPerEntity === 'number' && Number.isInteger(value.roundsPerEntity) && value.roundsPerEntity > 0
}

function isParticipant(value: unknown): value is GameParticipant {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.isGuest === 'boolean'
}

function isTeam(value: unknown): value is TabooTeam {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string'
}

function isScoreRecord(value: unknown, entityIds: Set<unknown>) {
  if (!isRecord(value) || Object.keys(value).length !== entityIds.size) return false
  return [...entityIds].every((id) => typeof id === 'string' && typeof value[id] === 'number' && Number.isFinite(value[id]) && (value[id] as number) >= 0)
}

function isEntityList(value: unknown, entityIds: Set<unknown>) {
  return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === 'string' && entityIds.has(id))
}

function isUniqueIdList(value: unknown, validIds: Set<string>) {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && validIds.has(id))
}

function isTurnResult(value: unknown, entityIds: Set<unknown>) {
  if (value === null) return true
  if (!isRecord(value)) return false
  const result = value as Partial<TabooTurnResult>
  return Number.isInteger(result.turn)
    && typeof value.entityId === 'string' && entityIds.has(value.entityId)
    && Number.isInteger(result.correct) && result.correct! >= 0
    && Number.isInteger(result.skips) && result.skips! >= 0
    && Number.isInteger(result.points) && result.points! >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function touch(session: TabooSession): TabooSession {
  return { ...session, updatedAt: new Date().toISOString() }
}
