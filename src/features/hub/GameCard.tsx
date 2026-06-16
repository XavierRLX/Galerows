import { CircleHelp, Play, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { useFakeAd } from '../ads/FakeAdProvider'
import { GameIcon } from '../games/GameIcon'
import { GameStatusBadge } from '../games/GameStatusBadge'
import type { GameModule } from '../games/games.types'

const coverFallbacks: Record<string, string> = {
  'impostor-da-palavra': 'radial-gradient(circle at 88% 24%, rgba(127,29,29,0.34), transparent 22%), linear-gradient(135deg, rgba(30,5,8,0.96), rgba(15,23,42,0.92) 58%, rgba(69,10,10,0.72))',
  taboo: 'radial-gradient(circle at 12% 34%, rgba(22,101,52,0.34), transparent 24%), linear-gradient(135deg, rgba(5,46,22,0.96), rgba(15,23,42,0.92) 58%, rgba(20,83,45,0.72))',
  'nem-ferrando': 'radial-gradient(circle at 18% 28%, rgba(120,74,35,0.32), transparent 26%), linear-gradient(135deg, rgba(24,10,2,0.98), rgba(49,31,18,0.95) 58%, rgba(15,23,42,0.9))',
  'quem-sou-eu': 'radial-gradient(circle at 18% 26%, rgba(56,189,248,0.32), transparent 24%), linear-gradient(135deg, rgba(8,47,73,0.98), rgba(15,23,42,0.94) 58%, rgba(14,116,144,0.68))',
  adedonha: 'radial-gradient(circle at 18% 26%, rgba(250,204,21,0.32), transparent 24%), linear-gradient(135deg, rgba(66,32,6,0.98), rgba(15,23,42,0.94) 58%, rgba(133,77,14,0.68))',
  'cidade-dorme': 'radial-gradient(circle at 18% 26%, rgba(37,99,235,0.3), transparent 24%), linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.94) 58%, rgba(30,58,138,0.68))',
}

const defaultCover = 'radial-gradient(circle at 18% 24%, rgba(139,92,246,0.28), transparent 24%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,27,75,0.9))'

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
}

const defaultTheme = {
  icon: 'border-violet-400/35 bg-slate-950/55 text-violet-300 shadow-violet-950/30',
  title: 'text-violet-300',
  action: 'border-violet-400 text-violet-300 hover:border-transparent hover:bg-violet-500 hover:text-white',
}

export function GameCard({ game }: { game: GameModule }) {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const available = game.status === 'available'
  const name = t(`games.${game.id}.name`, { defaultValue: game.name })
  const description = t(`games.${game.id}.shortDescription`, { defaultValue: game.shortDescription })
  const longDescription = t(`games.${game.id}.description`, { defaultValue: game.description })
  const players = game.maxPlayers ? `${game.minPlayers}-${game.maxPlayers}` : `${game.minPlayers}+`
  const theme = cardThemes[game.id] ?? defaultTheme
  const cardStyle: CSSProperties = {
    backgroundImage: game.coverImage
      ? `linear-gradient(90deg, rgba(2,6,23,0.9), rgba(2,6,23,0.58) 52%, rgba(2,6,23,0.86)), url("${game.coverImage}")`
      : coverFallbacks[game.id] ?? defaultCover,
    backgroundPosition: game.coverImage ? 'center right' : 'center',
    backgroundSize: 'cover',
  }
  const openGame = async () => { if (!available) return; await AppHaptics.light(); await showFakeAd({ placement: 'hub-play' }); navigate(game.route) }

  return (
    <>
      <Card
        className={cn(
          'relative min-h-36 overflow-hidden border-white/10 p-0',
          available ? 'shadow-2xl shadow-violet-950/20' : 'opacity-80 grayscale-[0.15]',
        )}
        style={cardStyle}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/78 via-slate-950/42 to-slate-950/68" />
        <div className="relative flex min-h-36 flex-col justify-between gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('rounded-2xl border p-3 shadow-lg backdrop-blur', available ? theme.icon : 'border-white/10 bg-white/10 text-slate-300')}>
              <GameIcon name={game.iconName} />
            </div>
            <div className="flex items-center gap-2">
              {!available ? <GameStatusBadge status={game.status} /> : null}
              <Button
                aria-label={t('howToPlay', { name })}
                className="size-10 rounded-full border-white/10 bg-slate-950/45 text-white backdrop-blur hover:bg-white/15"
                size="icon"
                variant="secondary"
                onClick={() => setTutorialOpen(true)}
              >
                <CircleHelp size={18} />
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
              aria-label={available ? t('playNow') : t('comingSoon')}
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
