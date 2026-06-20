import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackCompletedMatchAndMaybeRequestReview } from './reviewPrompt.service'

export function AppReviewCheckpoint({ matchId }: { matchId: string }) {
  const location = useLocation()

  useEffect(() => {
    void trackCompletedMatchAndMaybeRequestReview(matchId, location.pathname.endsWith('/play'))
  }, [location.pathname, matchId])

  return null
}
