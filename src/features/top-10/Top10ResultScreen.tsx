import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { getTop10Entities, getTop10Winners, rankTop10Entities } from './top10.session'
import { useTop10Store } from './top10.store'
import { useTop10Initialization } from './useTop10Initialization'

export function Top10ResultScreen() {
  const navigate = useNavigate()
  const { session, initialized, discard } = useTop10Store()
  useTop10Initialization()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/top-10', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">Carregando resultado...</div>
  const ranking = rankTop10Entities(session)
  const entities = getTop10Entities(session)
  const winners = getTop10Winners(session)
  return <div className="min-h-dvh pb-10"><Header title="Fim de jogo" /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-red-300" size={64} /><h1 className="mt-4 text-3xl font-black">{winners.length > 1 ? 'Temos um empate!' : `${winners[0]?.name} venceu!`}</h1><p className="mt-2 text-slate-400">Vence quem somou mais pontos nas listas.</p>
    <Card className="mx-auto mt-7 max-w-lg overflow-hidden text-left">{ranking.map((entity, index) => <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-0" key={entity.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}º</span>{entity.name}</span><span className="font-black text-red-300">{session.scores[entity.id]} pontos</span></div>)}</Card>
    <Card className="mx-auto mt-5 max-w-lg p-5 text-left"><h2 className="text-xl font-black">Histórico</h2><div className="mt-4 grid gap-3">{session.history.map((item, index) => { const mediator = entities.find((entity) => entity.id === item.mediatorEntityId); return <div className="rounded-2xl bg-white/5 p-4" key={`${item.cardId}-${index}`}><p className="text-xs font-black uppercase tracking-wider text-red-300">{item.theme}</p><h3 className="mt-1 font-black">{item.question}</h3><p className="mt-2 text-sm text-slate-400">Mediador: {mediator?.name ?? 'Não identificado'} · {item.reveals.filter((reveal) => reveal.entityId).length} acertos pontuados</p></div> })}</div></Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3"><Button className="bg-[#991b1b] text-white hover:bg-[#b91c1c]" size="lg" onClick={async () => { await discard(); navigate('/games/top-10/setup') }}><RotateCcw size={18} />Nova partida</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />Voltar ao Hub</Button></div>
  </section></div>
}
