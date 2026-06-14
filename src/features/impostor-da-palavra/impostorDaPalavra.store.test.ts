import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import type { GameParticipant } from '../players/players.types'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'
import type { ImpostorDaPalavraSession } from './impostorDaPalavra.types'

const { deck } = vi.hoisted(() => {
  const questionIds = Array.from({ length: 12 }, (_, index) => `question-${index + 1}`)
  return {
    deck: {
      schemaVersion: 1,
      gameId: 'impostor-da-palavra',
      deckId: 'test-deck',
      locale: 'pt-BR',
      version: 1,
      title: 'Impostor da Palavra',
      questions: questionIds.map((id, index) => ({ id, text: `Pergunta ${index + 1}` })),
      cards: Array.from({ length: 12 }, (_, index) => ({ id: `card-${index + 1}`, category: 'objects', word: `Palavra ${index + 1}`, impostorHint: `Dica ${index + 1}`, alternateWord: `Alternativa ${index + 1}`, questionIds })),
    },
  }
})

vi.mock('./content/impostorDaPalavraContent.service', () => ({
  loadImpostorDaPalavraDeck: async () => ({ deck, source: 'packaged', warnings: [] }),
}))

const participants: GameParticipant[] = [
  { id: 'ana', name: 'Ana', isGuest: false },
  { id: 'bia', name: 'Bia', isGuest: false },
  { id: 'caio', name: 'Caio', isGuest: true },
]

describe('Impostor da Palavra store', () => {
  beforeEach(async () => {
    await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraSession)
    await LocalPreferences.remove(STORAGE_KEYS.impostorDaPalavraOpeningHistory)
    useImpostorDaPalavraStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
  })

  it('autosaves and resumes a compatible session without reveal state', async () => {
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'hint', conversationMode: 'guided-questions' })
    await useImpostorDaPalavraStore.getState().advanceRole()
    const saved = await LocalPreferences.getJson<ImpostorDaPalavraSession>(STORAGE_KEYS.impostorDaPalavraSession)
    expect(saved?.rolePassIndex).toBe(1)
    expect(Object.keys(saved ?? {}).some((key) => /reveal|visible|shown/i.test(key))).toBe(false)
    useImpostorDaPalavraStore.setState({ session: null, initialized: false })
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    expect(useImpostorDaPalavraStore.getState().session?.id).toBe(saved?.id)
    expect(useImpostorDaPalavraStore.getState().session?.rolePassIndex).toBe(1)
  })

  it('rejects a session saved with an incompatible deck version', async () => {
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'no-word', conversationMode: 'one-word' })
    const saved = await LocalPreferences.getJson<ImpostorDaPalavraSession>(STORAGE_KEYS.impostorDaPalavraSession)
    await LocalPreferences.setJson(STORAGE_KEYS.impostorDaPalavraSession, { ...saved, deckVersion: 999 })
    useImpostorDaPalavraStore.setState({ session: null, initialized: false })
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    expect(useImpostorDaPalavraStore.getState().session).toBeNull()
    expect(useImpostorDaPalavraStore.getState().resumeError).toMatch(/versão/i)
  })

  it('persists opening history and avoids repeating it on restart', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'alternate-word', conversationMode: 'one-word' })
    const first = useImpostorDaPalavraStore.getState().session!
    await useImpostorDaPalavraStore.getState().restart()
    const second = useImpostorDaPalavraStore.getState().session!
    expect(second.currentCardId).not.toBe(first.currentCardId)
    expect(second.speakingOrder[0]).not.toBe(first.speakingOrder[0])
    vi.restoreAllMocks()
  })

  it('removes only the active session when discarded', async () => {
    await useImpostorDaPalavraStore.getState().initialize('pt-BR')
    await useImpostorDaPalavraStore.getState().start(participants, { impostorMode: 'no-word', conversationMode: 'one-word' })
    await useImpostorDaPalavraStore.getState().discard()
    expect(await LocalPreferences.getJson(STORAGE_KEYS.impostorDaPalavraSession)).toBeNull()
    expect(await LocalPreferences.getJson(STORAGE_KEYS.impostorDaPalavraOpeningHistory)).not.toBeNull()
    expect(useImpostorDaPalavraStore.getState().session).toBeNull()
  })
})
