import { Check, Vote } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils/cn'
import { getAlivePlayers } from '../cidadeDorme.rules'
import type { GameState, VoteTargetId } from '../cidadeDorme.types'

type VotingPhaseProps = {
  session: GameState
  onCastVote: (voterId: string, targetId: VoteTargetId) => void | Promise<void>
  onFinishVoting: () => void | Promise<void>
}

export function VotingPhase({ session, onCastVote, onFinishVoting }: VotingPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const alivePlayers = getAlivePlayers(session.players)
  const currentVotingResult = session.history.find((round) => round.round === session.round)?.votingResult
  const revoteTargetIds = currentVotingResult?.kind === 'revote' ? currentVotingResult.tiedTargetIds : undefined
  const [activeVoterId, setActiveVoterId] = useState(alivePlayers[0]?.id ?? '')
  const activeVote = session.currentVotes.find((vote) => vote.voterId === activeVoterId)
  const votedCount = new Set(session.currentVotes.map((vote) => vote.voterId)).size
  const targets = useMemo(() => [
    ...alivePlayers.map((player) => ({ id: player.id as VoteTargetId, label: player.name })),
    ...(session.settings.allowSkipVote ? [{ id: 'skip' as const, label: t('common.skipElimination') }] : []),
  ].filter((target) => !revoteTargetIds?.length || revoteTargetIds.includes(target.id)), [alivePlayers, revoteTargetIds, session.settings.allowSkipVote, t])

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-fuchsia-300 text-slate-950 shadow-xl shadow-fuchsia-500/20">
        <Vote size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('voting.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {revoteTargetIds?.length ? t('voting.revoteDescription') : t('voting.description')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <p className="text-sm font-black uppercase tracking-wider text-fuchsia-200">{t('voting.voterTitle')}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {alivePlayers.map((player) => {
          const selected = activeVoterId === player.id
          const hasVote = session.currentVotes.some((vote) => vote.voterId === player.id)
          return <button
            className={cn('min-h-12 rounded-2xl border px-3 text-sm font-bold transition', selected ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={player.id}
            onClick={() => setActiveVoterId(player.id)}
            type="button"
          >
            {player.name}{hasVote ? ' ✓' : ''}
          </button>
        })}
      </div>

      <p className="mt-6 text-sm font-black uppercase tracking-wider text-fuchsia-200">{t('voting.voteTitle')}</p>
      <div className="mt-4 grid gap-2">
        {targets.map((target) => {
          const selected = activeVote?.targetId === target.id
          return <button
            aria-pressed={selected}
            className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100' : 'border-white/10 bg-white/[0.05] text-slate-100')}
            key={target.id}
            onClick={() => activeVoterId && void onCastVote(activeVoterId, target.id)}
            type="button"
          >
            <span className="min-w-0 font-bold">{target.label}</span>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'border-fuchsia-300 bg-fuchsia-300 text-slate-950' : 'border-white/20')}>
              {selected ? <Check size={17} /> : null}
            </span>
          </button>
        })}
      </div>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      <Button className="bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200" disabled={votedCount === 0} size="lg" onClick={() => void onFinishVoting()}>
        <Check size={19} />
        {t('voting.finish', { voted: votedCount, total: alivePlayers.length })}
      </Button>
    </div>
  </>
}
