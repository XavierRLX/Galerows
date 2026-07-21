import { ArrowLeft, ArrowRight, Check, Drama, Eye, Play, Square, Timer, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import type { MimicaCard } from './content/mimicaContent.types'
import { getCurrentEntityName, getCurrentMimicaAction, getCurrentRoundNumber, getRemainingSeconds } from './mimica.session'
import { useMimicaStore } from './mimica.store'
import { useMimicaInitialization } from './useMimicaInitialization'

export function MimicaPlayScreen() {
  const navigate = useNavigate()
  const { deck, session, initialized, beginTurn, chooseAction, returnToChoices, startActing, readyToScore, success, miss, expireTurn, continueSummary } = useMimicaStore()
  const [remaining, setRemaining] = useState(0)
  useMimicaInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/mimica', { replace: true })
    if (session?.phase === 'finished') navigate('/games/mimica/result', { replace: true })
  }, [initialized, navigate, session])
  useEffect(() => {
    if (!session || session.phase !== 'acting' || !session.config.useTimer) return
    const tick = () => {
      const next = getRemainingSeconds(session)
      setRemaining(next)
      if (next <= 0) void expireTurn()
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [expireTurn, session])
  if (!deck || !session) return <div className="p-6 text-slate-400">Carregando partida...</div>
  const entityName = getCurrentEntityName(session)
  const currentRound = getCurrentRoundNumber(session)
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  const currentAction = getCurrentMimicaAction(session, deck)
  const usesPreparedChallenge = session.challengeSource === 'opponent-prepared'

  if (session.phase === 'turn-intro') {
    return <div className="min-h-dvh pb-10"><Header backTo="/games/mimica" title={`Rodada ${currentRound} de ${session.config.roundsPerEntity}`} /><section className="px-5 py-10 text-center">
      <Card className="mx-auto max-w-lg border-violet-400/30 bg-violet-500/10 p-6"><p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">{session.config.mode === 'individual' ? 'Ator da vez' : 'Equipe da vez'}</p><h1 className="mt-2 text-4xl font-black text-violet-200">{entityName}</h1><p className="mt-2 text-sm font-bold text-slate-300">Turno {session.currentTurnIndex + 1} de {session.turnQueue.length}</p><div className="mt-6 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-4 text-sm leading-6 text-fuchsia-100"><p className="font-black">Prepare a cena</p><p>{usesPreparedChallenge ? 'Revele a mímica criada pela adversária e faça sem falar.' : 'Escolha uma ação da carta e faça a mímica sem falar.'}</p></div><p className="mt-5 text-sm text-slate-400">{session.config.useTimer ? `Tempo: ${session.config.turnDurationSeconds} segundos.` : 'Sem cronômetro nesta partida.'}</p><Button className="mt-6 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await beginTurn(); await AppHaptics.light() }}><Eye size={20} />{usesPreparedChallenge ? 'Ver desafio' : 'Ver carta'}</Button></Card>
      <Scoreboard session={session} />
    </section></div>
  }

  if (session.phase === 'turn-summary' && session.lastTurnResult) {
    const endOfRound = (session.currentTurnIndex + 1) % (session.config.mode === 'individual' ? session.participants.length : session.teams.length) === 0
    const result = session.lastTurnResult
    const guesser = result.guesserId ? session.participants.find((participant) => participant.id === result.guesserId) : null
    return <div className="min-h-dvh pb-10"><Header backTo="/games/mimica" title="Resumo do turno" /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-fuchsia-300" size={56} /><h1 className="mt-4 text-3xl font-black">{entityName}</h1><Card className="mx-auto mt-6 max-w-lg p-5 text-left"><p className="text-sm text-slate-400">Ação</p><h2 className="mt-1 text-2xl font-black text-violet-200">{result.action?.label ?? 'Mímica'}</h2><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Metric label="Status" value={result.success ? 'Acertou' : 'Errou'} /><Metric label="Ator" value={`+${result.actorPoints}`} /><Metric label="Acerto" value={guesser ? `+${result.guesserPoints}` : '+0'} /></div>{guesser ? <p className="mt-4 text-sm text-slate-300">Quem acertou: <strong>{guesser.name}</strong></p> : null}</Card><Scoreboard session={session} /><Button className="mx-auto mt-6 w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/mimica/result'); else await AppHaptics.light() }}>{endOfRound ? 'Ver resumo da rodada' : 'Próximo turno'}<ArrowRight size={19} /></Button></section></div>
  }

  if (session.phase === 'round-summary') {
    const finishing = session.pendingFinishedReason !== null
    return <div className="min-h-dvh pb-10"><Header backTo="/games/mimica" title={`Resumo da rodada ${currentRound}`} /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-fuchsia-300" size={56} /><h1 className="mt-4 text-3xl font-black">Rodada {currentRound} concluída</h1><p className="mt-2 text-slate-400">{finishing && session.pendingFinishedReason === 'deck-exhausted' ? 'As cartas acabaram antes do fim planejado.' : 'Todos já fizeram mímica nesta rodada.'}</p><Scoreboard session={session} /><Button className="mx-auto mt-6 w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/mimica/result'); else await AppHaptics.light() }}>{finishing ? 'Ver resultado' : 'Próxima rodada'}<ArrowRight size={19} /></Button></section></div>
  }

  if (session.challengeSource === 'deck' && !card) return <div className="p-6 text-slate-400">Não foi possível localizar a carta atual.</div>
  if (session.phase === 'choosing') {
    if (!card) return <div className="p-6 text-slate-400">Não foi possível localizar a carta atual.</div>
    return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(109,40,217,0.22),transparent_34%)] pb-10 text-white"><Header backTo="/games/mimica" title={`Rodada ${currentRound}`} action={<span className="text-sm font-black text-fuchsia-300">{entityName}</span>} /><section className="px-5 py-6"><MimicaScenePicker card={card} cardNumber={session.usedCardIds.length} totalCards={deck.cards.length} onChoose={async (actionId) => { await chooseAction(actionId); await AppHaptics.medium() }} /></section></div>
  }

  const isPreview = session.phase === 'previewing'
  return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(109,40,217,0.22),transparent_34%)] pb-10 text-white"><div className="flex items-center justify-between px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-300 px-4 py-2 font-black text-slate-950"><Drama size={18} />{entityName}</span>{session.config.useTimer && !isPreview ? <div aria-live="polite" className={cn('flex size-20 items-center justify-center rounded-full border-4 text-xl font-black shadow-xl', remaining <= 10 ? 'border-rose-300 text-rose-100' : 'border-white text-white')}><Timer className="absolute -mt-10" size={16} />0:{String(remaining).padStart(2, '0')}</div> : <span className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-black">{isPreview ? 'Prepare-se' : 'Sem tempo'}</span>}</div>
    <section className="flex min-h-[calc(100dvh-11rem)] flex-col justify-center px-5"><MimicaChallengeCard action={currentAction} card={card} phase={isPreview ? 'previewing' : session.phase === 'scoring' ? 'scoring' : 'acting'} />
      <div className="mx-auto mt-7 grid w-full max-w-[23rem] gap-3">{isPreview ? <><Button className="bg-fuchsia-300 text-slate-950 shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-200" size="lg" onClick={async () => { await startActing(); await AppHaptics.medium() }}><Play size={19} />{session.config.useTimer ? 'Começar cronômetro' : 'Começar mímica'}</Button>{session.challengeSource === 'deck' ? <Button className="border-violet-300/25 bg-white/5 text-violet-100 hover:bg-white/10" size="lg" variant="secondary" onClick={async () => { await returnToChoices(); await AppHaptics.light() }}><ArrowLeft size={19} />Trocar cena</Button> : null}</> : null}{session.phase === 'acting' ? <Button className="bg-fuchsia-300 text-slate-950 shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-200" size="lg" onClick={async () => { await readyToScore(); await AppHaptics.light() }}><Square size={18} />Encerrar e registrar resultado</Button> : null}{session.phase === 'scoring' && session.config.mode === 'teams' ? <><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await success(null); await AppHaptics.light() }}><Check size={20} />Acertou! (+{currentAction?.points})</Button><Button className="bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void miss()}><X size={20} />Ninguém acertou</Button></> : null}{session.phase === 'scoring' && session.config.mode === 'individual' ? <Card className="border-violet-400/25 bg-slate-950/70 p-5"><h2 className="text-xl font-black">Quem acertou?</h2><p className="mt-1 text-sm text-slate-400">O ator ganha o dobro, e quem acertou também pontua.</p><div className="mt-4 grid gap-2">{session.participants.filter((participant) => participant.id !== session.turnQueue[session.currentTurnIndex]).map((participant) => <Button className="justify-between" key={participant.id} variant="secondary" onClick={() => void success(participant.id)}><span>{participant.name}</span><span>+{currentAction?.points}</span></Button>)}<Button className="bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void miss()}><X size={20} />Ninguém acertou</Button></div></Card> : null}</div>
    </section></div>
}

