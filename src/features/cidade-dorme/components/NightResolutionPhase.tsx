import { Check, Moon, ShieldCheck, Skull } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { GameState } from '../cidadeDorme.types'

type NightResolutionPhaseProps = {
  session: GameState
  onResolveNight: () => void | Promise<void>
  onContinue: () => void | Promise<void>
}

export function NightResolutionPhase({ session, onResolveNight, onContinue }: NightResolutionPhaseProps) {
  const action = session.currentNightAction
  const resolved = typeof action.wasProtected === 'boolean'
  const eliminated = session.players.find((player) => player.id === action.eliminatedPlayerId)
  const detectiveTarget = session.players.find((player) => player.id === action.detectiveTargetId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-indigo-300 text-slate-950 shadow-xl shadow-indigo-500/20">
        <Moon size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">Resolver noite</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Confira o resultado em privado antes de acordar a cidade.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      {!resolved ? <div className="text-center">
        <p className="text-sm leading-6 text-slate-300">As ações já foram registradas. Toque para aplicar proteção, investigação e possível eliminação.</p>
        <Button className="mt-5 bg-indigo-300 text-slate-950 hover:bg-indigo-200" size="lg" onClick={() => void onResolveNight()}>
          <Check size={19} />
          Resolver noite
        </Button>
      </div> : <div className="grid gap-4">
        <ResultLine
          icon={<Skull size={21} />}
          label="Ataque"
          text={eliminated ? `${eliminated.name} foi eliminado durante a noite.` : 'Ninguém morreu durante a noite.'}
        />
        <ResultLine
          icon={<ShieldCheck size={21} />}
          label="Proteção"
          text={action.wasProtected ? 'A proteção do Médico impediu a eliminação.' : 'A vítima não estava protegida.'}
        />
        {detectiveTarget && action.detectiveResult ? <ResultLine
          icon={<Check size={21} />}
          label="Detetive"
          text={`${detectiveTarget.name} parece ${action.detectiveResult === 'suspect' ? 'suspeito' : 'inocente'}.`}
        /> : null}
      </div>}
    </Card>

    {resolved ? <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-indigo-300 text-slate-950 hover:bg-indigo-200" size="lg" onClick={() => void onContinue()}>
        <Check size={19} />
        Continuar
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
