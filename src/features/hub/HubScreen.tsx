import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canDisplayAds } from '../ads/ads.visibility'
import { getDiscoverGameId, getMostPlayedGameId } from '../games/gameUsage.model'
import { loadGameUsageSnapshot, recordGameOpened } from '../games/gameUsage.service'
import type { GameUsageSnapshot } from '../games/gameUsage.types'
import { gamesRegistry } from '../games/games.registry'
import { usePremiumStore } from '../premium/premium.store'
import { GameCard } from './GameCard'
import { HubHeader } from './HubHeader'
import { HubNativeAdCard } from './HubNativeAdCard'

const featuredGameId = 'cidade-dorme'
const orderedGames = [...gamesRegistry].sort((a, b) => {
  if (a.id === featuredGameId) return -1
  if (b.id === featuredGameId) return 1
  return Number(b.status === 'available') - Number(a.status === 'available')
})

export function HubScreen() {
  const { t } = useTranslation('hub')
  const isPremium = usePremiumStore((state) => state.isPremium)
  const [usageSnapshot, setUsageSnapshot] = useState<GameUsageSnapshot | null>(null)
  const [discoverRandom] = useState(() => Math.random())

  useEffect(() => {
    let active = true
    void loadGameUsageSnapshot().then((snapshot) => {
      if (active) setUsageSnapshot(snapshot)
    })
    return () => {
      active = false
    }
  }, [])

  const badgeIds = useMemo(() => {
    if (!usageSnapshot) return { discover: null, mostPlayed: null }
    return {
      discover: getDiscoverGameId(gamesRegistry, usageSnapshot, featuredGameId, () => discoverRandom),
      mostPlayed: getMostPlayedGameId(gamesRegistry, usageSnapshot),
    }
  }, [discoverRandom, usageSnapshot])

  const handleOpenGame = useCallback(async (gameId: string) => {
    const next = await recordGameOpened(gameId)
    setUsageSnapshot(next)
  }, [])

  const getBadgeLabels = (gameId: string) => [
    gameId === featuredGameId ? t('featuredBadge') : null,
    gameId === badgeIds.mostPlayed ? t('mostPlayedBadge') : null,
    gameId === badgeIds.discover ? t('discoverBadge') : null,
  ].filter((label): label is string => Boolean(label))

  return (
    <div className="pb-10">
      <HubHeader />
      <section className="px-5" aria-label={t('gamesTitle')}>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">{t('gamesTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedGames.map((game, index) => (
            <GameCard badgeLabels={getBadgeLabels(game.id)} game={game} key={game.id} revealIndex={index} onOpenGame={handleOpenGame} />
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
