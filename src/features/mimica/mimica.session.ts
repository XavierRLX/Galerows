import { createId } from '../../lib/utils/createId'
import { shuffle } from '../../lib/utils/shuffle'
import { normalizePlayerName } from '../players/players.model'
import type { GameParticipant } from '../players/players.types'
import type { MimicaDeck } from './content/mimicaContent.types'
import type { MimicaChallengeSource, MimicaConfig, MimicaOpeningHistory, MimicaPreparedChallenge, MimicaSession, MimicaTeam, MimicaTurnResult } from './mimica.types'

const PHASES = ['turn-intro', 'choosing', 'acting', 'scoring', 'turn-summary', 'round-summary', 'finished'] as const
const MODES = ['individual', 'teams'] as const
const CHALLENGE_SOURCES = ['deck', 'opponent-prepared'] as const
const DURATIONS = [30, 60, 90, 120] as const
const FINISHED_REASONS = ['turns-complete', 'deck-exhausted'] as const

export function createMimicaSession(
  participants: GameParticipant[],
  teams: MimicaTeam[],
  config: MimicaConfig,
  deck: MimicaDeck,
  random: () => number = Math.random,
  openingHistory: MimicaOpeningHistory | null = null,
  challengeSource: MimicaChallengeSource = 'deck',
  preparedChallenges: MimicaPreparedChallenge[] = [],
): MimicaSession {
  assertSetup(participants, teams, config, deck, challengeSource, preparedChallenges)
  const entities = config.mode === 'individual' ? participants.map((participant) => participant.id) : teams.map((team) => team.id)
  const shuffledEntities = avoidFirst(shuffle(entities, random), openingHistory?.entityIdentity, (id) => entityIdentity(id, participants, teams))
  const orderedEntities = config.mode === 'teams' && challengeSource === 'opponent-prepared' ? entities : shuffledEntities
  const turnQueue = Array.from({ length: config.roundsPerEntity }).flatMap(() => orderedEntities)
  const cardIds = challengeSource === 'deck' ? avoidFirst(shuffle(deck.cards.map((card) => card.id), random), openingHistory?.cardId, (id) => id) : []
  const [currentCardId, ...cardQueue] = cardIds
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: createId('mimica'),
    gameId: 'mimica',
    deckId: deck.deckId,
    deckVersion: deck.version,
    locale: deck.locale,
    phase: 'turn-intro',
    participants: [...participants],
    teams: [...teams],
    config: { ...config },
    challengeSource,
    preparedChallenges: challengeSource === 'opponent-prepared' ? [...preparedChallenges] : [],
    scores: Object.fromEntries(entities.map((id) => [id, 0])),
    turnQueue,
    currentTurnIndex: 0,
    currentCardId: currentCardId ?? null,
    currentPreparedChallengeId: null,
    selectedActionId: null,
    cardQueue,
    usedCardIds: currentCardId ? [currentCardId] : [],
    turnStartedAt: null,
    lastTurnResult: null,
    pendingFinishedReason: currentCardId ? null : 'deck-exhausted',
    finishedReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function beginMimicaTurn(session: MimicaSession, now: Date = new Date()) {
  if (session.phase !== 'turn-intro') return session
  if (session.challengeSource === 'opponent-prepared') {
    const challenge = getCurrentPreparedChallenge(session)
    if (!challenge) return session
    return touch({
      ...session,
      phase: 'acting',
      currentPreparedChallengeId: challenge.id,
      selectedActionId: null,
      turnStartedAt: session.config.useTimer ? now.toISOString() : null,
    })
  }
  if (!session.currentCardId) return session
  return touch({ ...session, phase: 'choosing', selectedActionId: null, turnStartedAt: null })
}

export function chooseMimicaAction(session: MimicaSession, actionId: string, deck: MimicaDeck, now: Date = new Date()) {
  if (session.phase !== 'choosing' || session.challengeSource !== 'deck') return session
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  if (!card?.actions.some((action) => action.id === actionId)) return session
  return touch({ ...session, phase: 'acting', selectedActionId: actionId, turnStartedAt: session.config.useTimer ? now.toISOString() : null })
}

export function markMimicaReadyToScore(session: MimicaSession) {
  if (session.phase !== 'acting') return session
  return touch({ ...session, phase: 'scoring', turnStartedAt: null })
}

export function recordMimicaSuccess(session: MimicaSession, guesserId: string | null, deck: MimicaDeck) {
  if (session.phase !== 'acting' && session.phase !== 'scoring') return session
  const currentEntityId = getCurrentEntityId(session)
  const action = getCurrentMimicaAction(session, deck)
  if (!currentEntityId || !action) return session
  if (session.config.mode === 'individual' && (!guesserId || guesserId === currentEntityId || !session.participants.some((participant) => participant.id === guesserId))) return session
  if (session.config.mode === 'teams' && guesserId !== null) return session

  const scores = { ...session.scores }
  const actorPoints = session.config.mode === 'individual' ? action.points * 2 : action.points
  const guesserPoints = session.config.mode === 'individual' ? action.points : 0
  scores[currentEntityId] = (scores[currentEntityId] ?? 0) + actorPoints
  if (guesserId) scores[guesserId] = (scores[guesserId] ?? 0) + guesserPoints
  return finishTurn({ ...session, scores }, true, actorPoints, guesserId, guesserPoints, deck)
}

export function recordMimicaMiss(session: MimicaSession, deck: MimicaDeck) {
  if (session.phase !== 'acting' && session.phase !== 'scoring') return session
  return finishTurn(session, false, 0, null, 0, deck)
}

export function expireMimicaTurn(session: MimicaSession, now: Date = new Date()) {
  if (session.phase !== 'acting' || !session.config.useTimer || getRemainingSeconds(session, now) > 0) return session
  return touch({ ...session, phase: 'scoring', turnStartedAt: null })
}

export function continueAfterMimicaSummary(session: MimicaSession) {
  if (session.phase === 'round-summary') {
    if (session.pendingFinishedReason) return touch({ ...session, phase: 'finished', finishedReason: session.pendingFinishedReason, pendingFinishedReason: null })
    return touch({
      ...session,
      phase: 'turn-intro',
      currentTurnIndex: nextTurnIndex(session),
      currentPreparedChallengeId: null,
      selectedActionId: null,
      turnStartedAt: null,
      lastTurnResult: null,
    })
  }
  if (session.phase !== 'turn-summary' || !session.lastTurnResult) return session
  if (session.pendingFinishedReason) return touch({ ...session, phase: 'round-summary' })
  if (isEndOfRound(session)) return touch({ ...session, phase: 'round-summary' })
  return touch({
    ...session,
    phase: 'turn-intro',
    currentTurnIndex: nextTurnIndex(session),
    currentPreparedChallengeId: null,
    selectedActionId: null,
    turnStartedAt: null,
    lastTurnResult: null,
  })
}

export function getRemainingSeconds(session: MimicaSession, now: Date = new Date()) {
  if (session.phase !== 'acting' || !session.config.useTimer || !session.turnStartedAt) return session.config.turnDurationSeconds
  const elapsed = Math.floor((now.getTime() - new Date(session.turnStartedAt).getTime()) / 1000)
  return Math.max(0, session.config.turnDurationSeconds - elapsed)
}

export function getCurrentEntityId(session: MimicaSession) {
  return session.turnQueue[session.currentTurnIndex] ?? null
}

export function getCurrentEntityName(session: MimicaSession) {
  const id = getCurrentEntityId(session)
  if (!id) return ''
  if (session.config.mode === 'individual') return session.participants.find((participant) => participant.id === id)?.name ?? ''
  return session.teams.find((team) => team.id === id)?.name ?? ''
}

export function getEntitiesPerRound(session: MimicaSession) {
  return session.config.mode === 'individual' ? session.participants.length : session.teams.length
}

export function getCurrentRoundNumber(session: MimicaSession) {
  return Math.min(session.config.roundsPerEntity, Math.floor(session.currentTurnIndex / getEntitiesPerRound(session)) + 1)
}

export function getCurrentPreparedChallenge(session: MimicaSession) {
  const targetTeamId = getCurrentEntityId(session)
  if (session.challengeSource !== 'opponent-prepared' || !targetTeamId) return null
  return session.preparedChallenges.find((challenge) => challenge.targetTeamId === targetTeamId && challenge.round === getCurrentRoundNumber(session)) ?? null
}

export function getCurrentMimicaAction(session: MimicaSession, deck: MimicaDeck) {
  if (session.challengeSource === 'opponent-prepared') {
    const challenge = session.preparedChallenges.find((item) => item.id === session.currentPreparedChallengeId) ?? getCurrentPreparedChallenge(session)
    return challenge ? { id: challenge.id, label: challenge.text, points: challenge.points } : null
  }
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  return card?.actions.find((item) => item.id === session.selectedActionId) ?? null
}

export function rankMimicaEntities(session: MimicaSession) {
  const entities = session.config.mode === 'individual' ? session.participants : session.teams
  return [...entities].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))
}

