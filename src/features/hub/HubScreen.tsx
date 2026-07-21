import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canDisplayAds } from '../ads/ads.visibility'
import { loadGameFavoritesSnapshot } from '../games/gameFavorites.service'
import type { GameFavoritesSnapshot } from '../games/gameFavorites.types'
import { getDiscoverGameId, getMostRecentlyOpenedGameId } from '../games/gameUsage.model'
import { loadGameUsageSnapshot, recordGameOpened } from '../games/gameUsage.service'
import type { GameUsageSnapshot } from '../games/gameUsage.types'
import { gamesRegistry } from '../games/games.registry'
import { shuffle } from '../../lib/utils/shuffle'
import { usePremiumStore } from '../premium/premium.store'
import { GameCard } from './GameCard'
import { HubHeader } from './HubHeader'
import { HubNativeAdCard } from './HubNativeAdCard'
import { orderHubGames } from './hubGames.model'

const featuredGameId = 'cidade-dorme'
const sessionGameOrder = shuffle(gamesRegistry).map((game) => game.id)
const sessionDiscoverRandom = Math.random()

export function HubScreen() {
  const { t } = useTranslation('hub')
  const isPremium = usePremiumStore((state) => state.isPremium)
  const [usageSnapshot, setUsageSnapshot] = useState<GameUsageSnapshot | null>(null)
  const [favoritesSnapshot, setFavoritesSnapshot] = useState<GameFavoritesSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void loadGameUsageSnapshot().then((snapshot) => {
      if (active) setUsageSnapshot(snapshot)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void loadGameFavoritesSnapshot().then((snapshot) => {
      if (active) setFavoritesSnapshot(snapshot)
    })
    return () => { active = false }
  }, [])

  const badgeIds = useMemo(() => {
    if (!usageSnapshot) return { discover: null, recent: null }
    return {
      discover: getDiscoverGameId(gamesRegistry, usageSnapshot, featuredGameId, () => sessionDiscoverRandom),
      recent: getMostRecentlyOpenedGameId(gamesRegistry, usageSnapshot),
    }
  }, [usageSnapshot])

  const orderedGames = useMemo(() => orderHubGames(
    gamesRegistry,
    featuredGameId,
    favoritesSnapshot?.favorites.map((favorite) => favorite.gameId) ?? [],
    badgeIds.discover,
    sessionGameOrder,
  ), [badgeIds.discover, favoritesSnapshot])

  const handleOpenGame = useCallback(async (gameId: string) => {
    const next = await recordGameOpened(gameId)
    setUsageSnapshot(next)
  }, [])

  const getBadgeLabels = (gameId: string) => [
    gameId === featuredGameId ? t('featuredBadge') : null,
    gameId === badgeIds.recent ? t('recentBadge') : null,
    gameId === badgeIds.discover ? t('discoverBadge') : null,
  ].filter((label): label is string => Boolean(label))

  return (
    <div className="pb-10">
      <HubHeader />
      <section className="px-5" aria-label={t('gamesTitle')}>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">{t('gamesTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedGames.map((game, index) => (
            <GameCard
              badgeLabels={getBadgeLabels(game.id)}
              game={game}
              isFavorite={favoritesSnapshot?.favorites.some((favorite) => favorite.gameId === game.id) ?? false}
              key={game.id}
              revealIndex={index}
              onOpenGame={handleOpenGame}
            />
          )).flatMap((card, index) => (
            canDisplayAds() && !isPremium && (index + 1) % 3 === 0 && index < orderedGames.length - 1
              ? [card, <HubNativeAdCard key={`hub-native-ad-${index}`} />]
              : [card]
          ))}
        </div>
      </section>
    </div>
  )
}
