import { useEffect } from 'react'
import { useAdedonhaStore } from './adedonha.store'

export function useAdedonhaInitialization() {
  const initialize = useAdedonhaStore((state) => state.initialize)
  useEffect(() => { void initialize() }, [initialize])
}
