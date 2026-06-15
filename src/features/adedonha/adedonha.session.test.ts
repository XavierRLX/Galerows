import { describe, expect, it } from 'vitest'
import { changeAdedonhaLetter, createAdedonhaSession, decodeAdedonhaShare, encodeAdedonhaShare, finishAdedonhaScoring, getAdedonhaMatchTotal, normalizeAdedonhaCategories, updateAdedonhaAnswer, updateAdedonhaScore } from './adedonha.session'

describe('Adedonha session', () => {
  it('normalizes categories and removes duplicates', () => {
    expect(normalizeAdedonhaCategories([' Nome ', 'nome', '', 'Minha   sogra é...'])).toEqual(['Nome', 'Minha sogra é...'])
  })

  it('creates a share code with categories and letter', () => {
    const session = createAdedonhaSession(['Nome', 'Animal'], 'B')
    const decoded = decodeAdedonhaShare(encodeAdedonhaShare(session.categories, session.letter))
    expect(decoded).toEqual({ v: 1, c: ['Nome', 'Animal'], l: 'B' })
  })

  it('updates answers and clears them when a new letter is drawn', () => {
    let session = createAdedonhaSession(['Nome'], 'A')
    session = updateAdedonhaAnswer(session, session.categories[0].id, 'Ana')
    expect(Object.values(session.answers)).toEqual(['Ana'])
    session = changeAdedonhaLetter(session, () => 0)
    expect(session.letter).toBe('B')
    expect(session.answers).toEqual({})
  })

  it('saves finished rounds and accumulates the match score', () => {
    let session = createAdedonhaSession(['Nome'], 'A')
    session = updateAdedonhaAnswer(session, session.categories[0].id, 'Ana')
    session = updateAdedonhaScore(session, session.categories[0].id, 10)
    session = finishAdedonhaScoring(session)
    expect(session.rounds).toHaveLength(1)
    expect(getAdedonhaMatchTotal(session)).toBe(10)
  })
})
