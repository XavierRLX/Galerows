import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { rankParticipants } from './nemFerrando.session'
import { useNemFerrandoStore } from './nemFerrando.store'
import { useNemFerrandoInitialization } from './useNemFerrandoInitialization'

export function NemFerrandoResultScreen() {
  const navigate = useNavigate(); const { session, initialized, discard } = useNemFerrandoStore(); useNemFerrandoInitialization()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/nem-ferrando', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">Carregando resultado...</div>
  const ranking = rankParticipants(session); const bestScore = session.scores[ranking[0]?.id] ?? 0; const winners = ranking.filter((item) => session.scores[item.id] === bestScore)
  return <div className="min-h-dvh pb-10"><Header title="Fim de jogo" /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-yellow-300" size={64} /><h1 className="mt-4 text-3xl font-black">{winners.length > 1 ? 'Temos um empate!' : `${winners[0]?.name} venceu!`}</h1><p className="mt-2 text-slate-400">Vence quem terminou com menos Ferros.</p>
    <Card className="mx-auto mt-7 max-w-lg overflow-hidden text-left">{ranking.map((participant, index) => <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-0" key={participant.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}º</span>{participant.name}</span><span className="font-black text-orange-300">{session.scores[participant.id]} Ferros</span></div>)}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3"><Button size="lg" onClick={async () => { await discard(); navigate('/games/nem-ferrando/setup') }}><RotateCcw size={18} />Nova partida</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />Voltar ao Hub</Button></div>
  </section></div>
}
