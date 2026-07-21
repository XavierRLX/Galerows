import { useEffect } from 'react'

export function useTop10Theme() {
  useEffect(() => {
    document.body.classList.add('top10-lime-theme')
    return () => document.body.classList.remove('top10-lime-theme')
  }, [])
}
