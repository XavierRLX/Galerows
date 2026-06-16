import { ArrowRight, Check, Drama, Eye, Square, Timer, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import { getCurrentEntityName, getCurrentRoundNumber, getRemainingSeconds } from './mimica.session'
import { useMimicaStore } from './mimica.store'
import { useMimicaInitialization } from './useMimicaInitialization'

export function MimicaPlayScreen() {
  const navigate = useNavigate()
  const { deck, session, initialized, beginTurn, chooseAction, readyToScore, success, miss, expireTurn, continueSummary } = useMimicaStore()
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
  const selectedAction = card?.actions.find((item) => item.id === session.selectedActionId)

  if (session.phase === 'turn-intro') {
    return <div className="min-h-dvh pb-10"><Header backTo="/games/mimica" title={`Rodada ${currentRound} de ${session.config.roundsPerEntity}`} /><section className="px-5 py-10 text-center">
      <Card className="mx-auto max-w-lg border-violet-400/30 bg-violet-500/10 p-6"><p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">{session.config.mode === 'individual' ? 'Ator da vez' : 'Equipe da vez'}</p><h1 className="mt-2 text-4xl font-black text-violet-200">{entityName}</h1><p className="mt-2 text-sm font-bold text-slate-300">Turno {session.currentTurnIndex + 1} de {session.turnQueue.length}</p><div className="mt-6 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-4 text-sm leading-6 text-fuchsia-100"><p className="font-black">Prepare a cena</p><p>Escolha uma ação da carta e faça a mímica sem falar.</p></div><p className="mt-5 text-sm text-slate-400">{session.config.useTimer ? `Tempo: ${session.config.turnDurationSeconds} segundos.` : 'Sem cronômetro nesta partida.'}</p><Button className="mt-6 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await beginTurn(); await AppHaptics.light() }}><Eye size={20} />Ver carta</Button></Card>
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

  if (!card) return <div className="p-6 text-slate-400">Não foi possível localizar a carta atual.</div>
  if (session.phase === 'choosing') {
    return <div className="min-h-dvh bg-violet-950 pb-10 text-white"><Header backTo="/games/mimica" title={`Rodada ${currentRound}`} action={<span className="text-sm font-black text-fuchsia-300">{entityName}</span>} /><section className="px-5 py-8"><Card className="mx-auto max-w-lg overflow-hidden border-fuchsia-300/50 bg-stone-50 text-slate-950"><div className="bg-violet-800 px-5 py-5 text-center text-white"><p className="text-xs font-mono uppercase tracking-wider text-violet-100">Carta {session.usedCardIds.length} de {deck.cards.length}</p><h1 className="mt-2 text-4xl font-black">{card.theme}</h1><span className="mt-2 inline-flex rounded-full bg-violet-600 px-3 py-1 text-xs font-bold">{difficultyLabel(card.difficulty)}</span></div><div className="p-5"><p className="text-center font-black uppercase tracking-wider text-violet-700">Escolha uma ação</p><div className="mt-4 grid gap-3">{card.actions.map((action) => <button className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition hover:bg-violet-100" key={action.id} onClick={async () => { await chooseAction(action.id); await AppHaptics.medium() }} type="button"><span className="text-lg font-black text-violet-900">{action.label}</span><span className="mt-2 block text-sm font-black text-fuchsia-700">{action.points} ponto{action.points === 1 ? '' : 's'}</span></button>)}</div></div></Card></section></div>
  }

  return <div className="min-h-dvh bg-violet-950 pb-10 text-white"><div className="flex items-center justify-between px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-300 px-4 py-2 font-black text-slate-950"><Drama size={18} />{entityName}</span>{session.config.useTimer ? <div className={cn('flex size-20 items-center justify-center rounded-full border-4 text-xl font-black shadow-xl', remaining <= 10 ? 'border-rose-300 text-rose-100' : 'border-white text-white')}><Timer className="absolute -mt-10" size={16} />0:{String(remaining).padStart(2, '0')}</div> : <span className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Sem tempo</span>}</div>
    <section className="flex min-h-[calc(100dvh-11rem)] flex-col justify-center px-5"><Card className="mx-auto w-full max-w-lg overflow-hidden border-fuchsia-300/60 bg-stone-50 text-slate-950"><div className="bg-violet-800 px-5 py-5 text-center text-white"><p className="text-xs font-mono uppercase tracking-wider text-violet-100">{card.theme} · {difficultyLabel(card.difficulty)}</p><h1 className="mt-2 text-3xl font-black">{selectedAction?.label}</h1><span className="mt-3 inline-flex rounded-full bg-fuchsia-300 px-3 py-1 text-sm font-black text-slate-950">{selectedAction?.points} ponto{selectedAction?.points === 1 ? '' : 's'}</span></div><div className="p-5 text-center"><p className="font-black uppercase tracking-wider text-violet-700">Faça a mímica</p><p className="mt-2 text-sm leading-6 text-slate-600">Sem falar, cantar, escrever no ar ou apontar objetos da resposta.</p></div></Card>
      <div className="mx-auto mt-8 grid w-full max-w-lg gap-3">{session.phase === 'acting' ? <Button className="bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300" size="lg" onClick={async () => { await readyToScore(); await AppHaptics.light() }}><Square size={18} />Registrar resultado</Button> : null}{session.phase === 'scoring' && session.config.mode === 'teams' ? <><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await success(null); await AppHaptics.light() }}><Check size={20} />Acertou! (+{selectedAction?.points})</Button><Button className="bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void miss()}><X size={20} />Ninguém acertou</Button></> : null}{session.phase === 'scoring' && session.config.mode === 'individual' ? <Card className="p-5"><h2 className="text-xl font-black">Quem acertou?</h2><p className="mt-1 text-sm text-slate-400">O ator ganha o dobro, e quem acertou também pontua.</p><div className="mt-4 grid gap-2">{session.participants.filter((participant) => participant.id !== session.turnQueue[session.currentTurnIndex]).map((participant) => <Button className="justify-between" key={participant.id} variant="secondary" onClick={() => void success(participant.id)}><span>{participant.name}</span><span>+{selectedAction?.points}</span></Button>)}<Button className="bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void miss()}><X size={20} />Ninguém acertou</Button></div></Card> : null}</div>
    </section></div>
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
