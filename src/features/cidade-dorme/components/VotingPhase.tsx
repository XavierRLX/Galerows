import { Check, Scale, Vote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState, ManualVotingOutcome } from '../cidadeDorme.types'

type VotingPhaseProps = {
  session: GameState
  onResolveVoting: (outcome: ManualVotingOutcome) => void | Promise<void>
}

export function VotingPhase({ session, onResolveVoting }: VotingPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const alivePlayers = getAlivePlayers(session.players)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const selectedPlayer = alivePlayers.find((player) => player.id === selectedPlayerId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-fuchsia-300 text-slate-950 shadow-xl shadow-fuchsia-500/20">
        <Vote size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('voting.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('voting.description')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <p className="text-sm font-black uppercase tracking-wider text-fuchsia-200">{t('voting.eliminatedTitle')}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{t('voting.eliminatedHint')}</p>
      <div className="mt-5 grid gap-2">
        {alivePlayers.map((player) => {
          const selected = selectedPlayerId === player.id
          return <button
            aria-pressed={selected}
            className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            type="button"
          >
            <span className="min-w-0 font-bold">{player.name}</span>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-fuchsia-300 bg-fuchsia-300 text-slate-950' : 'border-white/20')}>
              {selected ? <Check size={17} /> : null}
            </span>
          </button>
        })}
      </div>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg gap-3">
      <Button className="bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200" disabled={!selectedPlayer} size="lg" onClick={() => selectedPlayer && void onResolveVoting({ kind: 'eliminated', playerId: selectedPlayer.id })}>
        <Check size={19} />
        {selectedPlayer ? t('voting.confirmElimination', { name: selectedPlayer.name }) : t('voting.confirmEliminationFallback')}
      </Button>
      <Button size="lg" variant="secondary" onClick={() => void onResolveVoting({ kind: 'tie' })}>
        <Scale size={19} />
        {t('voting.markTie')}
      </Button>
    </div>
  </>
}
