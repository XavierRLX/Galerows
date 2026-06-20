import { useTranslation } from 'react-i18next'
import { gamesRegistry } from '../games/games.registry'
import { canDisplayAds } from '../ads/ads.visibility'
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

  return (
    <div className="pb-10">
      <HubHeader />
      <section className="px-5" aria-label={t('gamesTitle')}>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">{t('gamesTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedGames.map((game, index) => (
            <GameCard badgeLabel={game.id === featuredGameId ? t('featuredBadge') : undefined} game={game} key={game.id} revealIndex={index} />
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