export function getMimicaWinners(session: MimicaSession) {
  const ranking = rankMimicaEntities(session)
  const topScore = session.scores[ranking[0]?.id] ?? 0
  return ranking.filter((entity) => (session.scores[entity.id] ?? 0) === topScore)
}

export function entityIdentity(id: string, participants: GameParticipant[], teams: MimicaTeam[]) {
  const participant = participants.find((item) => item.id === id)
  if (participant) return participant.sourcePlayerId ?? `guest:${normalizePlayerName(participant.name).toLocaleLowerCase('pt-BR')}`
  const team = teams.find((item) => item.id === id)
  return team ? `team:${normalizePlayerName(team.name).toLocaleLowerCase('pt-BR')}` : id
}

export function isMimicaOpeningHistory(value: unknown): value is MimicaOpeningHistory {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1 && typeof value.cardId === 'string' && typeof value.entityIdentity === 'string'
}

export function normalizeMimicaSession(value: MimicaSession): MimicaSession {
  return normalizePersistedSession(value) as MimicaSession
}

export function isMimicaSessionCompatible(value: unknown, deck: MimicaDeck): value is MimicaSession {
  if (!isRecord(value)) return false
  const session = normalizePersistedSession(value as Partial<MimicaSession>)
  if (!isConfig(session.config)) return false
  const participants = Array.isArray(session.participants) ? session.participants : []
  const teams = Array.isArray(session.teams) ? session.teams : []
  const entityIds = new Set(session.config.mode === 'individual' ? participants.map((participant) => participant?.id) : teams.map((team) => team?.id))
  const teamIds = new Set(teams.map((team) => team?.id))
  const cardIds = new Set(deck.cards.map((card) => card.id))
  const actionIds = new Set(deck.cards.flatMap((card) => card.actions.map((action) => action.id)))
  return Boolean(session.schemaVersion === 1
    && session.gameId === 'mimica'
    && session.deckId === deck.deckId
    && session.deckVersion === deck.version
    && session.locale === deck.locale
    && typeof session.id === 'string'
    && participants.every(isParticipant)
    && teams.every(isTeam)
    && entityIds.size === (session.config.mode === 'individual' ? participants.length : teams.length)
    && isChallengeSource(session.challengeSource)
    && isPreparedChallengeList(session.preparedChallenges, teams, teamIds, session.config.roundsPerEntity, session.challengeSource)
    && isScoreRecord(session.scores, entityIds)
    && typeof session.phase === 'string' && (PHASES as readonly string[]).includes(session.phase)
    && (session.challengeSource === 'deck' || session.phase !== 'choosing')
    && isEntityList(session.turnQueue, entityIds)
    && Number.isInteger(session.currentTurnIndex) && session.currentTurnIndex! >= 0 && session.currentTurnIndex! < session.turnQueue!.length
    && (session.challengeSource === 'opponent-prepared' || session.currentCardId === null || (typeof session.currentCardId === 'string' && cardIds.has(session.currentCardId)))
    && (session.currentPreparedChallengeId === null || (typeof session.currentPreparedChallengeId === 'string' && session.preparedChallenges?.some((challenge) => challenge.id === session.currentPreparedChallengeId)))
    && (session.selectedActionId === null || (typeof session.selectedActionId === 'string' && actionIds.has(session.selectedActionId)))
    && isUniqueIdList(session.cardQueue, cardIds)
    && isIdList(session.usedCardIds, cardIds)
    && (session.challengeSource === 'opponent-prepared' || session.currentCardId === null || (typeof session.currentCardId === 'string' && session.usedCardIds?.includes(session.currentCardId)))
    && (session.turnStartedAt === null || typeof session.turnStartedAt === 'string')
    && isTurnResult(session.lastTurnResult, entityIds)
    && (session.pendingFinishedReason === null || (typeof session.pendingFinishedReason === 'string' && (FINISHED_REASONS as readonly string[]).includes(session.pendingFinishedReason)))
    && (session.finishedReason === null || (typeof session.finishedReason === 'string' && (FINISHED_REASONS as readonly string[]).includes(session.finishedReason)))
    && typeof session.createdAt === 'string'
    && typeof session.updatedAt === 'string')
}

