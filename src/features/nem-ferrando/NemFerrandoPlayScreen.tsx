import { ArrowRight, Eye, Flame, Hammer, RefreshCw, RotateCcw, Sparkles, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { formatNumber } from '../../lib/utils/formatNumber'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { canSwapCard, getDeckProgress } from './nemFerrando.session'
import { useNemFerrandoStore } from './nemFerrando.store'
import { useNemFerrandoInitialization } from './useNemFerrandoInitialization'

export function NemFerrandoPlayScreen() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const { deck, session, initialized, revealFirst, select, swap, challenge, reveal, award, continueSummary } = useNemFerrandoStore()
  useNemFerrandoInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/nem-ferrando', { replace: true })
    if (session?.phase === 'finished') navigate('/games/nem-ferrando/result', { replace: true })
  }, [initialized, navigate, session])
  if (!deck || !session) return <div className="p-6 text-slate-400">Carregando partida...</div>

  const player = session.participants[session.currentPlayerIndex]
  if (session.phase === 'starting') {
    const playerOrder = session.participants.map((_, offset) => session.participants[(session.currentPlayerIndex + offset) % session.participants.length])
    return <div className="min-h-dvh pb-10"><Header backTo="/games/nem-ferrando" title="A partida vai começar" /><section className="px-5 py-10 text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-orange-400 text-slate-950 shadow-xl shadow-orange-400/20"><Sparkles size={38} /></div><p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-orange-300">Jogador sorteado</p><h1 className="mt-2 text-4xl font-black">{player.name} começa</h1><p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">Depois, a partida segue a ordem da roda normalmente.</p><Card className="mx-auto mt-7 max-w-lg p-5 text-left"><div className="flex items-center gap-2 font-black"><Users size={19} />Ordem da roda</div><div className="mt-4 flex flex-wrap gap-2">{playerOrder.map((item, index) => <span className={cn('rounded-xl border px-3 py-2 text-sm font-bold', index === 0 ? 'border-orange-400 bg-orange-400/10 text-orange-300' : 'border-white/10')} key={item.id}>{index + 1}. {item.name}</span>)}</div></Card><Button className="mx-auto mt-7 w-full max-w-lg" size="lg" onClick={async () => { await revealFirst(); await AppHaptics.light() }}><Eye size={20} />Revelar primeira carta</Button></section></div>
  }
  const card = deck.cards.find((item) => item.id === session.currentCardId)
  const curiosity = card?.curiosities.find((item) => item.id === session.selectedCuriosityId)
  const progress = getDeckProgress(session, deck)
  if (!card) return <div className="p-6">Não foi possível localizar a carta atual.</div>

  if (session.phase === 'round-summary' && session.lastRoundResult) {
    const penalized = session.participants.find((item) => item.id === session.lastRoundResult?.participantId)
    const nextPlayer = session.participants[(session.currentPlayerIndex + 1) % session.participants.length]
    const finishing = session.pendingFinishedReason !== null
    return <div className="min-h-dvh pb-10"><Header backTo="/games/nem-ferrando" title={`Rodada ${session.round}`} />
      <section className="px-5 py-8 text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-orange-400 text-slate-950"><Hammer size={30} /></div><h1 className="mt-5 text-3xl font-black">Resumo da rodada</h1>
        <Card className="mx-auto mt-6 max-w-lg p-5 text-left"><p className="text-sm text-slate-400">Quem recebeu os Ferros</p><div className="mt-2 flex items-end justify-between gap-3"><p className="text-2xl font-black text-orange-300">{penalized?.name}</p><p className="text-xl font-black">+{session.lastRoundResult.irons}</p></div><p className="mt-3 text-sm text-slate-300">Pontuação: {session.lastRoundResult.previousScore} → <strong>{session.lastRoundResult.newScore}</strong></p></Card>
        <Card className="mx-auto mt-4 max-w-lg overflow-hidden text-left">{session.participants.map((item) => <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-0" key={item.id}><span className="font-bold">{item.name}</span><span className="font-black text-orange-300">{session.scores[item.id]} / {session.ironLimit}</span></div>)}</Card>
        <p className="mt-5 text-sm text-slate-400">{finishing ? session.pendingFinishedReason === 'iron-limit' ? `${penalized?.name} atingiu o limite de Ferros.` : 'Todas as curiosidades foram utilizadas.' : `Próximo jogador: ${nextPlayer.name}`}</p>
        <Button className="mx-auto mt-5 w-full max-w-lg" size="lg" onClick={async () => { const finished = await continueSummary(); if (finished) navigate('/games/nem-ferrando/result'); else await AppHaptics.light() }}>{finishing ? 'Ver resultado' : 'Continuar'}<ArrowRight size={19} /></Button>
      </section></div>
  }

  const swapAvailable = canSwapCard(session)
  return <div className="min-h-dvh pb-10"><Header backTo="/games/nem-ferrando" title={`Rodada ${session.round}`} action={<span className="text-sm font-black text-orange-300">Limite {session.ironLimit}</span>} />
    <div className="border-b border-white/10 px-4 py-3"><div className="flex gap-2 overflow-x-auto pb-1">{session.participants.map((item) => <span className={cn('shrink-0 rounded-xl border px-3 py-2 text-xs font-bold', item.id === player.id ? 'border-orange-400 bg-orange-400/10 text-orange-300' : 'border-white/10')} key={item.id}>{item.name} · {session.scores[item.id] ?? 0}/{session.ironLimit}</span>)}</div></div>
    <section className="px-5 py-6"><div className="text-center">{session.passNumber > 1 && session.passPosition === 1 ? <span className="mb-3 inline-flex rounded-full bg-violet-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-300">Nova passagem</span> : null}<p className="text-xl font-black text-orange-300">{player.name}</p><p className="text-sm text-slate-400">Escolha uma curiosidade e dê seu palpite</p><p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Passagem {session.passNumber} · carta {session.passPosition} de {session.passSize}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{progress.remaining} de {progress.total} curiosidades restantes</p></div>
      {curiosity ? <div className="mx-auto mt-5 max-w-lg text-center"><p className="text-sm text-slate-400">Curiosidade selecionada</p><p className="mt-1 text-xl font-bold text-orange-300">{curiosity.question}</p></div> : null}
      {session.phase === 'challenged' ? <Button className="mx-auto mt-5 flex w-full max-w-lg bg-red-600 text-white hover:bg-red-500" size="lg" onClick={() => void reveal()}><Flame size={20} />Revelar resposta</Button> : null}
      <Card className={cn('nf-card-enter mx-auto mt-5 max-w-lg p-5 transition', session.phase === 'revealed' && 'border-orange-400 bg-orange-500/15')} key={`${session.passNumber}-${session.currentCardId}-${session.swappedThisTurn}`}>
        <p className="text-xs font-black uppercase tracking-wider text-orange-200">Carta #{String(card.number).padStart(2, '0')}</p><div className="mt-1 flex items-center justify-between gap-3"><h1 className="text-2xl font-black text-orange-300">{card.theme}</h1><span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-black"><Hammer className="mr-1 inline" size={14} />{card.irons}</span></div>
        {session.phase === 'revealed' && curiosity ? <div className="nf-answer-reveal mt-5 rounded-2xl bg-orange-500 p-5 text-center"><p className="text-sm font-bold text-orange-950">Resposta</p><p className="mt-1 text-3xl font-black text-white">{formatNumber(curiosity.answer, i18n.resolvedLanguage as 'pt-BR' | 'en-US' | 'es-419')} {curiosity.unit}</p></div> : <div className="mt-4 grid gap-2">{card.curiosities.filter((item) => !session.usedCuriosityIds.includes(item.id)).map((item, index) => <button className={cn('min-h-14 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm transition', session.selectedCuriosityId === item.id && 'border-orange-400 bg-orange-400/15 text-orange-200')} disabled={session.phase !== 'choosing'} key={item.id} onClick={() => void select(item.id)} type="button"><span className="mr-2 font-black text-orange-400">{index + 1}</span>{item.question}</button>)}</div>}
      </Card>
      {session.phase === 'choosing' && !session.selectedCuriosityId ? <Button className="mx-auto mt-3 flex w-full max-w-lg" disabled={!swapAvailable} variant="secondary" onClick={async () => { await swap(); await AppHaptics.light() }}><RefreshCw size={18} />{session.swappedThisTurn ? 'Carta já trocada neste turno' : swapAvailable ? 'Trocar carta' : 'Nenhuma outra carta disponível'}</Button> : null}
      {session.phase === 'choosing' ? <Button className="mx-auto mt-3 flex w-full max-w-lg bg-red-600 text-white hover:bg-red-500" disabled={!session.selectedCuriosityId} size="lg" onClick={async () => { await challenge(); await AppHaptics.medium() }}><Flame size={20} />NEM FERRANDO!</Button> : null}
      {session.phase === 'revealed' ? <Card className="mx-auto mt-5 max-w-lg p-5"><h2 className="text-xl font-black">Quem levou {card.irons} Ferros?</h2><p className="mt-1 text-sm text-slate-400">O grupo decide e registra a penalidade.</p><div className="mt-4 grid gap-2">{session.participants.map((item) => <Button className="justify-between" key={item.id} variant="secondary" onClick={() => void award(item.id)}><span>{item.name}</span><span>{session.scores[item.id] ?? 0} → {(session.scores[item.id] ?? 0) + card.irons}</span></Button>)}</div></Card> : null}
      <Button className="mx-auto mt-5 flex max-w-lg" variant="ghost" onClick={() => navigate('/games/nem-ferrando')}><RotateCcw size={17} />Sair e continuar depois</Button>
    </section></div>
}
