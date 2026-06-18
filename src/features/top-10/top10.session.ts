import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import { normalizePlayerName } from '../players/players.model'
import type { GameParticipant } from '../players/players.types'
import type { Top10Deck, Top10Rank } from './content/top10Content.types'
import type { Top10Config, Top10RevealedAnswer, Top10Session, Top10Team } from './top10.types'

const MODES = ['individual', 'teams'] as const
const ROUNDS_PER_ENTITY = [1, 2, 3] as const
const PHASES = ['playing', 'round-summary', 'finished'] as const

export function createTop10Session(
  participants: GameParticipant[],
  teams: Top10Team[],
  config: Top10Config,
  deck: Top10Deck,
  random: () => number = Math.random,
): Top10Session {
  assertSetup(participants, teams, config, deck)
  const entities = config.mode === 'individual' ? participants : teams
  const mediatorQueue = buildTop10MediatorQueue(entities, config.firstMediatorId, config.roundsPerEntity)
  const cardQueue = buildReusableCardQueue(deck, mediatorQueue.length, random)
  const now = new Date().toISOString()
  return {
    schemaVersion: 2,
    id: createId('top-10'),
    gameId: 'top-10',
    deckId: deck.deckId,
    deckVersion: deck.version,
    locale: deck.locale,
    phase: 'playing',
    participants: [...participants],
    teams: [...teams],
    config: { ...config },
    scores: Object.fromEntries(entities.map((entity) => [entity.id, 0])),
    cardQueue,
    currentCardIndex: 0,
    currentCardId: cardQueue[0] ?? null,
    mediatorQueue,
    currentMediatorIndex: 0,
    currentMediatorId: mediatorQueue[0] ?? config.firstMediatorId,
    revealedAnswers: {},
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function getTop10AnswerPoints(rank: Top10Rank) {
  return 11 - rank
}

export function revealTop10Answer(session: Top10Session, rank: Top10Rank, deck: Top10Deck, entityId: string | null = null, now: Date = new Date()) {
  if (session.phase !== 'playing' || session.revealedAnswers[String(rank)]) return session
  const card = getCurrentTop10Card(session, deck)
  if (!card?.answers.some((answer) => answer.rank === rank)) return session
  if (entityId !== null && !getEligibleTop10ScoringEntities(session).some((entity) => entity.id === entityId)) return session
  const points = entityId ? getTop10AnswerPoints(rank) : 0
  const revealed: Top10RevealedAnswer = { rank, entityId, points, revealedAt: now.toISOString() }
  const scores = entityId ? { ...session.scores, [entityId]: (session.scores[entityId] ?? 0) + points } : session.scores
  return touch({ ...session, scores, revealedAnswers: { ...session.revealedAnswers, [String(rank)]: revealed } })
}

export function endTop10Card(session: Top10Session, deck: Top10Deck) {
  if (session.phase !== 'playing') return session
  const card = getCurrentTop10Card(session, deck)
  if (!card) return session
  return touch({
    ...session,
    phase: 'round-summary',
    history: [
      ...session.history,
      {
        cardId: card.id,
        theme: card.theme,
        question: card.question,
        mediatorEntityId: session.currentMediatorId,
        reveals: Object.values(session.revealedAnswers).sort((a, b) => a.rank - b.rank),
      },
    ],
  })
}

export function continueAfterTop10Summary(session: Top10Session) {
  if (session.phase !== 'round-summary') return session
  const nextIndex = session.currentCardIndex + 1
  const nextCardId = session.cardQueue[nextIndex] ?? null
  const nextMediatorId = session.mediatorQueue[nextIndex] ?? null
  if (nextCardId === null || nextMediatorId === null) return touch({ ...session, phase: 'finished', currentCardIndex: nextIndex, currentCardId: null, currentMediatorIndex: nextIndex, revealedAnswers: {} })
  return touch({ ...session, phase: 'playing', currentCardIndex: nextIndex, currentCardId: nextCardId, currentMediatorIndex: nextIndex, currentMediatorId: nextMediatorId, revealedAnswers: {} })
}

export function getCurrentTop10Card(session: Top10Session, deck: Top10Deck) {
  return deck.cards.find((card) => card.id === session.currentCardId) ?? null
}

export function getTop10Entities(session: Top10Session) {
  return session.config.mode === 'individual' ? session.participants : session.teams
}

export function getCurrentTop10Mediator(session: Top10Session) {
  return getTop10Entities(session).find((entity) => entity.id === session.currentMediatorId) ?? null
}

export function getEligibleTop10ScoringEntities(session: Top10Session) {
  return getTop10Entities(session).filter((entity) => entity.id !== session.currentMediatorId)
}

export function buildTop10MediatorQueue(entities: { id: string }[], firstMediatorId: string, roundsPerEntity: Top10Config['roundsPerEntity']) {
  if (!entities.some((entity) => entity.id === firstMediatorId)) return []
  const firstIndex = entities.findIndex((entity) => entity.id === firstMediatorId)
  const ordered = entities.map((_, offset) => entities[(firstIndex + offset) % entities.length]!)
  return Array.from({ length: roundsPerEntity }).flatMap(() => ordered.map((entity) => entity.id))
}

export function buildReusableCardQueue(deck: Top10Deck, totalRounds: number, random: () => number = Math.random) {
  const ids = deck.cards.map((card) => card.id)
  const queue: number[] = []
  let previousCardId: number | null = null
  while (queue.length < totalRounds) {
    let pass = shuffle(ids, random)
    if (previousCardId !== null && pass.length > 1 && pass[0] === previousCardId) {
      const replacementIndex = pass.findIndex((id) => id !== previousCardId)
      if (replacementIndex > 0) [pass[0], pass[replacementIndex]] = [pass[replacementIndex], pass[0]]
    }
    queue.push(...pass)
    previousCardId = queue.at(-1) ?? previousCardId
  }
  return queue.slice(0, totalRounds)
}

export function rankTop10Entities(session: Top10Session) {
  return [...getTop10Entities(session)].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))
}