function advanceCard(session: MimicaSession): MimicaSession {
  if (session.challengeSource === 'opponent-prepared') {
    return { ...session, currentPreparedChallengeId: null }
  }
  const [currentCardId, ...cardQueue] = session.cardQueue
  return {
    ...session,
    currentCardId: currentCardId ?? null,
    selectedActionId: null,
    cardQueue,
    usedCardIds: currentCardId ? [...session.usedCardIds, currentCardId] : session.usedCardIds,
  }
}

function finishTurn(session: MimicaSession, success: boolean, actorPoints: number, guesserId: string | null, guesserPoints: number, deck: MimicaDeck) {
  const entityId = getCurrentEntityId(session) ?? ''
  const action = getCurrentMimicaAction(session, deck)
  const advanced = advanceCard(session)
  const finishedReason = session.challengeSource === 'deck' && !advanced.currentCardId && nextTurnIndex(advanced) < advanced.turnQueue.length ? 'deck-exhausted' : nextTurnIndex(advanced) >= advanced.turnQueue.length ? 'turns-complete' : null
  const result: MimicaTurnResult = {
    turn: session.currentTurnIndex + 1,
    entityId,
    cardId: session.currentCardId,
    action,
    success,
    actorPoints,
    guesserId,
    guesserPoints,
  }
  return touch({ ...advanced, phase: 'turn-summary', turnStartedAt: null, lastTurnResult: result, pendingFinishedReason: finishedReason })
}

