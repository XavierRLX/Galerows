import { Heart, Play, Smartphone, Users, Wifi } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { useFakeAd } from '../ads/useFakeAd'
import { GameIcon } from '../games/GameIcon'
import { getGameModeCapabilities } from '../games/gameModes.registry'
import type { GameModule } from '../games/games.types'

const accents: Record<string, string> = {
  'cidade-dorme': '#b8c9ff', 'impostor-da-palavra': '#ffa9b9', 'pista-unica': '#81e3d4',
  'ultima-pista': '#c8b5ff', 'nem-ferrando': '#edc394', 'top-10': '#d2f86a',
  'quem-sou-eu': '#9bdeff', adedonha: '#f5da8e', mimica: '#ffc4a3', taboo: '#ffa9b9',
}

type GameCardProps = {
  game: GameModule
  badgeLabels?: string[]
  badgeLabel?: string
  isFavorite?: boolean
  featured?: boolean
  onOpenGame?: (gameId: string) => Promise<void> | void
  revealIndex?: number
}

export function GameCard({ game, badgeLabel, badgeLabels = badgeLabel ? [badgeLabel] : [], isFavorite = false, featured = false, onOpenGame, revealIndex = 0 }: GameCardProps) {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const opening = useRef(false)
  const [busy, setBusy] = useState(false)
  const available = game.status === 'available'
  const modes = getGameModeCapabilities(game)
  const name = t(`games.${game.id}.name`, { defaultValue: game.name })
  const description = t(`games.${game.id}.shortDescription`, { defaultValue: game.shortDescription })
  const players = game.maxPlayers ? (game.minPlayers === game.maxPlayers ? `${game.minPlayers}` : `${game.minPlayers}–${game.maxPlayers}`) : `${game.minPlayers}+`
  const style = { '--game-accent': accents[game.id] ?? '#b8a0ff', '--card-delay': `${Math.min(revealIndex, 5) * 35}ms` } as CSSProperties

  async function openGame() {
    if (!available || opening.current) return
    opening.current = true
    setBusy(true)
    try {
      await AppHaptics.light()
      await showFakeAd({ placement: 'hub-play' })
      try {
        await onOpenGame?.(game.id)
      } catch {
        // Usage metrics should never block opening a game.
      }
      navigate(game.route)
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  return (
    <article className={`hub-game${featured ? ' hub-game-featured' : ''}${available ? '' : ' hub-game-soon'}`} style={style} aria-labelledby={`hub-game-${game.id}`}>
      <div className="hub-game-art">
        {game.coverImage ? <img src={game.coverImage} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async" /> : <GameIcon name={game.iconName} size={38} />}
        <div className="hub-game-badges">
          {badgeLabels.map(label => <span key={label}>{label}</span>)}
          {isFavorite ? <span className="hub-favorite" aria-label={t('favoriteBadge')}><Heart aria-hidden="true" size={13} fill="currentColor" /></span> : null}
        </div>
        {available ? <span className="hub-game-category">{t(`categories.${game.id}`, { defaultValue: t('welcome.eyebrow') })}</span> : null}
      </div>
      <div className="hub-game-body">
        <h3 id={`hub-game-${game.id}`}>{name}</h3>
        <p className="hub-game-description">{description}</p>
        <div className="hub-game-meta">
          <span><Users aria-hidden="true" size={13} />{t('playerRange', { range: players })}</span>
          {available ? <span className="hub-game-mode"><Smartphone aria-hidden="true" size={13} />{t(modes.local.kind === 'localPersonalSheet' ? 'modes.personal' : 'modes.shared')}</span> : null}
          {available && modes.lan !== 'unsupported' ? <span className="hub-game-lan"><Wifi aria-hidden="true" size={13} />{t(modes.lan === 'available' ? 'modes.lan' : 'modes.preparing')}</span> : null}
        </div>
        <button type="button" className="hub-play" aria-label={available ? `${t('playNow')} ${name}` : `${t('comingSoon')} ${name}`} disabled={!available || busy} aria-busy={busy} onClick={() => void openGame()}>
          {available ? <><Play aria-hidden="true" size={14} fill="currentColor" />{t(busy ? 'opening' : 'play')}</> : t('comingSoon')}
        </button>
      </div>
    </article>
  )
}
