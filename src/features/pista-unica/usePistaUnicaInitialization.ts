import { useEffect } from 'react'
import { usePistaUnicaStore } from './pistaUnica.store'

export function usePistaUnicaInitialization() {
  const initialize = usePistaUnicaStore((state) => state.initialize)
  useEffect(() => { void initialize() }, [initialize])
}
