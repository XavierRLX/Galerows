import { Eye, EyeOff, Home, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { VoteResolutionPhase } from './components/VoteResolutionPhase'
import { VotingPhase } from './components/VotingPhase'
import { getRoleDefinition } from './cidadeDorme.roles'
import { getClassicRoleTheme } from './cidadeDorme.theme'
import { useCidadeDormeStore } from './cidadeDorme.store'
import type { GameState } from './cidadeDorme.types'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

export function CidadeDormePlayScreen() {
  const navigate = useNavigate()
  const { session, initialized, advanceReveal, advancePhase, chooseKillerTarget, chooseDoctorProtection, chooseDetectiveTarget, resolveNight, castVote, resolveVoting } = useCidadeDormeStore()
  const [showSecret, setShowSecret] = useState(false)
  useCidadeDormeInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/cidade-dorme', { replace: true })
  }, [initialized, navigate, session])
  useEffect(() => {
    if (initialized && session?.phase === 'gameOver') navigate('/games/cidade-dorme/result', { replace: true })
  }, [initialized, navigate, session?.phase])
  if (!session) return <div className="p-6 text-slate-400">Carregando partida...</div>

  if (session.phase === 'revealRoles') {
    const player = session.players[session.currentRevealIndex]
    const roleKey = player?.roleKey
    const role = roleKey ? getRoleDefinition(roleKey) : null
    const theme = roleKey ? getClassicRoleTheme(roleKey) : null
    const progress = `${session.currentRevealIndex + 1}/${session.players.length}`
    return <Shell action={progress} title="Revelar papéis">
      <div className="text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-full border border-blue-300/50 bg-blue-300/10 text-blue-200"><UserRound size={38} /></div><h1 className="mt-5 text-3xl font-black">Passe para {player?.name}</h1><p className="mt-2 text-slate-400">Só essa pessoa deve ver a próxima tela.</p></div>
      <Card className={cn('mx-auto mt-8 flex min-h-64 max-w-lg items-center justify-center p-6 text-center transition', showSecret && 'border-blue-300 bg-blue-300/10 shadow-2xl shadow-blue-500/20')}>
        {showSecret && role && theme ? <div><p className={cn('text-sm font-black uppercase tracking-wider', theme.colorClassName)}>{theme.revealTitle}</p><p className="mt-4 text-4xl font-black text-white">{role.name}</p><p className="mt-5 text-sm leading-6 text-slate-300">{role.shortDescription}</p><p className="mt-4 rounded-2xl bg-slate-950/50 p-4 text-sm leading-6 text-slate-300"><strong className="text-blue-200">Objetivo:</strong> {role.objective}</p></div> : <div><EyeOff className="mx-auto text-slate-500" size={54} /><p className="mt-4 text-lg font-bold text-slate-400">Função escondida</p></div>}
      </Card>
      <div className="mx-auto mt-6 grid max-w-lg gap-3">{showSecret ? <Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={async () => { setShowSecret(false); await advanceReveal(); await AppHaptics.light() }}><EyeOff size={19} />Esconder e avançar</Button> : <Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={async () => { setShowSecret(true); await AppHaptics.medium() }}><Eye size={19} />Mostrar função</Button>}</div>
    </Shell>
  }

  if (session.phase === 'nightIntro') return <Shell historySession={session} title={`Noite ${session.round}`}>
    <NightIntroPhase round={session.round} onStartNightActions={async () => { await advancePhase(); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'killerTurn') return <Shell historySession={session} title={`Noite ${session.round}`}>
    <KillerTurnPhase session={session} onConfirmTarget={async (targetId) => { await chooseKillerTarget(targetId); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'doctorTurn') return <Shell historySession={session} title={`Noite ${session.round}`}>
    <DoctorTurnPhase session={session} onConfirmProtection={async (protectedPlayerId) => { await chooseDoctorProtection(protectedPlayerId); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'detectiveTurn') return <Shell historySession={session} title={`Noite ${session.round}`}>
    <DetectiveTurnPhase session={session} onConfirmInvestigation={async (detectiveTargetId) => { await chooseDetectiveTarget(detectiveTargetId); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'nightResolution') return <Shell historySession={session} title={`Noite ${session.round}`}>
    <NightResolutionPhase session={session} onResolveNight={async () => { await resolveNight(); await AppHaptics.medium() }} onContinue={async () => { await advancePhase(); await AppHaptics.light() }} />
  </Shell>

  if (session.phase === 'dayDiscussion') return <Shell historySession={session} title={`Dia ${session.round}`}>
    <DayDiscussionPhase round={session.round} onStartVoting={async () => { await advancePhase(); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'voting') return <Shell historySession={session} title={`Dia ${session.round}`}>
    <VotingPhase session={session} onCastVote={async (voterId, targetId) => { await castVote(voterId, targetId); await AppHaptics.light() }} onFinishVoting={async () => { await advancePhase(); await AppHaptics.medium() }} />
  </Shell>

  if (session.phase === 'voteResolution') return <Shell historySession={session} title={`Dia ${session.round}`}>
    <VoteResolutionPhase session={session} onResolveVoting={async () => { await resolveVoting(); await AppHaptics.medium() }} onContinue={async () => { await advancePhase(); await AppHaptics.light() }} />
  </Shell>

  return <Shell title="Cidade Dorme"><p className="text-center text-slate-400">Esta fase será implementada na próxima etapa.</p></Shell>
}

function Shell({ title, action, historySession, children }: { title: string; action?: string; historySession?: GameState; children: React.ReactNode }) {
  const navigate = useNavigate()
  return <div className="min-h-dvh pb-10"><Header backTo="/games/cidade-dorme" title={title} action={action ? <span className="text-sm font-black text-blue-300">{action}</span> : undefined} /><section className="px-5 py-8">{children}{historySession ? <MediatorHistoryPanel session={historySession} /> : null}<Button className="mx-auto mt-8 flex max-w-lg" variant="ghost" onClick={() => navigate('/games/cidade-dorme')}><Home size={17} />Sair para o início</Button></section></div>
}
