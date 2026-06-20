import { Eye, EyeOff, Home, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import { DayDiscussionPhase } from './components/DayDiscussionPhase'
import { DetectiveTurnPhase } from './components/DetectiveTurnPhase'
import { DoctorTurnPhase } from './components/DoctorTurnPhase'
import { KillerTurnPhase } from './components/KillerTurnPhase'
import { MediatorHistoryPanel } from './components/MediatorHistoryPanel'
import { NightIntroPhase } from './components/NightIntroPhase'
import { NightResolutionPhase } from './components/NightResolutionPhase'
import { VotingPhase } from './components/VotingPhase'
import { getTranslatedRole } from './cidadeDorme.copy'
import { getClassicRoleTheme } from './cidadeDorme.theme'
import { useCidadeDormeStore } from './cidadeDorme.store'
import type { GameState } from './cidadeDorme.types'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

export function CidadeDormePlayScreen() {
  const { t } = useTranslation('cidade-dorme')
  const navigate = useNavigate()
  const { session, initialized, advanceReveal, advancePhase, chooseKillerTarget, chooseDoctorProtection, chooseDetectiveTarget, resolveNight, resolveVoting } = useCidadeDormeStore()
  const [showSecret, setShowSecret] = useState(false)
  useCidadeDormeInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/cidade-dorme', { replace: true })
  }, [initialized, navigate, session])
  useEffect(() => {
    if (initialized && session?.phase === 'gameOver') navigate('/games/cidade-dorme/result', { replace: true })
  }, [initialized, navigate, session?.phase])
  if (!session) return <div className="p-6 text-slate-400">{t('loadingGame')}</div>

  if (session.phase === 'revealRoles') {
    const player = session.players[session.currentRevealIndex]
    const roleKey = player?.roleKey
    const role = roleKey ? getTranslatedRole(t, roleKey) : null
    const theme = roleKey ? getClassicRoleTheme(roleKey) : null
    const progress = `${session.currentRevealIndex + 1}/${session.players.length}`
    return <Shell action={progress} title={t('play.revealTitle')}>
      <div className="text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-full border border-blue-300/50 bg-blue-300/10 text-blue-200"><UserRound size={38} /></div><h1 className="mt-5 text-3xl font-black">{t('play.passTo', { name: player?.name })}</h1><p className="mt-2 text-slate-400">{t('play.onlyPlayer')}</p></div>
      <Card className={cn('mx-auto mt-8 flex min-h-64 max-w-lg items-center justify-center p-6 text-center transition', showSecret && 'border-blue-300 bg-blue-300/10 shadow-2xl shadow-blue-500/20')}>
        {showSecret && role && theme ? <div><p className={cn('text-sm font-black uppercase tracking-wider', theme.colorClassName)}>{t('play.youAre', { role: role.name })}</p><p className="mt-4 text-4xl font-black text-white">{role.name}</p><p className="mt-5 text-sm leading-6 text-slate-300">{role.shortDescription}</p><p className="mt-4 rounded-2xl bg-slate-950/50 p-4 text-sm leading-6 text-slate-300"><strong className="text-blue-200">{t('play.objective')}</strong> {role.objective}</p></div> : <div><EyeOff className="mx-auto text-slate-500" size={54} /><p className="mt-4 text-lg font-bold text-slate-400">{t('play.hiddenRole')}</p></div>}
      </Card>
      <div className="mx-auto mt-6 grid max-w-lg gap-3">{showSecret ? <Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={async () => { setShowSecret(false); await advanceReveal(); await AppHaptics.light() }}><EyeOff size={19} />{t('play.hideAndAdvance')}</Button> : <Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={async () => { setShowSecret(true); await AppHaptics.medium() }}><Eye size={19} />{t('play.showRole')}</Button>}</div>
    </Shell>
  }

  if (session.phase === 'nightIntro') return <Shell historySession={session} title={t('play.nightTitle', { round: session.round })}>
    <NightIntroPhase round={session.round} onStartNightActions={async () => { await advancePhase(); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'killerTurn') return <Shell historySession={session} title={t('play.nightTitle', { round: session.round })}>
    <KillerTurnPhase session={session} onConfirmTarget={async (actorId, targetId) => { await chooseKillerTarget(actorId, targetId); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'doctorTurn') return <Shell historySession={session} title={t('play.nightTitle', { round: session.round })}>
    <DoctorTurnPhase session={session} onConfirmProtection={async (protectedPlayerId) => { await chooseDoctorProtection(protectedPlayerId); await AppHaptics.medium() }} onSkipTurn={async () => { await advancePhase(); await AppHaptics.light() }} />
  </Shell>

  if (session.phase === 'detectiveTurn') return <Shell historySession={session} title={t('play.nightTitle', { round: session.round })}>
    <DetectiveTurnPhase session={session} onConfirmInvestigation={async (detectiveTargetId) => { await chooseDetectiveTarget(detectiveTargetId); await AppHaptics.medium() }} onSkipTurn={async () => { await advancePhase(); await AppHaptics.light() }} />
  </Shell>

  if (session.phase === 'nightResolution') return <Shell historySession={session} title={t('play.nightTitle', { round: session.round })}>
    <NightResolutionPhase session={session} onResolveNight={async () => { await resolveNight(); await AppHaptics.medium() }} onContinue={async () => { await advancePhase(); await AppHaptics.light() }} />
  </Shell>

  if (session.phase === 'dayDiscussion') return <Shell historySession={session} title={t('play.dayTitle', { round: session.round })}>
    <DayDiscussionPhase round={session.round} onStartVoting={async () => { await advancePhase(); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'voting') return <Shell historySession={session} title={t('play.dayTitle', { round: session.round })}>
    <VotingPhase session={session} onResolveVoting={async (outcome) => { await resolveVoting(outcome); await AppHaptics.medium() }} />
  </Shell>

  return <Shell title={t('name')}><p className="text-center text-slate-400">{t('play.fallback')}</p></Shell>
}

function Shell({ title, action, historySession, children }: { title: string; action?: string; historySession?: GameState; children: React.ReactNode }) {
  const { t } = useTranslation('cidade-dorme')
  const navigate = useNavigate()
  return <div className="min-h-dvh pb-10"><Header backTo="/games/cidade-dorme" title={title} action={action ? <span className="text-sm font-black text-blue-300">{action}</span> : undefined} /><section className="px-5 py-8">{children}{historySession ? <MediatorHistoryPanel session={historySession} /> : null}<Button className="mx-auto mt-8 flex max-w-lg" variant="ghost" onClick={() => navigate('/games/cidade-dorme')}><Home size={17} />{t('play.exitHome')}</Button></section></div>
}
