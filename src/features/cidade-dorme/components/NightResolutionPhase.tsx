import { Check, Moon, ShieldCheck, Skull } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { getTranslatedRole } from '../cidadeDorme.copy'
import type { GameState } from '../cidadeDorme.types'

type NightResolutionPhaseProps = {
  session: GameState
  onResolveNight: () => void | Promise<void>
  onContinue: () => void | Promise<void>
}

export function NightResolutionPhase({ session, onResolveNight, onContinue }: NightResolutionPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const action = session.currentNightAction
  const resolved = typeof action.wasProtected === 'boolean'
  const eliminated = session.players.find((player) => player.id === action.eliminatedPlayerId)
  const detectiveTarget = session.players.find((player) => player.id === action.detectiveTargetId)
  const eliminatedRole = eliminated?.roleKey ? getTranslatedRole(t, eliminated.roleKey).name : ''

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-indigo-300 text-slate-950 shadow-xl shadow-indigo-500/20">
        <Moon size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('nightResolution.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('nightResolution.description')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      {!resolved ? <div className="text-center">
        <p className="text-sm leading-6 text-slate-300">{t('nightResolution.pending')}</p>
        <Button className="mt-5 bg-indigo-300 text-slate-950 hover:bg-indigo-200" size="lg" onClick={() => void onResolveNight()}>
          <Check size={19} />
          {t('nightResolution.resolve')}
        </Button>
      </div> : <div className="grid gap-4">
        <ResultLine
          icon={<Moon size={21} />}
          label={t('nightResolution.announcement')}
          text={eliminated ? t(session.settings.revealRoleOnDeath ? 'nightResolution.announceKilledWithRole' : 'nightResolution.announceKilled', { name: eliminated.name, role: eliminatedRole }) : t('nightResolution.announceNoKill')}
        />
        <ResultLine
          icon={<Skull size={21} />}
          label={t('nightResolution.attack')}
          text={eliminated ? t(session.settings.revealRoleOnDeath ? 'nightResolution.attackKilledWithRole' : 'nightResolution.attackKilled', { name: eliminated.name, role: eliminatedRole }) : t('nightResolution.attackNone')}
        />
        <ResultLine
          icon={<ShieldCheck size={21} />}
          label={t('nightResolution.protection')}
          text={action.wasProtected ? t('nightResolution.protected') : t('nightResolution.notProtected')}
        />
        {detectiveTarget && action.detectiveResult ? <ResultLine
          icon={<Check size={21} />}
          label={t('nightResolution.detective')}
          text={t('nightResolution.detectiveResult', { name: detectiveTarget.name, result: t(`nightResolution.${action.detectiveResult}`) })}
        /> : null}
      </div>}
    </Card>

    {resolved ? <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-indigo-300 text-slate-950 hover:bg-indigo-200" size="lg" onClick={() => void onContinue()}>
        <Check size={19} />
        {t('common.continue')}
      </Button>
    </div> : null}
  </>
}

function ResultLine({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="mt-0.5 text-indigo-200">{icon}</div>
    <div>
      <p className="text-sm font-black uppercase tracking-wider text-indigo-200">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{text}</p>
    </div>
  </div>
}
