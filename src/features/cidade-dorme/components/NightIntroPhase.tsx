import { Moon, Play, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'

type NightIntroPhaseProps = {
  round: number
  onStartNightActions: () => void | Promise<void>
}

export function NightIntroPhase({ round, onStartNightActions }: NightIntroPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-blue-300 text-slate-950 shadow-xl shadow-blue-500/20">
        <Moon size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('nightIntro.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('nightIntro.description', { round })}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <p className="text-sm font-black uppercase tracking-wider text-blue-300">{t('nightIntro.scriptTitle')}</p>
      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
        <p>{t('nightIntro.stepOne')}</p>
        <p>{t('nightIntro.stepTwo')}</p>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-300">
        <UsersRound className="shrink-0 text-blue-200" size={20} />
        <span>{t('nightIntro.privacy')}</span>
      </div>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={() => void onStartNightActions()}>
        <Play size={19} />
        {t('nightIntro.start')}
      </Button>
    </div>
  </>
}
