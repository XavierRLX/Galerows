import { Check, Search, UserSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type DetectiveTurnPhaseProps = {
  session: GameState
  onConfirmInvestigation: (detectiveTargetId: string) => void | Promise<void>
  onSkipTurn: () => void | Promise<void>
}

export function DetectiveTurnPhase({ session, onConfirmInvestigation, onSkipTurn }: DetectiveTurnPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const alivePlayers = getAlivePlayers(session.players)
  const detective = alivePlayers.find((player) => player.roleKey === 'detective')
  const targets = detective ? alivePlayers.filter((player) => player.id !== detective.id) : []
  const [selectedTargetId, setSelectedTargetId] = useState(targets.some((player) => player.id === session.currentNightAction.detectiveTargetId) ? session.currentNightAction.detectiveTargetId ?? '' : '')
  const [showResult, setShowResult] = useState(false)
  const selectedPlayer = targets.find((player) => player.id === selectedTargetId)
  const detectiveResult = selectedPlayer?.roleKey === 'killer' ? 'suspect' : 'innocent'

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/20">
        <UserSearch size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('detectiveTurn.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('detectiveTurn.wakeScript')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      {!detective ? <FakeDetectiveTurn onSkipTurn={onSkipTurn} /> : showResult && selectedPlayer ? <DetectiveResultStep result={detectiveResult} targetName={selectedPlayer.name} onContinue={() => void onConfirmInvestigation(selectedPlayer.id)} /> : <>
      <p className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-slate-200">{t('detectiveTurn.actor', { name: detective.name })}</p>
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 shrink-0 text-cyan-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-cyan-200">{t('detectiveTurn.targetTitle')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{t('detectiveTurn.targetHint')}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {targets.map((player) => {
          const selected = selectedTargetId === player.id
          return <button
            aria-pressed={selected}
            className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={player.id}
            onClick={() => setSelectedTargetId(player.id)}
            type="button"
          >
            <span className="min-w-0 font-bold">{player.name}</span>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/20')}>
              {selected ? <Check size={17} /> : null}
            </span>
          </button>
        })}
      </div>
      </>}
    </Card>

    {detective && !showResult ? <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={!selectedPlayer} size="lg" onClick={() => selectedPlayer && setShowResult(true)}>
        <Check size={19} />
        {t('detectiveTurn.confirm')}
      </Button>
    </div> : null}
  </>
}

function DetectiveResultStep({ targetName, result, onContinue }: { targetName: string; result: 'suspect' | 'innocent'; onContinue: () => void | Promise<void> }) {
  const { t } = useTranslation('cidade-dorme')
  return <div className="text-center">
    <Search className="mx-auto text-cyan-200" size={36} />
    <p className="mt-4 text-sm font-black uppercase tracking-wider text-cyan-200">{t('detectiveTurn.resultTitle')}</p>
    <p className="mt-3 text-2xl font-black text-white">{t(`detectiveTurn.results.${result}`)}</p>
    <p className="mt-3 text-sm leading-6 text-slate-300">{t('detectiveTurn.resultHint', { name: targetName })}</p>
    <Button className="mt-5 bg-cyan-300 text-slate-950 hover:bg-cyan-200" size="lg" onClick={() => void onContinue()}>
      <Check size={19} />
      {t('detectiveTurn.resultContinue')}
    </Button>
    <p className="mt-3 text-sm font-bold text-cyan-100">{t('detectiveTurn.sleepScript')}</p>
  </div>
}

function FakeDetectiveTurn({ onSkipTurn }: { onSkipTurn: () => void | Promise<void> }) {
  const { t } = useTranslation('cidade-dorme')
  return <div className="text-center">
    <Search className="mx-auto text-cyan-200" size={36} />
    <p className="mt-4 text-sm font-black uppercase tracking-wider text-cyan-200">{t('detectiveTurn.fakeTitle')}</p>
    <p className="mt-3 text-sm leading-6 text-slate-300">{t('detectiveTurn.fakeDescription')}</p>
    <Button className="mt-5 bg-cyan-300 text-slate-950 hover:bg-cyan-200" size="lg" onClick={() => void onSkipTurn()}>
      <Check size={19} />
      {t('detectiveTurn.fakeContinue')}
    </Button>
    <p className="mt-3 text-sm font-bold text-cyan-100">{t('detectiveTurn.sleepScript')}</p>
  </div>
}
