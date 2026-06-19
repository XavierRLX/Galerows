import { Check, Shield, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { canDoctorProtect, getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type DoctorTurnPhaseProps = {
  session: GameState
  onConfirmProtection: (protectedPlayerId: string) => void | Promise<void>
}

export function DoctorTurnPhase({ session, onConfirmProtection }: DoctorTurnPhaseProps) {
  const alivePlayers = getAlivePlayers(session.players)
  const doctor = alivePlayers.find((player) => player.roleKey === 'doctor')
  const previousProtectedPlayerId = [...session.history].reverse().find((round) => round.nightAction.protectedPlayerId)?.nightAction.protectedPlayerId
  const validTargets = alivePlayers.filter((player) => doctor && canDoctorProtect(doctor.id, player.id, session.settings, previousProtectedPlayerId))
  const [selectedTargetId, setSelectedTargetId] = useState(validTargets.some((player) => player.id === session.currentNightAction.protectedPlayerId) ? session.currentNightAction.protectedPlayerId ?? '' : '')
  const selectedPlayer = validTargets.find((player) => player.id === selectedTargetId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-emerald-300 text-slate-950 shadow-xl shadow-emerald-500/20">
        <Shield size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">Médico acorda</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Peça para o Médico abrir os olhos em silêncio e escolher uma pessoa para proteger.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-emerald-200" size={22} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-emerald-200">Proteção da noite</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">As opções respeitam as regras de autoproteção e repetição configuradas.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {validTargets.map((player) => {
          const selected = selectedTargetId === player.id
          return <button
            aria-pressed={selected}
            className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-emerald-300 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={player.id}
            onClick={() => setSelectedTargetId(player.id)}
            type="button"
          >
            <span className="min-w-0 font-bold">{player.name}</span>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-white/20')}>
              {selected ? <Check size={17} /> : null}
            </span>
          </button>
        })}
      </div>
      {!validTargets.length ? <p className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">Nenhum alvo válido para o Médico nesta rodada.</p> : null}
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-emerald-300 text-slate-950 hover:bg-emerald-200" disabled={!selectedPlayer} size="lg" onClick={() => selectedPlayer && void onConfirmProtection(selectedPlayer.id)}>
        <Check size={19} />
        Confirmar proteção
      </Button>
    </div>
  </>
}
