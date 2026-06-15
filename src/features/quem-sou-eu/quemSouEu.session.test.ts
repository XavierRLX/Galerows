import { describe, expect, it } from 'vitest'
import { createQuemSouEuSession, getQuemSouEuSummary, markQuemSouEuCorrect, normalizeQuemSouEuWords, revealQuemSouEuWord, skipQuemSouEuWord } from './quemSouEu.session'

describe('Quem Sou Eu session', () => {
  it('normalizes and limits words to 5 items', () => {
    expect(normalizeQuemSouEuWords(['  Harry   Potter  ', '', 'Wi-Fi', 'Pix', 'Marte', 'Abacaxi', 'Extra'])).toEqual(['Harry Potter', 'Wi-Fi', 'Pix', 'Marte', 'Abacaxi'])
  })

  it('marks correct and skipped words until the summary', () => {
    let session = createQuemSouEuSession(['Beyonce', 'Wi-Fi'])
    expect(session.phase).toBe('countdown')
    expect(session.countdownSeconds).toBe(5)
    expect(session.words).toHaveLength(2)

    session = revealQuemSouEuWord(session)
    expect(session.phase).toBe('revealed')
    session = markQuemSouEuCorrect(session)
    expect(session.phase).toBe('countdown')
    expect(session.currentIndex).toBe(1)
    expect(session.words[0].status).toBe('correct')

    session = revealQuemSouEuWord(session)
    session = skipQuemSouEuWord(session)
    expect(session.phase).toBe('summary')
    expect(session.currentIndex).toBe(1)
    expect(session.words[1].status).toBe('skipped')
    expect(getQuemSouEuSummary(session)).toEqual({ correct: 1, skipped: 1, total: 2 })
  })
})