type MimicaScenePickerProps = {
  card: MimicaCard
  cardNumber: number
  totalCards: number
  onChoose: (actionId: string) => void
}

function MimicaScenePicker({ card, cardNumber, totalCards, onChoose }: MimicaScenePickerProps) {
  return <div className="mx-auto w-full max-w-lg"><div className="relative overflow-hidden rounded-[2rem] border border-violet-300/25 bg-[linear-gradient(135deg,rgba(109,40,217,0.28),rgba(20,10,43,0.96)_65%)] p-5 shadow-[0_20px_55px_-30px_rgba(139,92,246,0.9)]"><div className="absolute -right-10 -top-10 size-36 rounded-full border border-violet-300/15" /><div className="relative"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Tema da rodada</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white">{card.theme}</h1></div><span className="rounded-xl border border-violet-200/20 bg-white/5 px-3 py-2 text-right text-xs font-black text-violet-100"><span className="block text-[0.6rem] uppercase tracking-wider text-violet-300">Carta</span>{String(cardNumber).padStart(2, '0')}<span className="text-violet-300">/{totalCards}</span></span></div><div className="mt-5 flex items-center gap-2"><span className="rounded-full bg-fuchsia-300 px-3 py-1 text-xs font-black text-slate-950">{difficultyLabel(card.difficulty)}</span><span className="text-sm text-violet-100">Escolha uma cena para interpretar.</span></div></div></div><div className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-white">Qual cena você vai fazer?</h2><Drama className="text-fuchsia-300" size={22} /></div><div className="grid gap-3">{card.actions.map((action, index) => <button className="group flex min-h-20 items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-left shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-fuchsia-200/45 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-200" key={action.id} type="button" onClick={() => onChoose(action.id)}><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-sm font-black text-white shadow-lg shadow-violet-950/30">{index + 1}</span><span className="min-w-0 flex-1 text-lg font-black leading-snug text-white">{action.label}</span><span className="rounded-full bg-fuchsia-300/15 px-2.5 py-1.5 text-xs font-black text-fuchsia-100">+{action.points}</span></button>)}</div></div><p className="mt-5 text-center text-xs leading-5 text-slate-400">Escolha sem mostrar a tela para quem vai adivinhar.</p></div>
}

type MimicaChallengeCardProps = {
  card: MimicaCard | undefined
  action?: { id: string; label: string; points: number } | null
  phase: 'previewing' | 'acting' | 'scoring'
}

function MimicaChallengeCard({ card, action, phase }: MimicaChallengeCardProps) {
  const eyebrow = phase === 'previewing' ? 'Cena selecionada' : phase === 'scoring' ? 'Fim da cena' : 'Mímica em andamento'
  const instruction = phase === 'previewing' ? 'Leia a cena, prepare-se e só então comece.' : phase === 'scoring' ? 'Decidam o resultado desta rodada.' : 'Sem falar, cantar, escrever no ar ou apontar objetos da resposta.'
  return <Card className="relative mx-auto w-full max-w-[23rem] overflow-hidden rounded-[2rem] border border-violet-300/25 bg-[linear-gradient(145deg,rgba(109,40,217,0.32),rgba(17,9,35,0.98)_55%)] p-6 shadow-[0_24px_60px_-32px_rgba(139,92,246,0.95)]"><div className="absolute inset-y-0 left-0 w-1 bg-fuchsia-300" /><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">{eyebrow}</p><p className="mt-2 text-sm font-bold text-violet-200">{card ? `${card.theme} · ${difficultyLabel(card.difficulty)}` : 'Desafio criado pela adversária'}</p></div><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-300 text-slate-950"><Drama size={25} /></div></div><h1 className="mt-9 text-4xl font-black leading-tight tracking-tight text-white">{action?.label}</h1><span className="mt-5 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-fuchsia-100">Vale {action?.points} ponto{action?.points === 1 ? '' : 's'}</span><div className="mt-8 rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-sm leading-6 text-slate-200">{instruction}</p></div></Card>
}

function Scoreboard({ session }: { session: NonNullable<ReturnType<typeof useMimicaStore.getState>['session']> }) {
  const entities = session.config.mode === 'individual' ? session.participants : session.teams
  return <Card className="mx-auto mt-6 max-w-lg overflow-hidden text-left">{entities.map((entity) => <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-0" key={entity.id}><span className="font-bold">{entity.name}</span><span className="rounded-full bg-fuchsia-300 px-3 py-1 font-black text-slate-950">{session.scores[entity.id] ?? 0}</span></div>)}</Card>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-2xl font-black text-fuchsia-300">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p></div>
}

function difficultyLabel(difficulty: string) {
  if (difficulty === 'easy') return 'Fácil'
  if (difficulty === 'medium') return 'Médio'
  return 'Difícil'
}