export function getTop10Winners(session: Top10Session) {
  const ranking = rankTop10Entities(session)
  const topScore = session.scores[ranking[0]?.id] ?? 0
  return ranking.filter((entity) => (session.scores[entity.id] ?? 0) === topScore)
}

export function isTop10SessionCompatible(value: unknown, deck: Top10Deck): value is Top10Session {
  if (!isRecord(value)) return false
  const session = value as Partial<Top10Session>
  if (!isConfig(session.config)) return false
  const participants = Array.isArray(session.participants) ? session.participants : []
  const teams = Array.isArray(session.teams) ? session.teams : []
  const entities = session.config.mode === 'individual' ? participants : teams
  const entityIds = new Set(entities.map((entity) => entity?.id))
  const cardIds = new Set(deck.cards.map((card) => card.id))
  return Boolean(session.schemaVersion === 2
    && session.gameId === 'top-10'
    && session.deckId === deck.deckId
    && session.deckVersion === deck.version
    && session.locale === deck.locale
    && typeof session.id === 'string'
    && participants.every(isParticipant)
    && teams.every(isTeam)
    && isScoreRecord(session.scores, entityIds)
    && typeof session.phase === 'string' && (PHASES as readonly string[]).includes(session.phase)
    && isCardQueue(session.cardQueue, cardIds)
    && Number.isInteger(session.currentCardIndex) && session.currentCardIndex! >= 0
    && (session.currentCardId === null || (typeof session.currentCardId === 'number' && cardIds.has(session.currentCardId)))
    && isEntityList(session.mediatorQueue, entityIds)
    && Number.isInteger(session.currentMediatorIndex) && session.currentMediatorIndex! >= 0
    && typeof session.currentMediatorId === 'string' && entityIds.has(session.currentMediatorId)
    && isRevealedRecord(session.revealedAnswers, entityIds)
    && Array.isArray(session.history)
    && typeof session.createdAt === 'string'
    && typeof session.updatedAt === 'string')
}

function assertSetup(participants: GameParticipant[], teams: Top10Team[], config: Top10Config, deck: Top10Deck) {
  if (!isConfig(config)) throw new Error('A configuração do jogo é inválida.')
  if (config.mode === 'individual' && (participants.length < 2 || participants.length > 12)) throw new Error('Selecione entre 2 e 12 jogadores.')
  if (config.mode === 'teams' && teams.length < 2) throw new Error('Crie pelo menos 2 equipes.')
  if (config.mode === 'teams' && new Set(teams.map((team) => normalizePlayerName(team.name).toLocaleLowerCase('pt-BR'))).size !== teams.length) throw new Error('As equipes precisam ter nomes diferentes.')
  const entities = config.mode === 'individual' ? participants : teams
  if (!entities.some((entity) => entity.id === config.firstMediatorId)) throw new Error('Selecione quem começa mediando.')
  if (deck.cards.length < 1) throw new Error('O baralho não possui cartas suficientes.')
}

function isConfig(value: unknown): value is Top10Config {
  if (!isRecord(value)) return false
  return typeof value.mode === 'string' && (MODES as readonly string[]).includes(value.mode)
    && (ROUNDS_PER_ENTITY as readonly unknown[]).includes(value.roundsPerEntity)
    && typeof value.firstMediatorId === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isParticipant(value: unknown): value is GameParticipant {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.isGuest === 'boolean'
}

function isTeam(value: unknown): value is Top10Team {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
}

function isScoreRecord(value: unknown, entityIds: Set<string | undefined>) {
  return isRecord(value) && [...entityIds].every((id) => typeof id === 'string' && typeof value[id] === 'number')
}

function isCardQueue(value: unknown, cardIds: Set<number>) {
  return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === 'number' && cardIds.has(id))
}

function isEntityList(value: unknown, entityIds: Set<string | undefined>) {
  return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === 'string' && entityIds.has(id))
}

function isRevealedRecord(value: unknown, entityIds: Set<string | undefined>) {
  if (!isRecord(value)) return false
  return Object.values(value).every((item) => {
    if (!isRecord(item)) return false
    return typeof item.rank === 'number' && Number.isInteger(item.rank) && item.rank >= 1 && item.rank <= 10
      && (item.entityId === null || (typeof item.entityId === 'string' && entityIds.has(item.entityId)))
      && typeof item.points === 'number'
      && typeof item.revealedAt === 'string'
  })
}

function touch(session: Top10Session): Top10Session {
  return { ...session, updatedAt: new Date().toISOString() }
}
