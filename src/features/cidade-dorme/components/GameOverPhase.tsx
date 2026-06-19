import { Trophy } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import type { GameState } from '../cidadeDorme.types'

type GameOverPhaseProps = {
  session: GameState
}

export function GameOverPhase({ session }: GameOverPhaseProps) {
  const winnerPlayer = session.players.find((player) => player.id === session.winnerPlayerId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-lime-300 text-slate-950 shadow-xl shadow-lime-500/20">
        <Trophy size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{getWinnerTitle(session, winnerPlayer?.name)}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Partida encerrada. A tela final completa com papéis e resumo fica para a próxima fase de resultado.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <p className="text-sm font-black uppercase tracking-wider text-lime-200">Jogadores</p>
      <div className="mt-4 grid gap-2">
        {session.players.map((player) => (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" key={player.id}>
            <span className="font-bold text-slate-100">{player.name}</span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">{player.status === 'alive' ? 'vivo' : 'eliminado'}</span>
          </div>
        ))}
      </div>
      {session.parallelWinners?.length ? <p className="mt-5 text-sm leading-6 text-lime-100">Vitória paralela do Coringa registrada.</p> : null}
    </Card>
  </>
}

function getWinnerTitle(session: GameState, winnerPlayerName?: string) {
  if (session.winner === 'city') return 'A Cidade venceu'
  if (session.winner === 'killers') return 'Os Assassinos venceram'
  if (session.winner === 'jester') return winnerPlayerName ? `${winnerPlayerName} venceu como Coringa` : 'O Coringa venceu'
  return 'Fim da partida'
}
