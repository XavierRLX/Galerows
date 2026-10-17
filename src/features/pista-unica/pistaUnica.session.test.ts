import { describe, expect, it } from 'vitest'
import { addPistaUnicaClue, beginPistaUnicaGuess, continuePistaUnicaSession, createPistaUnicaSession, finishPistaUnicaRound, getVisiblePistaUnicaClues, normalizeClue, openPistaUnicaClue, togglePistaUnicaClue, updatePistaUnicaClue } from './pistaUnica.session'
import type { GameParticipant } from '../players/players.types'
import { getPistaUnicaTarget } from './pistaUnica.content'

const participants: GameParticipant[] = [
  { id: 'ana', name: 'Ana', isGuest: false },
  { id: 'bia', name: 'Bia', isGuest: false },
  { id: 'caio', name: 'Caio', isGuest: true },
]

describe('Pista Única session', () => {
  it('normalizes equivalent clues and only exposes one of them', () => {
    expect(normalizeClue('  Ação!  ')).toBe('acao')
    expect(getVisiblePistaUnicaClues([
      { id: 'one', participantId: 'bia', text: 'Ação!', included: true },
      { id: 'two', participantId: 'caio', text: 'acao', included: true },
      { id: 'three', participantId: 'caio', text: 'navio', included: false },
    ])).toEqual([])
  })

  it('collects clues, allows review, scores the guesser, and advances the turn', () => {
    let session = createPistaUnicaSession(participants, ['movies'], () => 0)
    expect(session.phase).toBe('pass-clue')
    expect(session.clueOrder).toEqual(['bia', 'caio'])
    session = openPistaUnicaClue(session)
    session = addPistaUnicaClue(session, 'bia', 'mar')
    session = openPistaUnicaClue(session)
    session = addPistaUnicaClue(session, 'caio', 'MAR')
    expect(session.phase).toBe('review')
    session = updatePistaUnicaClue(session, session.clues[1]!.id, 'oceano')
    session = togglePistaUnicaClue(session, session.clues[0]!.id)
    expect(getVisiblePistaUnicaClues(session.clues).map((clue) => clue.text)).toEqual(['oceano'])
    session = beginPistaUnicaGuess(session)
    session = finishPistaUnicaRound(session, true)
    expect(session.scores.ana).toBe(2)
    expect(session.scores.caio).toBe(1)
    expect(session.scores.bia).toBe(0)
    session = continuePistaUnicaSession(session)
    expect(session.round).toBe(2)
    expect(session.participants[session.currentGuesserIndex]?.name).toBe('Bia')
    expect(session.phase).toBe('pass-clue')
  })
})


describe('Pista Única — pontos por pistas únicas e revisão manual', () => {
  const startReview = (clues: [string,string], category: 'words'|'movies' = 'words') => {
    let s = createPistaUnicaSession(participants, [category], () => 0)
    s = openPistaUnicaClue(s)
    s = addPistaUnicaClue(s, 'bia', clues[0])
    s = openPistaUnicaClue(s)
    return addPistaUnicaClue(s, 'caio', clues[1])
  }
  it('eliminates every duplicate and cannot restore one by manually excluding the other', () => {
    let s = startReview(['   Ação!  ', 'acao'])
    expect(getVisiblePistaUnicaClues(s.clues)).toEqual([])
    s = togglePistaUnicaClue(s,s.clues[0]!.id)
    expect(getVisiblePistaUnicaClues(s.clues)).toEqual([])
    s = beginPistaUnicaGuess(s)
    expect(s.phase).toBe('round-result')
    expect(s.scores).toEqual({ana:0,bia:0,caio:0})
  })
  it('blocks hints that exactly disclose the answer (case, accents, punctuation) and credits only valid authors on success', () => {
    let s = createPistaUnicaSession(participants, ['words'], () => 0)
    // The deck is deterministic; use the actual target instead of assuming title.
    const word = getPistaUnicaTarget(s.currentTargetId)!.title
    s = openPistaUnicaClue(s)
    s = addPistaUnicaClue(s, 'bia', `  ${word.toUpperCase()}!!! `)
    s = openPistaUnicaClue(s)
    s = addPistaUnicaClue(s, 'caio', 'Uma dica útil')
    expect(getVisiblePistaUnicaClues(s.clues,word).map(clue=>clue.participantId)).toEqual(['caio'])
    s = beginPistaUnicaGuess(s)
    expect(s.phase).toBe('guess')
    s = finishPistaUnicaRound(s,true)
    expect(s.scores).toEqual({ana:2,bia:0,caio:1})
    expect(s.lastRoundResult?.creditedPlayerIds).toEqual(['caio'])
  })
  it('does not credit a unique hint if the guesser misses', () => {
    let s = startReview(['Fruta','Doce'])
    s = beginPistaUnicaGuess(s)
    s = finishPistaUnicaRound(s,false)
    expect(s.scores).toEqual({ana:0,bia:0,caio:0})
  })
})
