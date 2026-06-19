import { History, Moon, Vote } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { getRoleDefinition } from '../cidadeDorme.roles'
import type { GameState, RoundHistory, VoteTargetId } from '../cidadeDorme.types'

type MediatorHistoryPanelProps = {
  session: GameState
}

export function MediatorHistoryPanel({ session }: MediatorHistoryPanelProps) {
  if (!session.history.length) return null

  return <details className="mx-auto mt-8 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-3 text-left font-black text-slate-100">
      <History className="text-blue-300" size={20} />
      Histórico privado do mediador
    </summary>
    <div className="mt-4 grid gap-4">
      {session.history.map((round) => <RoundHistoryCard key={round.round} round={round} session={session} />)}
    </div>
  </details>
}

function RoundHistoryCard({ round, session }: { round: RoundHistory; session: GameState }) {
  const action = round.nightAction
  const killerTarget = getPlayerName(session, action.killerTargetId)
  const protectedPlayer = getPlayerName(session, action.protectedPlayerId)
  const detectiveTarget = getPlayerName(session, action.detectiveTargetId)
  const eliminatedAtNight = getPlayerName(session, action.eliminatedPlayerId)
  const eliminatedByVote = getPlayerName(session, round.votingResult?.eliminatedPlayerId ?? round.eliminatedByVoteId)

  return <Card className="p-4">
    <p className="text-sm font-black uppercase tracking-wider text-blue-300">Rodada {round.round}</p>
    <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
      <div className="flex items-start gap-3">
        <Moon className="mt-0.5 shrink-0 text-indigo-200" size={18} />
        <div>
          <p><strong className="text-slate-100">Alvo dos Assassinos:</strong> {killerTarget}</p>
          <p><strong className="text-slate-100">Proteção do Médico:</strong> {protectedPlayer}</p>
          <p><strong className="text-slate-100">Investigação:</strong> {detectiveTarget}{action.detectiveResult ? ` (${action.detectiveResult === 'suspect' ? 'suspeito' : 'inocente'})` : ''}</p>
          <p><strong className="text-slate-100">Noite:</strong> {action.wasProtected ? 'ataque protegido' : eliminatedAtNight !== 'Ninguém' ? `${eliminatedAtNight} eliminado` : 'sem eliminação'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Vote className="mt-0.5 shrink-0 text-fuchsia-200" size={18} />
        <div>
          <p><strong className="text-slate-100">Votação:</strong> {getVotingSummary(round, eliminatedByVote)}</p>
          {round.votingResult ? <p><strong className="text-slate-100">Placar:</strong> {formatTally(round.votingResult.tally, session)}</p> : null}
        </div>
      </div>
    </div>
  </Card>
}

function getVotingSummary(round: RoundHistory, eliminatedByVote: string) {
  const kind = round.votingResult?.kind
  if (!kind && !round.votes.length) return 'ainda não registrada'
  if (kind === 'eliminated') return `${eliminatedByVote} eliminado`
  if (kind === 'skipped') return 'eliminação pulada'
  if (kind === 'tie') return 'empate sem eliminação'
  if (kind === 'revote') return 'empate para nova votação'
  if (kind === 'mediatorDecision') return 'empate para decisão do mediador'
  if (kind === 'noVotes') return 'sem votos válidos'
  return `${round.votes.length} voto(s) registrado(s)`
}

function formatTally(tally: Record<VoteTargetId, number>, session: GameState) {
  const entries = Object.entries(tally)
  if (!entries.length) return 'sem votos'
  return entries.map(([targetId, count]) => `${getPlayerName(session, targetId)} ${count}`).join(' · ')
}

function getPlayerName(session: GameState, playerId: string | undefined) {
  if (!playerId) return 'Ninguém'
  if (playerId === 'skip') return 'Pular'
  const player = session.players.find((item) => item.id === playerId)
  if (!player) return 'Ninguém'
  return `${player.name}${player.roleKey ? ` (${getRoleDefinition(player.roleKey).name})` : ''}`
}
