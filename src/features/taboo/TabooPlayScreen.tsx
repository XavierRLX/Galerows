import { ArrowRight, Check, FastForward, Square, Timer, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import { canSkip, getCurrentEntityName, getCurrentRoundNumber, getRemainingSeconds, getSkipsRemaining } from './taboo.session'
import { useTabooStore } from './taboo.store'
import { useTabooInitialization } from './useTabooInitialization'

export function TabooPlayScreen() {
  const navigate = useNavigate()
  const { deck, session, initialized, beginTurn, correct, skip, endTurn, expireTurn, continueSummary } = useTabooStore()
  const [remaining, setRemaining] = useState(0)
  useTabooInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/taboo', { replace: true })
    if (session?.phase === 'finished') navigate('/games/taboo/result', { replace: true })
  }, [initialized, navigate, session])
  useEffect(() => {
    if (!session || session.phase !== 'playing') return
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
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  const currentRound = getCurrentRoundNumber(session)

  if (session.phase === 'turn-intro') {
    return <div className="min-h-dvh pb-10"><Header backTo="/games/taboo" title={`Rodada ${currentRound} de ${session.config.roundsPerEntity}`} /><section className="px-5 py-10 text-center">
      <Card className="mx-auto max-w-lg border-emerald-400/30 bg-emerald-500/10 p-6"><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Adivinhador da vez</p><h1 className="mt-2 text-4xl font-black text-emerald-200">{entityName}</h1><p className="mt-2 text-sm font-bold text-slate-300">Turno {session.currentTurnIndex + 1} de {session.turnQueue.length}</p><div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"><p className="font-black">Atenção!</p><p>Passe o celular para quem vai dar as dicas. {entityName} NÃO deve olhar a tela.</p></div><p className="mt-5 text-sm text-slate-400">Vocês terão <strong>{session.config.turnDurationSeconds} segundos</strong> para acertar o máximo de cards.</p><Button className="mt-6 w-full" size="lg" onClick={async () => { await beginTurn(); await AppHaptics.light() }}>Começar turno</Button></Card>
      <Scoreboard session={session} />
    </section></div>
  }

  if (session.phase === 'turn-summary' && session.lastTurnResult) {
    const endOfRound = (session.currentTurnIndex + 1) % (session.config.mode === 'individual' ? session.participants.length : session.teams.length) === 0
    return <div className="min-h-dvh pb-10"><Header backTo="/games/taboo" title="Resumo do turno" /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-amber-300" size={56} /><h1 className="mt-4 text-3xl font-black">{entityName}</h1><Card className="mx-auto mt-6 max-w-lg p-5"><div className="grid grid-cols-3 gap-3 text-center"><Metric label="Acertos" value={session.lastTurnResult.correct} /><Metric label="Pulos" value={session.lastTurnResult.skips} /><Metric label="Pontos" value={session.lastTurnResult.points} /></div></Card><Scoreboard session={session} /><Button className="mx-auto mt-6 w-full max-w-lg" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/taboo/result'); else await AppHaptics.light() }}>{endOfRound ? 'Ver resumo da rodada' : 'Próximo turno'}<ArrowRight size={19} /></Button></section></div>
  }

  if (session.phase === 'round-summary') {
    const finishing = session.pendingFinishedReason !== null
    return <div className="min-h-dvh pb-10"><Header backTo="/games/taboo" title={`Resumo da rodada ${currentRound}`} /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-amber-300" size={56} /><h1 className="mt-4 text-3xl font-black">Rodada {currentRound} concluída</h1><p className="mt-2 text-slate-400">Todos já foram adivinhadores nesta rodada.</p><Scoreboard session={session} /><Button className="mx-auto mt-6 w-full max-w-lg" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/taboo/result'); else await AppHaptics.light() }}>{finishing ? 'Ver resultado' : 'Próxima rodada'}<ArrowRight size={19} /></Button></section></div>
  }

  if (!card) return <div className="p-6 text-slate-400">Não foi possível localizar o card atual.</div>
  const skipRemaining = getSkipsRemaining(session)
  return <div className="min-h-dvh bg-emerald-950 pb-10 text-white"><div className="flex items-center justify-between px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 font-black text-slate-950"><Trophy size={18} />{session.currentTurnCorrect}</span><div className={cn('flex size-20 items-center justify-center rounded-full border-4 text-xl font-black shadow-xl', remaining <= 10 ? 'border-rose-300 text-rose-100' : 'border-white text-white')}><Timer className="absolute -mt-10" size={16} />0:{String(remaining).padStart(2, '0')}</div></div>
    <section className="flex min-h-[calc(100dvh-11rem)] flex-col justify-center px-5"><Card className="mx-auto w-full max-w-lg overflow-hidden border-amber-300/60 bg-stone-50 text-slate-950"><div className="bg-emerald-800 px-5 py-5 text-center text-white"><p className="text-xs font-mono uppercase tracking-wider text-emerald-100">Carta {session.usedCardIds.length} de {deck.cards.length}</p><h1 className="mt-2 text-4xl font-black">{card.word}</h1>{card.difficulty ? <span className="mt-2 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold">{card.difficulty}</span> : null}</div><div className="p-5 text-center"><p className="font-black uppercase tracking-wider text-red-600">Palavras proibidas</p><div className="mt-4 flex flex-wrap justify-center gap-2">{card.forbiddenWords.map((word) => <span className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" key={word}>{word}</span>)}</div></div></Card>
      <div className="mx-auto mt-8 grid w-full max-w-lg gap-3"><Button className="bg-emerald-500 text-white hover:bg-emerald-400" size="lg" onClick={async () => { await correct(); await AppHaptics.light() }}><Check size={20} />Acertou! (+1 ponto)</Button><div className="grid grid-cols-2 gap-3"><Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" disabled={!canSkip(session)} size="lg" onClick={async () => { await skip(); await AppHaptics.light() }}><FastForward size={19} />Pular {skipRemaining === Infinity ? '' : `(${skipRemaining})`}</Button><Button className="bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void endTurn()}><Square size={18} />Encerrar</Button></div></div>
    </section></div>
}

function Scoreboard({ session }: { session: NonNullable<ReturnType<typeof useTabooStore.getState>['session']> }) {
  const entities = session.config.mode === 'individual' ? session.participants : session.teams
  return <Card className="mx-auto mt-6 max-w-lg overflow-hidden text-left">{entities.map((entity) => <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-0" key={entity.id}><span className="font-bold">{entity.name}</span><span className="rounded-full bg-amber-300 px-3 py-1 font-black text-slate-950">{session.scores[entity.id] ?? 0}</span></div>)}</Card>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-2xl font-black text-amber-300">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p></div>
}