function nextTurnIndex(session: MimicaSession) {
  return session.currentTurnIndex + 1
}

function isEndOfRound(session: MimicaSession) {
  return nextTurnIndex(session) % getEntitiesPerRound(session) === 0
}

function assertSetup(
  participants: GameParticipant[],
  teams: MimicaTeam[],
  config: MimicaConfig,
  deck: MimicaDeck,
  challengeSource: MimicaChallengeSource,
  preparedChallenges: MimicaPreparedChallenge[],
) {
  if (!isConfig(config)) throw new Error('A configuração do jogo é inválida.')
  if (!isChallengeSource(challengeSource)) throw new Error('A fonte das mímicas é inválida.')
  if (config.mode === 'individual' && (participants.length < 2 || participants.length > 12)) throw new Error('Selecione entre 2 e 12 jogadores.')
  if (config.mode === 'teams' && teams.length < 2) throw new Error('Crie pelo menos 2 times.')
  if (config.mode === 'teams') assertTeamRosters(participants, teams)
  if (config.mode === 'teams' && new Set(teams.map((team) => normalizePlayerName(team.name).toLocaleLowerCase('pt-BR'))).size !== teams.length) throw new Error('Os times precisam ter nomes diferentes.')
  if (challengeSource === 'opponent-prepared' && config.mode !== 'teams') throw new Error('Mímicas da adversária só estão disponíveis no modo equipes.')
  if (challengeSource === 'opponent-prepared' && !hasPreparedChallengesForEveryTurn(preparedChallenges, teams, config.roundsPerEntity)) throw new Error('Preencha todas as mímicas criadas pelas equipes.')
  if (challengeSource === 'deck' && deck.cards.length < 1) throw new Error('O baralho não possui cartas suficientes.')
}

function avoidFirst(items: string[], previousIdentity: string | undefined, identityFor: (id: string) => string) {
  if (!previousIdentity || items.length < 2 || identityFor(items[0]) !== previousIdentity) return items
  const replacementIndex = items.findIndex((item) => identityFor(item) !== previousIdentity)
  if (replacementIndex <= 0) return items
  ;[items[0], items[replacementIndex]] = [items[replacementIndex], items[0]]
  return items
}

function isConfig(value: unknown): value is MimicaConfig {
  if (!isRecord(value)) return false
  return typeof value.mode === 'string' && (MODES as readonly string[]).includes(value.mode)
    && typeof value.useTimer === 'boolean'
    && typeof value.turnDurationSeconds === 'number' && (DURATIONS as readonly number[]).includes(value.turnDurationSeconds)
    && typeof value.roundsPerEntity === 'number' && Number.isInteger(value.roundsPerEntity) && value.roundsPerEntity > 0
}

function isChallengeSource(value: unknown): value is MimicaChallengeSource {
  return typeof value === 'string' && (CHALLENGE_SOURCES as readonly string[]).includes(value)
}

