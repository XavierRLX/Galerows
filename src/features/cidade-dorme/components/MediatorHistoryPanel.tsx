import { History, Moon, Vote } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/ui/Card'
import { getTranslatedRole } from '../cidadeDorme.copy'
import type { GameState, RoundHistory } from '../cidadeDorme.types'

type MediatorHistoryPanelProps = {
  session: GameState
}

export function MediatorHistoryPanel({ session }: MediatorHistoryPanelProps) {
  const { t } = useTranslation('cidade-dorme')
  if (!session.history.length) return null

  return <details className="mx-auto mt-8 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-3 text-left font-black text-slate-100">
      <History className="text-blue-300" size={20} />
      {t('history.title')}
    </summary>
    <div className="mt-4 grid gap-4">
      {session.history.map((round) => <RoundHistoryCard key={round.round} round={round} session={session} />)}
    </div>
  </details>
}

function RoundHistoryCard({ round, session }: { round: RoundHistory; session: GameState }) {
  const { t } = useTranslation('cidade-dorme')
  const action = round.nightAction
  const killerActor = getPlayerName(t, session, action.killerActorId)
  const killerTarget = getPlayerName(t, session, action.killerTargetId)
  const protectedPlayer = getPlayerName(t, session, action.protectedPlayerId)
  const detectiveTarget = getPlayerName(t, session, action.detectiveTargetId)
  const eliminatedAtNight = getPlayerName(t, session, action.eliminatedPlayerId)
  const eliminatedByVote = getPlayerName(t, session, round.votingResult?.eliminatedPlayerId ?? round.eliminatedByVoteId)

  return <Card className="p-4">
    <p className="text-sm font-black uppercase tracking-wider text-blue-300">{t('history.round', { round: round.round })}</p>
    <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
      <div className="flex items-start gap-3">
        <Moon className="mt-0.5 shrink-0 text-indigo-200" size={18} />
        <div>
          <p><strong className="text-slate-100">{t('history.killerActor')}</strong> {killerActor}</p>
          <p><strong className="text-slate-100">{t('history.killerTarget')}</strong> {killerTarget}</p>
          <p><strong className="text-slate-100">{t('history.doctorProtection')}</strong> {protectedPlayer}</p>
          <p><strong className="text-slate-100">{t('history.investigation')}</strong> {detectiveTarget}{action.detectiveResult ? ` (${t(`nightResolution.${action.detectiveResult}`)})` : ''}</p>
          <p><strong className="text-slate-100">{t('history.night')}</strong> {action.wasProtected ? t('history.attackProtected') : eliminatedAtNight !== t('common.none') ? t('history.nightKilled', { name: eliminatedAtNight }) : t('history.noNightKill')}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Vote className="mt-0.5 shrink-0 text-fuchsia-200" size={18} />
        <div>
          <p><strong className="text-slate-100">{t('history.vote')}</strong> {getVotingSummary(t, round, eliminatedByVote)}</p>
        </div>
      </div>
    </div>
  </Card>
}

function getVotingSummary(t: TFunction<'cidade-dorme'>, round: RoundHistory, eliminatedByVote: string) {
  const kind = round.votingResult?.kind
  if (!kind) return t('history.notRegistered')
  if (kind === 'eliminated') return t('history.voteKilled', { name: eliminatedByVote })
  if (kind === 'tie') return t('history.tie')
  return t('history.notRegistered')
}

function getPlayerName(t: TFunction<'cidade-dorme'>, session: GameState, playerId: string | undefined) {
  if (!playerId) return t('common.none')
  if (playerId === 'skip') return t('common.skip')
  const player = session.players.find((item) => item.id === playerId)
  if (!player) return t('common.none')
  return `${player.name}${player.roleKey ? ` (${getTranslatedRole(t, player.roleKey).name})` : ''}`
}
