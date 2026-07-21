import { Crown, Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { getPistaUnicaWinners } from './pistaUnica.session'
import { usePistaUnicaStore } from './pistaUnica.store'
import { usePistaUnicaInitialization } from './usePistaUnicaInitialization'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'

export function PistaUnicaResultScreen() {
  const { t } = useTranslation('pista-unica')
  const navigate = useNavigate()
  const { session, initialized, discard } = usePistaUnicaStore()
  usePistaUnicaInitialization()
  usePistaUnicaTheme()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/pista-unica', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">{t('loading')}</div>
  const winners = getPistaUnicaWinners(session)
  const ranking = [...session.participants].sort((first, second) => (session.scores[second.id] ?? 0) - (session.scores[first.id] ?? 0) || first.name.localeCompare(second.name))
  return <div className="min-h-dvh bg-[#03150d] pb-10 text-white"><Header title={t('ranking.title')} /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-emerald-300" size={64} /><h1 className="mt-4 text-3xl font-black">{t('ranking.heading')}</h1><p className="mt-2 text-slate-300">{winners.map((winner) => winner.name).join(', ')} {winners.length > 1 ? t('ranking.wonPlural') : t('ranking.won')}</p><Card className="mx-auto mt-8 max-w-lg overflow-hidden border-emerald-500/20 text-left">{ranking.map((participant, index) => <div className="flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-0" key={participant.id}><span className={index === 0 ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950' : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300'}>{index === 0 ? <Crown size={19} /> : index + 1}</span><span className="min-w-0 flex-1 font-black">{participant.name}</span><span className="text-lg font-black text-emerald-300">{t('ranking.points', { count: session.scores[participant.id] ?? 0 })}</span></div>)}</Card><div className="mx-auto mt-7 grid max-w-lg gap-3"><Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400" size="lg" onClick={async () => { await discard(); navigate('/games/pista-unica/setup') }}><RotateCcw size={18} />{t('ranking.newGame')}</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />{t('ranking.home')}</Button></div></section></div>
}
