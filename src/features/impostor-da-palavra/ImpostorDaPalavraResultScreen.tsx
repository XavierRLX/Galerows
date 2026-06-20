import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppReviewCheckpoint } from '../play-store/AppReviewCheckpoint'
import { getWinners, rankParticipants } from './impostorDaPalavra.session'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'
import { useImpostorDaPalavraInitialization } from './useImpostorDaPalavraInitialization'

export function ImpostorDaPalavraResultScreen() {
  const { t } = useTranslation('impostor-da-palavra')
  const navigate = useNavigate()
  const { session, initialized, discard, restart } = useImpostorDaPalavraStore()
  useImpostorDaPalavraInitialization()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/impostor-da-palavra', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">Carregando resultado...</div>
  const ranking = rankParticipants(session)
  const winners = getWinners(session)
  return <div className="min-h-dvh pb-10"><AppReviewCheckpoint matchId={session.id} /><Header title={t('result.title')} /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-violet-300" size={64} /><h1 className="mt-4 text-3xl font-black">{winners.length > 1 ? t('result.tie') : t('result.winner', { name: winners[0]?.name })}</h1><p className="mt-2 text-slate-400">{t('result.description')}</p>
    <Card className="mx-auto mt-7 max-w-lg overflow-hidden text-left">{ranking.map((participant, index) => <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-0" key={participant.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}º</span>{participant.name}</span><span className="font-black text-violet-300">{t('result.points', { count: session.scores[participant.id] ?? 0 })}</span></div>)}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3"><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await restart(); navigate('/games/impostor-da-palavra/play') }}><RotateCcw size={18} />{t('result.newGame')}</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />{t('result.hub')}</Button></div>
  </section></div>
}
