import { Check, ListChecks, RotateCcw, UserCheck } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { resolveVoting } from '../cidadeDorme.rules'
import type { GameState, VoteTargetId } from '../cidadeDorme.types'

type VoteResolutionPhaseProps = {
  session: GameState
  onResolveVoting: () => void | Promise<void>
  onStartRevote: () => void | Promise<void>
  onMediatorDecision: (targetId: VoteTargetId) => void | Promise<void>
  onContinue: () => void | Promise<void>
}

export function VoteResolutionPhase({ session, onResolveVoting, onStartRevote, onMediatorDecision, onContinue }: VoteResolutionPhaseProps) {
  const { t } = useTranslation('cidade-dorme')
  const history = session.history.find((round) => round.round === session.round)
  const resolved = Boolean(history?.votingResult && areVotesEqual(history.votes, session.currentVotes))
  const preview = resolved ? null : resolveVoting(session.players, session.currentVotes, session.settings, session.round)
  const tally = resolved ? tallyVotes(history?.votes ?? []) : preview?.tally ?? {}
  const eliminated = session.players.find((player) => player.id === history?.eliminatedByVoteId)
  const resolutionKind = resolved ? history?.votingResult?.kind ?? 'noVotes' : preview?.kind ?? 'noVotes'
  const tiedTargetIds = resolved ? history?.votingResult?.tiedTargetIds ?? [] : preview?.tiedTargetIds ?? []

  return <>
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-violet-300 text-slate-950 shadow-xl shadow-violet-500/20">
        <ListChecks size={40} />
      </div>
      <h1 className="mt-5 text-3xl font-black">{t('voteResolution.title')}</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">
        {t('voteResolution.description')}
      </p>
    </div>

    <Card className="mx-auto mt-8 max-w-lg p-5">
      <div className="grid gap-3">
        {Object.entries(tally).map(([targetId, count]) => (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" key={targetId}>
            <span className="font-bold text-slate-100">{targetId === 'skip' ? t('common.skipElimination') : session.players.find((player) => player.id === targetId)?.name ?? targetId}</span>
            <span className="text-sm font-black text-violet-200">{count}</span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300">{resolved ? getResolvedText(t, resolutionKind, eliminated?.name) : getResolutionText(t, preview?.kind ?? 'noVotes', session.players.find((player) => player.id === preview?.eliminatedPlayerId)?.name)}</p>
    </Card>

    <div className="mx-auto mt-6 grid max-w-lg">
      {resolved && resolutionKind === 'revote' ? <Button className="bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200" size="lg" onClick={() => void onStartRevote()}>
        <RotateCcw size={19} />
        {t('voteResolution.revote')}
      </Button> : null}
      {resolutionKind === 'mediatorDecision' ? <MediatorDecisionActions session={session} tiedTargetIds={tiedTargetIds} onMediatorDecision={onMediatorDecision} /> : null}
      {resolved && resolutionKind !== 'revote' && resolutionKind !== 'mediatorDecision' ? <Button className="bg-violet-300 text-slate-950 hover:bg-violet-200" size="lg" onClick={() => void onContinue()}>
        <Check size={19} />
        {t('common.continue')}
      </Button> : null}
      {!resolved && resolutionKind !== 'mediatorDecision' ? <Button className="bg-violet-300 text-slate-950 hover:bg-violet-200" size="lg" onClick={() => void onResolveVoting()}>
        <Check size={19} />
        {t('voteResolution.apply')}
      </Button> : null}
    </div>
  </>
}

function getResolutionText(t: TFunction<'cidade-dorme'>, kind: ReturnType<typeof resolveVoting>['kind'], eliminatedName?: string) {
  if (kind === 'eliminated') return eliminatedName ? t('voteResolution.texts.eliminated', { name: eliminatedName }) : t('voteResolution.texts.eliminatedFallback')
  if (kind === 'skipped') return t('voteResolution.texts.skipped')
  if (kind === 'revote') return t('voteResolution.texts.revote')
  if (kind === 'mediatorDecision') return t('voteResolution.texts.mediatorDecision')
  if (kind === 'tie') return t('voteResolution.texts.tie')
  return t('voteResolution.texts.noVotes')
}

function getResolvedText(t: TFunction<'cidade-dorme'>, kind: ReturnType<typeof resolveVoting>['kind'], eliminatedName?: string) {
  if (kind === 'revote') return t('voteResolution.texts.resolvedRevote')
  if (kind === 'mediatorDecision') return t('voteResolution.texts.resolvedMediator')
  return eliminatedName ? t('voteResolution.texts.resolvedEliminated', { name: eliminatedName }) : t('voteResolution.texts.resolvedNoElimination')
}

function tallyVotes(votes: NonNullable<GameState['currentVotes']>) {
  return votes.reduce<Record<string, number>>((tally, vote) => {
    tally[vote.targetId] = (tally[vote.targetId] ?? 0) + 1
    return tally
  }, {})
}

function MediatorDecisionActions({ session, tiedTargetIds, onMediatorDecision }: { session: GameState; tiedTargetIds: VoteTargetId[]; onMediatorDecision: (targetId: VoteTargetId) => void | Promise<void> }) {
  const { t } = useTranslation('cidade-dorme')
  if (!tiedTargetIds.length) return null
  return <div className="grid gap-2">
    <p className="text-center text-sm font-black uppercase tracking-wider text-violet-200">{t('voteResolution.mediatorTitle')}</p>
    {tiedTargetIds.map((targetId) => (
      <Button className="bg-violet-300 text-slate-950 hover:bg-violet-200" key={targetId} size="lg" onClick={() => void onMediatorDecision(targetId)}>
        <UserCheck size={19} />
        {targetId === 'skip' ? t('common.skipElimination') : t('voteResolution.eliminate', { name: session.players.find((player) => player.id === targetId)?.name ?? targetId })}
      </Button>
    ))}
  </div>
}

function areVotesEqual(left: readonly { voterId: string; targetId: VoteTargetId }[], right: readonly { voterId: string; targetId: VoteTargetId }[]) {
  if (left.length !== right.length) return false
  const rightByVoter = new Map(right.map((vote) => [vote.voterId, vote.targetId]))
  return left.every((vote) => rightByVoter.get(vote.voterId) === vote.targetId)
}
