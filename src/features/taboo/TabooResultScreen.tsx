import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppReviewCheckpoint } from '../play-store/AppReviewCheckpoint'
import { createIndividualGaleraMatchResult, createTeamGaleraMatchResult } from '../ranking/ranking.model'
import { recordGaleraMatchResult } from '../ranking/ranking.service'
import { getTabooWinners, rankTabooEntities } from './taboo.session'
import { useTabooStore } from './taboo.store'
import { useTabooInitialization } from './useTabooInitialization'

export function TabooResultScreen() {
  const navigate = useNavigate()
  const { session, initialized, discard } = useTabooStore()
  useTabooInitialization()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/taboo', { replace: true }) }, [initialized, navigate, session])
  useEffect(() => {
    if (session?.phase !== 'finished') return
    const match = session.config.mode === 'teams'
      ? createTeamGaleraMatchResult({ matchId: session.id, gameId: 'taboo', gameName: 'Dica Proibida', finishedAt: session.updatedAt, participants: session.participants, teams: session.teams, scores: session.scores })
      : createIndividualGaleraMatchResult({ matchId: session.id, gameId: 'taboo', gameName: 'Dica Proibida', finishedAt: session.updatedAt, entities: session.participants, scores: session.scores })
    void recordGaleraMatchResult(match)
  }, [session])
  if (!session) return <div className="p-6 text-slate-400">Carregando resultado...</div>
  const ranking = rankTabooEntities(session)
  const winners = getTabooWinners(session)
  return <div className="min-h-dvh pb-10"><AppReviewCheckpoint matchId={session.id} /><Header title="Fim de jogo" /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-amber-300" size={64} /><h1 className="mt-4 text-3xl font-black">{winners.length > 1 ? 'Temos um empate!' : `${winners[0]?.name} venceu!`}</h1><p className="mt-2 text-slate-400">Vence quem fez mais pontos com as palavras proibidas.</p>
    <Card className="mx-auto mt-7 max-w-lg overflow-hidden text-left">{ranking.map((entity, index) => <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-0" key={entity.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}º</span>{entity.name}</span><span className="font-black text-amber-300">{session.scores[entity.id]} pontos</span></div>)}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3"><Button size="lg" onClick={async () => { await discard(); navigate('/games/taboo/setup') }}><RotateCcw size={18} />Nova partida</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />Voltar ao Hub</Button></div>
  </section></div>
}
