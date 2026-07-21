import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { loadGameFavoritesSnapshot, toggleGameFavorite } from './gameFavorites.service'

export function FavoriteGameButton({ gameId }: { gameId: string }) {
  const { t } = useTranslation('hub')
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    let active = true
    void loadGameFavoritesSnapshot().then((snapshot) => {
      if (active) setIsFavorite(snapshot.favorites.some((favorite) => favorite.gameId === gameId))
    })
    return () => { active = false }
  }, [gameId])

  const toggle = async () => {
    const snapshot = await toggleGameFavorite(gameId)
    setIsFavorite(snapshot.favorites.some((favorite) => favorite.gameId === gameId))
  }

  return (
    <Button aria-label={t(isFavorite ? 'removeFavorite' : 'addFavorite')} size="icon" variant="ghost" onClick={() => void toggle()}>
      <Heart aria-hidden="true" className={isFavorite ? 'fill-rose-400 text-rose-400' : undefined} size={21} />
    </Button>
  )
}
