import { CircleHelp, Play, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { useFakeAd } from '../ads/useFakeAd'
import { GameIcon } from '../games/GameIcon'
import { GameStatusBadge } from '../games/GameStatusBadge'
import type { GameModule } from '../games/games.types'

const coverFallbacks: Record<string, string> = {
  'impostor-da-palavra': 'radial-gradient(circle at 88% 24%, rgba(127,29,29,0.34), transparent 22%), linear-gradient(135deg, rgba(30,5,8,0.96), rgba(15,23,42,0.92) 58%, rgba(69,10,10,0.72))',
  taboo: 'radial-gradient(circle at 12% 34%, rgba(22,101,52,0.34), transparent 24%), linear-gradient(135deg, rgba(5,46,22,0.96), rgba(15,23,42,0.92) 58%, rgba(20,83,45,0.72))',
  'nem-ferrando': 'radial-gradient(circle at 18% 28%, rgba(120,74,35,0.32), transparent 26%), linear-gradient(135deg, rgba(24,10,2,0.98), rgba(49,31,18,0.95) 58%, rgba(15,23,42,0.9))',
  'quem-sou-eu': 'radial-gradient(circle at 18% 26%, rgba(56,189,248,0.32), transparent 24%), linear-gradient(135deg, rgba(8,47,73,0.98), rgba(15,23,42,0.94) 58%, rgba(14,116,144,0.68))',
  adedonha: 'radial-gradient(circle at 18% 26%, rgba(250,204,21,0.32), transparent 24%), linear-gradient(135deg, rgba(66,32,6,0.98), rgba(15,23,42,0.94) 58%, rgba(133,77,14,0.68))',
  'top-10': 'radial-gradient(circle at 16% 26%, rgba(248,113,113,0.24), transparent 24%), linear-gradient(135deg, rgba(36,8,12,0.98), rgba(69,10,10,0.94) 58%, rgba(15,23,42,0.88))',
  'cidade-dorme': 'radial-gradient(circle at 18% 26%, rgba(37,99,235,0.3), transparent 24%), linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.94) 58%, rgba(30,58,138,0.68))',
}

const defaultCover = 'radial-gradient(circle at 18% 24%, rgba(139,92,246,0.28), transparent 24%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,27,75,0.9))'

const defaultDepthShadow = [
  '0 30px 62px -30px rgba(139,92,246,0.56)',
  '0 18px 34px -22px rgba(0,0,0,0.9)',
  'inset 0 1px 0 rgba(255,255,255,0.12)',
  'inset 0 -26px 42px rgba(0,0,0,0.22)',
].join(', ')

const cardDepthShadows: Record<string, string> = {
  'impostor-da-palavra': [
    '0 30px 62px -30px rgba(239,68,68,0.52)',
    '0 18px 34px -22px rgba(0,0,0,0.92)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.24)',
  ].join(', '),
  taboo: [
    '0 30px 62px -30px rgba(34,197,94,0.54)',
    '0 18px 34px -22px rgba(0,0,0,0.9)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.2)',
  ].join(', '),
  'nem-ferrando': [
    '0 30px 62px -30px rgba(184,135,84,0.5)',
    '0 18px 34px -22px rgba(0,0,0,0.92)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.24)',
  ].join(', '),
  'quem-sou-eu': [
    '0 30px 62px -30px rgba(56,189,248,0.5)',
    '0 18px 34px -22px rgba(0,0,0,0.9)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.22)',
  ].join(', '),
  adedonha: [
    '0 30px 62px -30px rgba(250,204,21,0.54)',
    '0 18px 34px -22px rgba(0,0,0,0.88)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.18)',
  ].join(', '),
  'top-10': [
    '0 30px 62px -30px rgba(248,113,113,0.5)',
    '0 18px 34px -22px rgba(0,0,0,0.92)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.24)',
  ].join(', '),
  'cidade-dorme': [
    '0 30px 62px -30px rgba(96,165,250,0.52)',
    '0 18px 34px -22px rgba(0,0,0,0.94)',
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 -26px 42px rgba(0,0,0,0.25)',
  ].join(', '),
}

const cardThemes: Record<string, { icon: string; title: string; action: string }> = {
  'impostor-da-palavra': {
    icon: 'border-[#7f1d1d]/50 bg-slate-950/55 text-[#ef4444] shadow-[#450a0a]/35',
    title: 'text-[#ef4444]',
    action: 'border-[#7f1d1d] text-[#ef4444] hover:border-transparent hover:bg-[#7f1d1d] hover:text-white',
  },
  'nem-ferrando': {
    icon: 'border-[#8a5a32]/40 bg-slate-950/55 text-[#b88754] shadow-[#3b2415]/30',
    title: 'text-[#b88754]',
    action: 'border-[#8a5a32] text-[#b88754] hover:border-transparent hover:bg-[#8a5a32] hover:text-white',
  },
  taboo: {
    icon: 'border-[#166534]/50 bg-slate-950/55 text-[#22c55e] shadow-[#052e16]/35',
    title: 'text-[#22c55e]',
    action: 'border-[#166534] text-[#22c55e] hover:border-transparent hover:bg-[#166534] hover:text-white',
  },
  'quem-sou-eu': {
    icon: 'border-sky-400/45 bg-slate-950/55 text-sky-300 shadow-sky-950/35',
    title: 'text-sky-300',
    action: 'border-sky-400 text-sky-300 hover:border-transparent hover:bg-sky-400 hover:text-slate-950',
  },
  adedonha: {
    icon: 'border-yellow-300/45 bg-slate-950/55 text-yellow-300 shadow-yellow-950/35',
    title: 'text-yellow-300',
    action: 'border-yellow-300 text-yellow-300 hover:border-transparent hover:bg-yellow-300 hover:text-slate-950',
  },
  'top-10': {
    icon: 'border-red-800/60 bg-slate-950/55 text-red-300 shadow-red-950/40',
    title: 'text-red-300',
    action: 'border-red-700 text-red-300 hover:border-transparent hover:bg-red-800 hover:text-white',
  },
  'cidade-dorme': {
    icon: 'border-blue-300/45 bg-slate-950/55 text-blue-200 shadow-blue-950/35',
    title: 'text-blue-200',
    action: 'border-blue-300 text-blue-200 hover:border-transparent hover:bg-blue-300 hover:text-slate-950',
  },
}

const defaultTheme = {
  icon: 'border-violet-400/35 bg-slate-950/55 text-violet-300 shadow-violet-950/30',
  title: 'text-violet-300',
  action: 'border-violet-400 text-violet-300 hover:border-transparent hover:bg-violet-500 hover:text-white',
}

type GameCardProps = {
  game: GameModule
  badgeLabel?: string
  revealIndex?: number
}

export function GameCard({ game, badgeLabel, revealIndex = 0 }: GameCardProps) {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const cardRef = useRef<HTMLDivElement>(null)
  const revealDelayTimer = useRef<number | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [revealDelayActive, setRevealDelayActive] = useState(false)
  const available = game.status === 'available'
  const name = t(`games.${game.id}.name`, { defaultValue: game.name })
  const description = t(`games.${game.id}.shortDescription`, { defaultValue: game.shortDescription })
  const longDescription = t(`games.${game.id}.description`, { defaultValue: game.description })
  const players = game.maxPlayers ? `${game.minPlayers}-${game.maxPlayers}` : `${game.minPlayers}+`
  const theme = cardThemes[game.id] ?? defaultTheme
  const revealDelay = Math.min(revealIndex, 7) * 45
  const depthShadow = available
    ? cardDepthShadows[game.id] ?? defaultDepthShadow
    : '0 18px 36px -24px rgba(0,0,0,0.82), inset 0 1px 0 rgba(255,255,255,0.1)'
  const cardStyle: CSSProperties = {
    backgroundImage: game.coverImage
      ? `linear-gradient(90deg, rgba(2,6,23,0.9), rgba(2,6,23,0.58) 52%, rgba(2,6,23,0.86)), url("${game.coverImage}")`
      : coverFallbacks[game.id] ?? defaultCover,
    backgroundPosition: game.coverImage ? 'center right' : 'center',
    backgroundSize: 'cover',
    boxShadow: depthShadow,
    transitionDelay: revealDelayActive ? `${revealDelay}ms` : '0ms',
  }
  const openGame = async () => { if (!available) return; await AppHaptics.light(); await showFakeAd({ placement: 'hub-play' }); navigate(game.route) }

  useEffect(() => {
    const node = cardRef.current
    if (!node) return

    const revealCard = (withDelay = true) => {
      setRevealDelayActive(withDelay && revealDelay > 0)
      setIsRevealed(true)

      if (withDelay && revealDelay > 0) {
        revealDelayTimer.current = window.setTimeout(() => setRevealDelayActive(false), revealDelay + 540)
      }
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealCard(false)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      revealCard()
      observer.disconnect()
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 })

    observer.observe(node)
    return () => {
      observer.disconnect()
      if (revealDelayTimer.current) window.clearTimeout(revealDelayTimer.current)
    }
  }, [revealDelay])

  return (
    <>
      <div ref={cardRef}>
        <Card
          className={cn(
            'relative min-h-36 overflow-hidden !border-0 p-0 transition-[filter,opacity,transform] duration-500 ease-out',
            isRevealed
              ? cn(available ? 'opacity-100' : 'opacity-80 grayscale-[0.15]', '[transform:perspective(900px)_rotateX(1.3deg)_translateY(0)_scale(1)]')
              : 'opacity-0 blur-[1px] [transform:perspective(900px)_rotateX(7deg)_translateY(18px)_scale(0.985)]',
            available
              ? 'will-change-transform hover:brightness-110 hover:[transform:perspective(900px)_rotateX(0deg)_translateY(-4px)_scale(1.012)] active:[transform:perspective(900px)_rotateX(0deg)_translateY(-1px)_scale(1.004)]'
              : '',
          )}
          style={cardStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/78 via-slate-950/42 to-slate-950/68" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/8 via-white/3 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.035)_18%,transparent_46%)] opacity-50" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/38 to-transparent" />
          <div className="relative flex min-h-36 flex-col justify-between gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className={cn('rounded-2xl border p-3 shadow-lg backdrop-blur', available ? theme.icon : 'border-white/10 bg-white/10 text-slate-300')}>
                <GameIcon name={game.iconName} />
              </div>
              <div className="flex items-center gap-2">
                {badgeLabel ? <span className="rounded-full border border-blue-200/25 bg-blue-200/12 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-blue-100 shadow-sm backdrop-blur">
                  {badgeLabel}
                </span> : null}
                {!available ? <GameStatusBadge status={game.status} /> : null}
                <Button
                  aria-label={t('howToPlay', { name })}
                  className="size-8 rounded-none bg-transparent p-0 text-white/85 hover:bg-transparent hover:text-white"
                  size="icon"
                  variant="ghost"
                  onClick={() => setTutorialOpen(true)}
                >
                  <CircleHelp size={15} />
                </Button>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className={cn('text-2xl font-black uppercase leading-none tracking-tight', theme.title)}>
                  {name}
                </h2>
                <p className="mt-2 line-clamp-2 max-w-sm text-sm leading-5 text-slate-200">
                  {description}
                </p>
              </div>
              <Button
                aria-label={available ? `${t('playNow')} ${name}` : `${t('comingSoon')} ${name}`}
                className={cn('group size-11 shrink-0 rounded-full bg-transparent p-0', available ? theme.action : 'border-white/15 text-slate-300 hover:bg-white/10')}
                disabled={!available}
                size="icon"
                variant="secondary"
                onClick={openGame}
              >
                <Play className="fill-current stroke-transparent transition group-hover:fill-slate-950" size={18} />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <BottomSheet open={tutorialOpen} title={t('tutorial.title', { name })} onClose={() => setTutorialOpen(false)}>
        <p className="text-sm leading-6 text-slate-300">{longDescription}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Users size={14} />{t('players', { count: players })}</span>
          {game.isAvailableOffline ? <span className="rounded-full bg-white/10 px-3 py-2">{t('offline')}</span> : null}
        </div>
        <h3 className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-slate-400">{t('tutorial.stepsTitle')}</h3>
        <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
          <li>{t('tutorial.stepOne')}</li>
          <li>{t('tutorial.stepTwo')}</li>
          <li>{t('tutorial.stepThree')}</li>
        </ol>
      </BottomSheet>
    </>
  )
}
