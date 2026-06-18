import { createContext } from 'react'

export type FakeAdPlacement = 'hub-play' | 'start-match'
export type FakeAdContextValue = {
  showFakeAd: (options?: { placement?: FakeAdPlacement }) => Promise<void>
}

export const FakeAdContext = createContext<FakeAdContextValue>({ showFakeAd: async () => {} })
