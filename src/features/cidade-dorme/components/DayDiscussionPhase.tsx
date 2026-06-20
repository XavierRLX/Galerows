import { MessageCircle, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'

type DayDiscussionPhaseProps = {
  round: number
  onStartVoting: () => void | Promise<void>
}

export function DayDiscussionPhase({ round, onStartVoting }: DayDiscussionPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-amber-300 text-slate-950 shadow-xl shadow-amber-500/20">
        <Sun size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('dayDiscussion.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('dayDiscussion.description', { round })}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 shrink-0 text-amber-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-amber-200">{t('dayDiscussion.discussion')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{t('dayDiscussion.hint')}</p>
        </div>
      </div>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-amber-300 text-slate-950 hover:bg-amber-200" size="lg" onClick={() => void onStartVoting()}>
        {t('dayDiscussion.startVoting')}
      </Button>
    </div>
  </>
}
