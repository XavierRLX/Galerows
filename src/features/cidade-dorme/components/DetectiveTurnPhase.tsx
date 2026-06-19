import { Check, Search, UserSearch } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type DetectiveTurnPhaseProps = {
  session: GameState
  onConfirmInvestigation: (detectiveTargetId: string) => void | Promise<void>
}

export function DetectiveTurnPhase({ session, onConfirmInvestigation }: DetectiveTurnPhaseProps) {
  const alivePlayers = getAlivePlayers(session.players)
  const [selectedTargetId, setSelectedTargetId] = useState(session.currentNightAction.detectiveTargetId ?? '')
  const selectedPlayer = alivePlayers.find((player) => player.id === selectedTargetId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/20">
        <UserSearch size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">Detetive acorda</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Peça para o Detetive abrir os olhos em silêncio e apontar uma pessoa para investigar.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 shrink-0 text-cyan-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-cyan-200">Investigação da noite</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Escolha apenas pelo nome. O resultado aparece só para o mediador.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {alivePlayers.map((player) => {
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
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={!selectedPlayer} size="lg" onClick={() => selectedPlayer && void onConfirmInvestigation(selectedPlayer.id)}>
        <Check size={19} />
        Confirmar investigação
      </Button>
    </div>
  </>
}
