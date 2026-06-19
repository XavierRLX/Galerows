import { Check, ListChecks } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { resolveVoting } from '../cidadeDorme.rules'
import type { GameState } from '../cidadeDorme.types'

type VoteResolutionPhaseProps = {
  session: GameState
  onResolveVoting: () => void | Promise<void>
  onContinue: () => void | Promise<void>
}

export function VoteResolutionPhase({ session, onResolveVoting, onContinue }: VoteResolutionPhaseProps) {
  const history = session.history.find((round) => round.round === session.round)
  const resolved = Boolean(history && history.votes.length === session.currentVotes.length)
  const preview = resolved ? null : resolveVoting(session.players, session.currentVotes, session.settings, session.round)
  const tally = resolved ? tallyVotes(history?.votes ?? []) : preview?.tally ?? {}
  const eliminated = session.players.find((player) => player.id === history?.eliminatedByVoteId)

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-violet-300 text-slate-950 shadow-xl shadow-violet-500/20">
        <ListChecks size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">Resultado da votação</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        Confirme a contagem e aplique a consequência da votação.
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="grid gap-3">
        {Object.entries(tally).map(([targetId, count]) => (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" key={targetId}>
            <span className="font-bold text-slate-100">{targetId === 'skip' ? 'Pular eliminação' : session.players.find((player) => player.id === targetId)?.name ?? targetId}</span>
            <span className="text-sm font-black text-violet-200">{count}</span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300">{resolved ? getResolvedText(eliminated?.name) : getResolutionText(preview?.kind ?? 'noVotes', session.players.find((player) => player.id === preview?.eliminatedPlayerId)?.name)}</p>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      {resolved ? <Button className="bg-violet-300 text-slate-950 hover:bg-violet-200" size="lg" onClick={() => void onContinue()}>
        <Check size={19} />
        Continuar
      </Button> : <Button className="bg-violet-300 text-slate-950 hover:bg-violet-200" size="lg" onClick={() => void onResolveVoting()}>
        <Check size={19} />
        Aplicar resultado
      </Button>}
    </div>
  </>
}

function getResolutionText(kind: ReturnType<typeof resolveVoting>['kind'], eliminatedName?: string) {
  if (kind === 'eliminated') return eliminatedName ? `${eliminatedName} será eliminado pela votação.` : 'Um jogador será eliminado pela votação.'
  if (kind === 'skipped') return 'A cidade escolheu pular a eliminação.'
  if (kind === 'revote') return 'Houve empate. A próxima versão terá uma rodada de desempate dedicada; por enquanto ninguém é eliminado.'
  if (kind === 'mediatorDecision') return 'Houve empate. A decisão do mediador será refinada em uma próxima etapa; por enquanto ninguém é eliminado.'
  if (kind === 'tie') return 'Houve empate e ninguém será eliminado.'
  return 'Nenhum voto válido foi registrado.'
}

function getResolvedText(eliminatedName?: string) {
  return eliminatedName ? `${eliminatedName} foi eliminado pela votação.` : 'A votação foi aplicada sem eliminação.'
}

function tallyVotes(votes: NonNullable<GameState['currentVotes']>) {
  return votes.reduce<Record<string, number>>((tally, vote) => {
    tally[vote.targetId] = (tally[vote.targetId] ?? 0) + 1
    return tally
  }, {})
}
