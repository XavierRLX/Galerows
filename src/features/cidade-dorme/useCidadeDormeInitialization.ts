import { useEffect } from 'react'
import { useCidadeDormeStore } from './cidadeDorme.store'

export function useCidadeDormeInitialization() {
  const initialize = useCidadeDormeStore((state) => state.initialize)
  useEffect(() => { void initialize() }, [initialize])
}
