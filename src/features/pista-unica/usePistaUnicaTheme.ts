import { useEffect } from 'react'

export function usePistaUnicaTheme() {
  useEffect(() => {
    document.body.classList.add('pista-unica-theme')
    return () => document.body.classList.remove('pista-unica-theme')
  }, [])
}
