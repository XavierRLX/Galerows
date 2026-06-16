import { useTranslation } from 'react-i18next'
import { gamesRegistry } from '../games/games.registry'
import { GameCard } from './GameCard'
import { HubHeader } from './HubHeader'
import { HubNativeAdCard } from './HubNativeAdCard'

const orderedGames = [...gamesRegistry].sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available'))

export function HubScreen() {
  const { t } = useTranslation('hub')

  return (
    <div className="pb-10">
      <HubHeader />
      <section className="px-5" aria-label={t('gamesTitle')}>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">{t('gamesTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedGames.map((game) => (
            <GameCard game={game} key={game.id} />
          )).flatMap((card, index) => (
            (index + 1) % 3 === 0 && index < orderedGames.length - 1
              ? [card, <HubNativeAdCard key={`hub-native-ad-${index}`} />]
              : [card]
          ))}
        </div>
      </section>
    </div>
  )
}
