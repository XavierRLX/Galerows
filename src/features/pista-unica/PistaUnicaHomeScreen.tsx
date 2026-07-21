import { BookOpen, Lightbulb, Play, RotateCcw, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FavoriteGameButton } from '../games/FavoriteGameButton'
import { usePistaUnicaStore } from './pistaUnica.store'
import { usePistaUnicaInitialization } from './usePistaUnicaInitialization'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'

export function PistaUnicaHomeScreen() {
  const { t } = useTranslation('pista-unica')
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)
  const { session, initialized, discard } = usePistaUnicaStore()
  usePistaUnicaInitialization()
  usePistaUnicaTheme()
  const destination = session?.phase === 'finished' ? '/games/pista-unica/result' : '/games/pista-unica/play'

  return <div className="min-h-dvh pb-32"><Header action={<FavoriteGameButton gameId="pista-unica" />} backTo="/" title={t('name')} /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] border border-emerald-300/35 bg-emerald-700 text-emerald-50 shadow-2xl shadow-emerald-950/55"><Lightbulb size={46} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">{t('eyebrow')}</p><h1 className="mt-2 text-4xl font-black tracking-tight">{t('name')}</h1><p className="mt-4 leading-7 text-slate-300">{t('summary')}</p></div>
    <Card className="mx-auto mt-8 max-w-lg border-emerald-500/25 bg-emerald-950/30 p-5"><h2 className="text-lg font-black">{t('objectiveTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('objective')}</p><div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-emerald-300"><span className="inline-flex items-center gap-2"><Users size={18} />3–12</span><span>{t('offline')}</span></div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">{t('flowTitle')}</h2><div className="mt-3 grid gap-3"><Step icon={<Lightbulb size={20} />} number="1" text={t('flow.secret')} /><Step icon={<Users size={20} />} number="2" text={t('flow.clues')} /><Step icon={<Trophy size={20} />} number="3" text={t('flow.score')} /></div></div>
    <Card className="mx-auto mt-5 max-w-lg border-emerald-300/15 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-50"><strong>{t('tipTitle')}</strong> {t('tip')}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />{t('discard')}</Button> : null}<Button size="lg" variant="secondary" onClick={() => setRulesOpen(true)}><BookOpen size={19} />{t('rulesTitle')}</Button></div>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-emerald-400/15 bg-[#03150d]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl"><Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={!initialized} size="lg" onClick={() => navigate(session ? destination : '/games/pista-unica/setup')}><Play size={19} />{t(session ? 'continue' : 'start')}</Button></div>
    <BottomSheet open={rulesOpen} title={t('rulesTitle')} onClose={() => setRulesOpen(false)}><div className="space-y-3 leading-7 text-slate-300">{([0, 1, 2, 3] as const).map((index) => <p key={index}>{t(`rules.${index}`)}</p>)}</div></BottomSheet>
  </div>
}

function Step({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 border-emerald-500/15 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-emerald-50">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
