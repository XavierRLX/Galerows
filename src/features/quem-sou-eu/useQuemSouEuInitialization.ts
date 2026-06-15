import { useEffect } from 'react'
import { useQuemSouEuStore } from './quemSouEu.store'

export function useQuemSouEuInitialization() {
  const initialize = useQuemSouEuStore((state) => state.initialize)
  useEffect(() => { void initialize() }, [initialize])
}
