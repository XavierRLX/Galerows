export type AdedonhaCategory = {
  id: string
  title: string
}

export type AdedonhaPhase = 'choosing-letter' | 'answering' | 'scoring' | 'summary' | 'finished'
export type AdedonhaScore = 0 | 5 | 10

export type AdedonhaRound = {
  id: string
  letter: string
  answers: Record<string, string>
  scores: Record<string, AdedonhaScore>
  total: number
  finishedAt: string
}

export type AdedonhaSession = {
  schemaVersion: 1
  id: string
  gameId: 'adedonha'
  phase: AdedonhaPhase
  categories: AdedonhaCategory[]
  letter: string
  answers: Record<string, string>
  scores: Record<string, AdedonhaScore>
  rounds: AdedonhaRound[]
  playerName: string
  createdAt: string
  updatedAt: string
}

export type AdedonhaSharePayload = {
  v: 1
  c: string[]
  l: string
}