function isParticipant(value: unknown): value is GameParticipant {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.isGuest === 'boolean'
}

function isTeam(value: unknown): value is MimicaTeam {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string'
    && Array.isArray(value.memberIds) && value.memberIds.every((id) => typeof id === 'string')
}

function assertTeamRosters(participants: GameParticipant[], teams: MimicaTeam[]) {
  if (participants.length < 2 || participants.length > 12) throw new Error('Selecione entre 2 e 12 jogadores.')
  const participantIds = new Set(participants.map((participant) => participant.id))
  const assignedIds = teams.flatMap((team) => team.memberIds)
  if (teams.some((team) => team.memberIds.length === 0)) throw new Error('Toda equipe precisa ter pelo menos 1 jogador.')
  if (assignedIds.length !== participantIds.size || new Set(assignedIds).size !== assignedIds.length || assignedIds.some((id) => !participantIds.has(id))) {
    throw new Error('Cada jogador precisa estar em exatamente uma equipe.')
  }
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

function isIdList(value: unknown, validIds: Set<string>) {
  return Array.isArray(value) && value.every((id) => typeof id === 'string' && validIds.has(id))
}

function isPreparedChallengeList(value: unknown, teams: MimicaTeam[], teamIds: Set<unknown>, roundsPerEntity: number, challengeSource: MimicaChallengeSource | undefined) {
  if (!Array.isArray(value)) return false
  if (challengeSource === 'deck') return value.length === 0
  const challenges = value as unknown[]
  return challenges.every((challenge) => isPreparedChallenge(challenge, teamIds, roundsPerEntity)) && hasPreparedChallengesForEveryTurn(challenges as MimicaPreparedChallenge[], teams, roundsPerEntity)
}

function isPreparedChallenge(value: unknown, teamIds: Set<unknown>, roundsPerEntity: number): value is MimicaPreparedChallenge {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.targetTeamId === 'string' && teamIds.has(value.targetTeamId)
    && typeof value.authorTeamId === 'string' && teamIds.has(value.authorTeamId)
    && value.authorTeamId !== value.targetTeamId
    && typeof value.round === 'number' && Number.isInteger(value.round) && value.round >= 1 && value.round <= roundsPerEntity
    && typeof value.text === 'string' && normalizeChallengeText(value.text).length > 0
    && value.points === 1
}

function hasPreparedChallengesForEveryTurn(preparedChallenges: MimicaPreparedChallenge[], teams: MimicaTeam[], roundsPerEntity: number) {
  const teamIds = new Set(teams.map((team) => team.id))
  if (preparedChallenges.length !== teams.length * roundsPerEntity) return false
  return teams.every((team, index) => {
    const authorTeamId = teams[(index + teams.length - 1) % teams.length]?.id
    return Array.from({ length: roundsPerEntity }).every((_, roundIndex) => {
      const round = roundIndex + 1
      return preparedChallenges.some((challenge) => challenge.targetTeamId === team.id
        && challenge.authorTeamId === authorTeamId
        && challenge.round === round
        && challenge.points === 1
        && teamIds.has(challenge.authorTeamId)
        && normalizeChallengeText(challenge.text).length > 0)
    })
  })
}

function normalizeChallengeText(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

function isTurnResult(value: unknown, entityIds: Set<unknown>) {
  if (value === null) return true
  if (!isRecord(value)) return false
  const result = value as Partial<MimicaTurnResult>
  return Number.isInteger(result.turn)
    && typeof value.entityId === 'string' && entityIds.has(value.entityId)
    && (result.cardId === null || typeof result.cardId === 'string')
    && (result.action === null || isRecord(result.action))
    && typeof result.success === 'boolean'
    && Number.isInteger(result.actorPoints) && result.actorPoints! >= 0
    && (result.guesserId === null || (typeof result.guesserId === 'string' && entityIds.has(result.guesserId)))
    && Number.isInteger(result.guesserPoints) && result.guesserPoints! >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizePersistedSession(session: Partial<MimicaSession>): Partial<MimicaSession> {
  return {
    ...session,
    challengeSource: session.challengeSource ?? 'deck',
    preparedChallenges: session.challengeSource === 'opponent-prepared' && Array.isArray(session.preparedChallenges) ? session.preparedChallenges : [],
    currentPreparedChallengeId: session.currentPreparedChallengeId ?? null,
  }
}

function touch(session: MimicaSession): MimicaSession {
  return { ...session, updatedAt: new Date().toISOString() }
}
