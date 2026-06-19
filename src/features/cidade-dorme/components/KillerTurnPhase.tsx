import { Check, Skull, Target } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type KillerTurnPhaseProps = {
  session: GameState
  onConfirmTarget: (targetId: string) => void | Promise<void>
}

export function KillerTurnPhase({ session, onConfirmTarget }: KillerTurnPhaseProps) {
  const alivePlayers = getAlivePlayers(session.players)
  const [selectedTargetId, setSelectedTargetId] = useState(session.currentNightAction.killerTargetId ?? '')
  const selectedPlayer = alivePlayers.find((player) => player.id === selectedTargetId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-rose-300 text-slate-950 shadow-xl shadow-rose-500/20">
        <Skull size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">Assassinos acordam</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Peça para os Assassinos abrirem os olhos em silêncio e apontarem uma vítima.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 shrink-0 text-rose-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-rose-200">Vítima da noite</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Escolha apenas pelo nome. A tela não revela funções secretas.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {alivePlayers.map((player) => {
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
      <Button className="bg-rose-300 text-slate-950 hover:bg-rose-200" disabled={!selectedPlayer} size="lg" onClick={() => selectedPlayer && void onConfirmTarget(selectedPlayer.id)}>
        <Check size={19} />
        Confirmar vítima
      </Button>
    </div>
  </>
}
