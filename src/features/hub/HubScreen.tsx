import { Gamepad2, Smartphone, Users, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canDisplayAds } from '../ads/ads.visibility'
import { loadGameFavoritesSnapshot } from '../games/gameFavorites.service'
import type { GameFavoritesSnapshot } from '../games/gameFavorites.types'
import { getDiscoverGameId, getMostRecentlyOpenedGameId } from '../games/gameUsage.model'
import { loadGameUsageSnapshot, recordGameOpened } from '../games/gameUsage.service'
import type { GameUsageSnapshot } from '../games/gameUsage.types'
import { getGameModeCapabilities } from '../games/gameModes.registry'
import { gamesRegistry } from '../games/games.registry'
import { shuffle } from '../../lib/utils/shuffle'
import { usePremiumStore } from '../premium/premium.store'
import { GameCard } from './GameCard'
import { HubHeader } from './HubHeader'
import { HubNativeAdCard } from './HubNativeAdCard'
import { orderHubGames } from './hubGames.model'

import './hub.css'

const featuredGameId = 'cidade-dorme'
const sessionGameOrder = shuffle(gamesRegistry).map((game) => game.id)
const sessionDiscoverRandom = Math.random()

export function HubScreen() {
  const { t } = useTranslation('hub')
  const [modeFilter, setModeFilter] = useState<'all' | 'shared' | 'personal' | 'lan'>('all')
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

  const availableGames = orderedGames.filter(game => game.status === 'available' && (
    modeFilter === 'all' || (modeFilter === 'lan'
      ? getGameModeCapabilities(game).lan === 'available'
      : (getGameModeCapabilities(game).local.kind === 'localPersonalSheet') === (modeFilter === 'personal'))
  ))
  const upcomingGames = orderedGames.filter(game => game.status !== 'available')

  return (
    <div className="hub-home">
      <HubHeader />
      <section className="hub-catalog" aria-labelledby="hub-games-title">
        <div className="hub-section-heading">
          <h2 id="hub-games-title">{t('gamesTitle')}</h2>
          <span role="status">{t('gameCount', { count: availableGames.length })}</span>
        </div>
        <div className="hub-filters" role="group" aria-label={t('filterLabel')}>
          <button type="button" aria-pressed={modeFilter === 'all'} onClick={() => setModeFilter('all')}><Gamepad2 size={16} aria-hidden="true" />{t('filters.all')}</button>
          <button type="button" aria-pressed={modeFilter === 'shared'} onClick={() => setModeFilter('shared')}><Smartphone size={15} aria-hidden="true" />{t('modes.shared')}</button>
          <button type="button" aria-pressed={modeFilter === 'lan'} onClick={() => setModeFilter('lan')}><Wifi size={15} aria-hidden="true" />{t('modes.lan')}</button>
          <button type="button" aria-pressed={modeFilter === 'personal'} onClick={() => setModeFilter('personal')}><Users size={15} aria-hidden="true" />{t('filters.personal')}</button>
        </div>
        {modeFilter === 'lan' ? <p className="hub-filter-note">{t('modes.lanDescription')}</p> : null}
        {modeFilter === 'personal' ? <p className="hub-filter-note">{t('modes.personalDescription')}</p> : null}
        <div className="hub-game-grid">
          {availableGames.map((game, index) => (
            <GameCard
              badgeLabels={getBadgeLabels(game.id)}
              game={game}
              featured={game.id === featuredGameId}
              isFavorite={favoritesSnapshot?.favorites.some((favorite) => favorite.gameId === game.id) ?? false}
              key={game.id}
              revealIndex={index}
              onOpenGame={handleOpenGame}
            />
          )).flatMap((card, index) => (
            canDisplayAds() && !isPremium && (index + 1) % 3 === 0 && index < availableGames.length - 1
              ? [card, <div className="hub-ad" key={`hub-native-ad-${index}`}><HubNativeAdCard /></div>]
              : [card]
          ))}
        </div>
      </section>
      {modeFilter === 'all' ? <section className="hub-upcoming" aria-labelledby="hub-upcoming-title">
        <div className="hub-section-heading"><h2 id="hub-upcoming-title">{t('upcomingTitle')}</h2><span>{t('comingSoon')}</span></div>
        <div className="hub-upcoming-list">{upcomingGames.map(game => <GameCard game={game} key={game.id} />)}</div>
      </section> : null}
      <p className="hub-endnote">{t('endnote')}</p>
    </div>
  )
}
