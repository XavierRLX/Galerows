import { useContext } from 'react'
import { FakeAdContext } from './FakeAdContext'

export function useFakeAd() {
  return useContext(FakeAdContext)
}
