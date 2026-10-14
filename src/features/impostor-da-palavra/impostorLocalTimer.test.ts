import { describe, expect, it, vi } from 'vitest'
import type { GameParticipant } from '../players/players.types'
import type { ImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.types'
import { advanceRolePass, beginConversation, continueAfterRound, createImpostorDaPalavraSession,
  isSessionCompatible, selectAccusedParticipant, confirmAccusation, advanceClueTurn, beginAccusation } from './impostorDaPalavra.session'

const players: GameParticipant[] = [
  { id: 'a', name: 'Ana', isGuest: true },
  { id: 'b', name: 'Bia', isGuest: true },
  { id: 'c', name: 'Caio', isGuest: true },
]
const deck: ImpostorDaPalavraDeck = {
  schemaVersion: 1, gameId: 'impostor-da-palavra', deckId: 'core', locale: 'pt-BR',
  version: 1, title: 'Impostor', questions: [],
  cards: Array.from({ length: 3 }, (_, i) => ({
    id: `card-${i}`, category: 'objects', word: `Palavra ${i}`,
    impostorHint: `Dica ${i}`, alternateWord: `Alternativa ${i}`, questionIds: [],
  })),
}

describe('Impostor single-phone optional conversation timer', () => {
  it('starts a 2-minute timer only when clues begin and resets it for the next round', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-14T16:00:00-03:00'))
      const config = { impostorMode: 'no-word' as const, conversationMode: 'one-word' as const,
        timerSeconds: 120 as const }
      let session = createImpostorDaPalavraSession(players, config, deck, () => 0.01)
      const firstCard = session.currentCardId
      expect(session.timerStartedAt).toBeNull()
      for (let i = 0; i < players.length; i++) session = advanceRolePass(session)
      expect(session.phase).toBe('conversation-intro')
      expect(session.timerStartedAt).toBeNull()
      session = beginConversation(session)
      expect(session.phase).toBe('clue-turn')
      expect(session.timerStartedAt).toBe(Date.now())
      for (let i = 0; i < players.length; i++) session = advanceClueTurn(session)
      session = beginAccusation(session)
      session = selectAccusedParticipant(session, players.find(p => p.id !== session.currentImpostorId)!.id)
      session = confirmAccusation(session)
      expect(session.phase).toBe('round-summary')
      session = continueAfterRound(session, deck, () => 0.01)
      expect(session.phase).toBe('role-pass')
      expect(session.timerStartedAt).toBeNull()
      expect(session.config.timerSeconds).toBe(120)
      expect(session.currentCardId).not.toBe(firstCard)
      expect(isSessionCompatible(session, deck)).toBe(true)
    } finally { vi.useRealTimers() }
  })

  it('preserves saved sessions from before timers existed and leaves no-timer games unaffected', () => {
    let legacy = createImpostorDaPalavraSession(players, {
      impostorMode: 'no-word', conversationMode: 'one-word',
    }, deck, () => 0.01)
    legacy = { ...legacy, timerStartedAt: undefined }
    expect(isSessionCompatible(legacy, deck)).toBe(true)
    for (let i = 0; i < players.length; i++) legacy = advanceRolePass(legacy)
    legacy = beginConversation(legacy)
    expect(legacy.timerStartedAt).toBeNull()
  })

  it('rejects unsupported timer lengths on the shared game setup', () => {
    expect(() => createImpostorDaPalavraSession(players, {
      impostorMode: 'no-word', conversationMode: 'one-word', timerSeconds: 10 as 120,
    }, deck, () => 0.01)).toThrow('A configuração do jogo é inválida.')
  })
})
