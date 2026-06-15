export type QuemSouEuPhase = 'countdown' | 'revealed' | 'summary'
export type QuemSouEuWordStatus = 'correct' | 'skipped'

export type QuemSouEuWord = {
  id: string
  text: string
  status: QuemSouEuWordStatus | null
}

export type QuemSouEuSession = {
  schemaVersion: 1
  id: string
  gameId: 'quem-sou-eu'
  phase: QuemSouEuPhase
  words: QuemSouEuWord[]
  currentIndex: number
  countdownSeconds: 5
  createdAt: string
  updatedAt: string
}
