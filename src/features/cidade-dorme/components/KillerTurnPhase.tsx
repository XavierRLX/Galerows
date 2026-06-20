import { Check, Skull, Target } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type KillerTurnPhaseProps = {
  session: GameState
  onConfirmTarget: (actorId: string, targetId: string) => void | Promise<void>
}

export function KillerTurnPhase({ session, onConfirmTarget }: KillerTurnPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const alivePlayers = getAlivePlayers(session.players)
  const aliveKillers = alivePlayers.filter((player) => player.roleKey === 'killer')
  const [selectedActorId, setSelectedActorId] = useState(session.currentNightAction.killerActorId ?? aliveKillers[0]?.id ?? '')
  const effectiveActorId = aliveKillers.some((player) => player.id === selectedActorId) ? selectedActorId : aliveKillers[0]?.id ?? ''
  const targets = alivePlayers.filter((player) => player.id !== effectiveActorId)
  const [selectedTargetId, setSelectedTargetId] = useState(targets.some((player) => player.id === session.currentNightAction.killerTargetId) ? session.currentNightAction.killerTargetId ?? '' : '')
  const selectedActor = aliveKillers.find((player) => player.id === effectiveActorId)
  const selectedPlayer = targets.find((player) => player.id === selectedTargetId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-rose-300 text-slate-950 shadow-xl shadow-rose-500/20">
        <Skull size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('killerTurn.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('killerTurn.wakeScript')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 shrink-0 text-rose-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-rose-200">{t('killerTurn.targetTitle')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{t('killerTurn.targetHint')}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
        <p className="text-sm font-black uppercase tracking-wider text-rose-200">{t('killerTurn.actorsTitle')}</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{aliveKillers.map((player) => player.name).join(', ')}</p>
      </div>

      {aliveKillers.length > 1 ? <div className="mt-5">
        <p className="text-sm font-black uppercase tracking-wider text-rose-200">{t('killerTurn.actorTitle')}</p>
        <div className="mt-3 grid gap-2">
          {aliveKillers.map((player) => {
            const selected = effectiveActorId === player.id
            return <button
              aria-pressed={selected}
              className={cn('flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-rose-300 bg-rose-300/10 text-rose-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
              key={player.id}
              onClick={() => { setSelectedActorId(player.id); if (selectedTargetId === player.id) setSelectedTargetId('') }}
              type="button"
            >
              <span className="min-w-0 font-bold">{player.name}</span>
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-rose-300 bg-rose-300 text-slate-950' : 'border-white/20')}>
                {selected ? <Check size={17} /> : null}
              </span>
            </button>
          })}
        </div>
      </div> : selectedActor ? <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200">{t('killerTurn.singleActor', { name: selectedActor.name })}</p> : null}

      <div className="mt-5 grid gap-2">
        {targets.map((player) => {
          const selected = selectedTargetId === player.id
          return <button
            aria-pressed={selected}
            className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-rose-300 bg-rose-300/10 text-rose-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={player.id}
            onClick={() => setSelectedTargetId(player.id)}
            type="button"
          >
            <span className="min-w-0 font-bold">{player.name}</span>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-rose-300 bg-rose-300 text-slate-950' : 'border-white/20')}>
              {selected ? <Check size={17} /> : null}
            </span>
          </button>
        })}
      </div>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-rose-300 text-slate-950 hover:bg-rose-200" disabled={!selectedActor || !selectedPlayer} size="lg" onClick={() => selectedActor && selectedPlayer && void onConfirmTarget(selectedActor.id, selectedPlayer.id)}>
        <Check size={19} />
        {t('killerTurn.confirm')}
      </Button>
      <p className="mt-3 text-center text-sm font-bold text-rose-100">{t('killerTurn.sleepScript')}</p>
    </div>
  </>
}
