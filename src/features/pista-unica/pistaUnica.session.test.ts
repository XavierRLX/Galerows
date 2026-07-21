import { describe, expect, it } from 'vitest'
import { addPistaUnicaClue, beginPistaUnicaGuess, continuePistaUnicaSession, createPistaUnicaSession, finishPistaUnicaRound, getVisiblePistaUnicaClues, normalizeClue, openPistaUnicaClue, togglePistaUnicaClue, updatePistaUnicaClue } from './pistaUnica.session'
import type { GameParticipant } from '../players/players.types'

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
    ])).toEqual([{ id: 'one', participantId: 'bia', text: 'Ação!', included: true }])
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
    expect(session.scores.ana).toBe(1)
    session = continuePistaUnicaSession(session)
    expect(session.round).toBe(2)
    expect(session.participants[session.currentGuesserIndex]?.name).toBe('Bia')
    expect(session.phase).toBe('pass-clue')
  })
})
