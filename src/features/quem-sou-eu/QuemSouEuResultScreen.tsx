import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { getQuemSouEuSummary } from './quemSouEu.session'
import { useQuemSouEuStore } from './quemSouEu.store'
import { useQuemSouEuInitialization } from './useQuemSouEuInitialization'

export function QuemSouEuResultScreen() {
  const { t } = useTranslation('quem-sou-eu')
  const navigate = useNavigate()
  const { session, initialized, discard } = useQuemSouEuStore()
  useQuemSouEuInitialization()
  useEffect(() => { if (initialized && (!session || session.phase !== 'summary')) navigate('/games/quem-sou-eu', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">{t('loading')}</div>
  const summary = getQuemSouEuSummary(session)

  return <div className="min-h-dvh pb-10"><Header title={t('result.title')} /><section className="px-5 py-8 text-center"><Trophy className="mx-auto text-cyan-200" size={64} /><h1 className="mt-4 text-3xl font-black">{t('result.heading')}</h1><p className="mt-2 text-slate-400">{t('result.description')}</p>
    <Card className="mx-auto mt-7 max-w-lg p-5"><div className="grid grid-cols-3 gap-3"><Metric label={t('result.correct')} value={summary.correct} /><Metric label={t('result.skipped')} value={summary.skipped} /><Metric label={t('result.total')} value={summary.total} /></div></Card>
    <Card className="mx-auto mt-5 max-w-lg overflow-hidden text-left">{session.words.map((word, index) => <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 last:border-0" key={word.id}><span className="min-w-0 font-bold"><span className="mr-3 text-slate-500">{index + 1}</span>{word.text}</span><span className={word.status === 'correct' ? 'font-black text-emerald-300' : 'font-black text-amber-300'}>{word.status === 'correct' ? t('result.correctShort') : t('result.skippedShort')}</span></div>)}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3"><Button className="bg-sky-400 text-slate-950 hover:bg-sky-300" size="lg" onClick={async () => { await discard(); navigate('/games/quem-sou-eu/setup') }}><RotateCcw size={18} />{t('result.newGame')}</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />{t('result.backHome')}</Button></div>
  </section></div>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-3xl font-black text-cyan-200">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p></div>
}
