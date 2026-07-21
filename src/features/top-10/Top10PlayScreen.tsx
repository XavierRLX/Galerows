import { ArrowRight, Crown, Eye, EyeOff, Flag, Home, Lock, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/utils/cn'
import { AppHaptics } from '../../lib/capacitor/haptics'
import type { Top10Rank } from './content/top10Content.types'
import { getCurrentTop10Card, getCurrentTop10Mediator, getEligibleTop10ScoringEntities, getTop10AnswerPoints, getTop10Entities } from './top10.session'
import { useTop10Store } from './top10.store'
import { useTop10Initialization } from './useTop10Initialization'
import { useTop10Theme } from './useTop10Theme'

const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as Top10Rank[]

export function Top10PlayScreen() {
  const navigate = useNavigate()
  const { deck, session, initialized, reveal, endCard, continueSummary } = useTop10Store()
  const [selectedRankState, setSelectedRankState] = useState<{ cardIndex: number; rank: Top10Rank | null }>({ cardIndex: -1, rank: null })
  const [answerKeyState, setAnswerKeyState] = useState<{ cardIndex: number; visible: boolean }>({ cardIndex: -1, visible: false })
  useTop10Initialization()
  useTop10Theme()
  useEffect(() => {
    if (initialized && !session) navigate('/games/top-10', { replace: true })
    if (session?.phase === 'finished') navigate('/games/top-10/result', { replace: true })
  }, [initialized, navigate, session])
  if (!deck || !session) return <div className="p-6 text-slate-400">Carregando partida...</div>
  const selectedRank = selectedRankState.cardIndex === session.currentCardIndex ? selectedRankState.rank : null
  const answerKeyVisible = answerKeyState.cardIndex === session.currentCardIndex && answerKeyState.visible
  const setSelectedRank = (rank: Top10Rank | null) => setSelectedRankState({ cardIndex: session.currentCardIndex, rank })
  const toggleAnswerKey = () => setAnswerKeyState((current) => ({
    cardIndex: session.currentCardIndex,
    visible: current.cardIndex === session.currentCardIndex ? !current.visible : true,
  }))
  const card = getCurrentTop10Card(session, deck)
  if (!card && session.phase !== 'finished') return <div className="p-6 text-slate-400">Não foi possível localizar a carta atual.</div>
  const entities = getTop10Entities(session)
  const eligibleEntities = getEligibleTop10ScoringEntities(session)
  const mediator = getCurrentTop10Mediator(session)
  const selectedAnswer = selectedRank ? card?.answers.find((answer) => answer.rank === selectedRank) : null
  const selectedAlreadyRevealed = selectedRank ? Boolean(session.revealedAnswers[String(selectedRank)]) : false

  if (session.phase === 'round-summary') {
    const last = session.history.at(-1)
    const finishing = session.currentCardIndex + 1 >= session.cardQueue.length
    const lastMediator = entities.find((entity) => entity.id === last?.mediatorEntityId)
    return <div className="min-h-dvh pb-10"><Header backTo="/games/top-10" title="Resumo da carta" />
      <section className="px-5 py-8 text-center"><Trophy className="mx-auto text-red-300" size={64} /><h1 className="mt-4 text-3xl font-black">{last?.theme}</h1><p className="mt-2 text-slate-400">{last?.question}</p><p className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-950/40 px-4 py-2 text-sm font-black text-red-200"><Crown size={16} />Mediador: {lastMediator?.name}</p>
        <Card className="mx-auto mt-6 max-w-lg overflow-hidden text-left">{entities.map((entity) => <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-0" key={entity.id}><span className="font-bold">{entity.name}</span><span className="font-black text-red-300">{session.scores[entity.id] ?? 0} pts</span></div>)}</Card>
        <Card className="mx-auto mt-5 max-w-lg p-5 text-left"><h2 className="text-lg font-black">Acertos desta carta</h2>{last?.reveals.length ? <div className="mt-3 grid gap-2">{last.reveals.filter((item) => item.entityId).map((item) => { const answer = card?.answers.find((entry) => entry.rank === item.rank); const entity = entities.find((entry) => entry.id === item.entityId); return <div className="rounded-2xl bg-white/5 p-3 text-sm" key={`${item.rank}-${item.entityId}`}><strong className="text-red-300">#{item.rank}</strong> {answer?.label} · {entity?.name} +{item.points}</div> })}</div> : <p className="mt-3 text-sm text-slate-400">Nenhum ponto registrado nesta carta.</p>}</Card>
        <Button className="mx-auto mt-6 w-full max-w-lg bg-[#991b1b] text-white hover:bg-[#b91c1c]" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/top-10/result'); else await AppHaptics.light() }}>{finishing ? 'Ver resultado' : 'Próxima carta'}<ArrowRight size={19} /></Button>
      </section></div>
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/top-10" title={`Rodada ${session.currentCardIndex + 1}/${session.cardQueue.length}`} action={<span className="text-sm font-black text-red-300">Top 10</span>} />
    <div className="border-b border-white/10 px-4 py-3"><div className="flex gap-2 overflow-x-auto pb-1">{entities.map((entity) => <span className={cn('shrink-0 rounded-xl border px-3 py-2 text-xs font-bold', entity.id === session.currentMediatorId ? 'border-red-400 bg-red-900/40 text-red-100' : 'border-red-900/50 bg-red-950/20 text-red-100')} key={entity.id}>{entity.id === session.currentMediatorId ? 'Mediador · ' : ''}{entity.name} · {session.scores[entity.id] ?? 0}</span>)}</div></div>
    <section className="px-5 py-6"><div className="mx-auto max-w-lg text-center"><p className="text-sm font-black uppercase tracking-[0.18em] text-red-300">{card?.theme}</p><h1 className="mt-2 text-3xl font-black leading-tight">{card?.question}</h1><p className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-950/40 px-4 py-2 text-sm font-black text-red-200"><Crown size={16} />Mediador: {mediator?.name}</p><p className="mt-3 text-sm leading-6 text-slate-400">A lista começa escondida. O mediador revela o gabarito para conferir os chutes e registrar pontos.</p></div>
      <Button className="mx-auto mt-5 flex w-full max-w-lg" variant={answerKeyVisible ? 'danger' : 'secondary'} onClick={toggleAnswerKey}>{answerKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}{answerKeyVisible ? 'Ocultar gabarito' : 'Ver gabarito'}</Button>
      <Card className="mx-auto mt-6 max-w-lg overflow-hidden border-red-900/50 bg-red-950/15">{ranks.map((rank) => {
        const answer = card?.answers.find((item) => item.rank === rank)
        const revealed = session.revealedAnswers[String(rank)]
        const entity = revealed?.entityId ? entities.find((item) => item.id === revealed.entityId) : null
        const canOpen = answerKeyVisible && !revealed
        return <button className={cn('flex min-h-16 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', revealed ? 'bg-red-900/20' : canOpen ? 'hover:bg-white/5' : 'cursor-default')} disabled={!canOpen} key={rank} onClick={() => setSelectedRank(rank)} type="button">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl font-black', revealed ? 'bg-red-700 text-white' : 'bg-slate-900 text-red-300')}><span className="sr-only">Rank </span>{rank}</span>
          <span className="min-w-0 flex-1"><span className="block font-black">{revealed || answerKeyVisible ? answer?.label : 'Resposta oculta'}</span>{revealed ? <span className="mt-1 block text-xs text-slate-400">{entity ? `${entity.name} ganhou ${revealed.points} pontos` : 'Revelada sem pontuar'}{answer?.note ? ` · ${answer.note}` : ''}</span> : <span className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">{answerKeyVisible ? <Eye size={13} /> : <Lock size={13} />}{getTop10AnswerPoints(rank)} pontos</span>}</span>
        </button>
      })}</Card>
      <div className="mx-auto mt-5 grid max-w-lg gap-3"><Button className="bg-[#991b1b] text-white hover:bg-[#b91c1c]" size="lg" onClick={async () => { await endCard(); await AppHaptics.medium() }}><Flag size={19} />Encerrar carta</Button><Button size="lg" variant="ghost" onClick={() => navigate('/games/top-10')}><Home size={18} />Sair e continuar depois</Button></div>
    </section>
    <Modal open={selectedRank !== null && !selectedAlreadyRevealed} title={selectedRank ? `Revelar #${selectedRank}` : 'Revelar'} onClose={() => setSelectedRank(null)}>
      <div className="text-sm leading-6 text-slate-300"><p>Escolha quem acertou para somar {selectedRank ? getTop10AnswerPoints(selectedRank) : 0} pontos, ou revele sem pontuar.</p><p className="mt-2 text-red-200">Mediador da rodada: {mediator?.name} não pontua.</p>{selectedAnswer?.note ? <p className="mt-2 text-red-200">Nota da fonte: {selectedAnswer.note}</p> : null}</div>
      <div className="mt-5 grid gap-2">{eligibleEntities.map((entity) => <Button className="justify-between bg-[#991b1b] text-white hover:bg-[#b91c1c]" key={entity.id} variant="primary" onClick={async () => { if (!selectedRank) return; await reveal(selectedRank, entity.id); setSelectedRank(null); await AppHaptics.light() }}><span>{entity.name}</span><span>+{selectedRank ? getTop10AnswerPoints(selectedRank) : 0}</span></Button>)}</div>
      <Button className="mt-3 w-full" variant="secondary" onClick={async () => { if (!selectedRank) return; await reveal(selectedRank, null); setSelectedRank(null); await AppHaptics.light() }}><Eye size={18} />Revelar sem ponto</Button>
      <Button className="mt-2 w-full" variant="ghost" onClick={() => setSelectedRank(null)}><EyeOff size={18} />Cancelar</Button>
    </Modal>
  </div>
}
