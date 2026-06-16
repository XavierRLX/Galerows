import { BookOpen, Drama, Play, RotateCcw, Timer, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useMimicaStore } from './mimica.store'
import { useMimicaInitialization } from './useMimicaInitialization'

export function MimicaHomeScreen() {
  const { t } = useTranslation('mimica')
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)
  const { deck, session, initialized, resumeError, discard } = useMimicaStore()
  useMimicaInitialization()
  return <div className="min-h-dvh pb-32"><Header backTo="/" title={t('name')} /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-violet-500 text-white shadow-2xl shadow-violet-500/20"><Drama size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-fuchsia-300">{t('eyebrow')}</p><h1 className="mt-2 text-4xl font-black tracking-tight">{t('name')}</h1><p className="mt-4 leading-7 text-slate-300">{t('summary')}</p></div>
    <Card className="mx-auto mt-8 max-w-lg border-violet-400/30 bg-violet-500/10 p-5"><h2 className="text-lg font-black">{t('objectiveTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('objective')}</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-fuchsia-300"><span className="inline-flex items-center gap-2"><Users size={18} />2+ jogadores · offline</span>{deck ? <span>{deck.cards.length} cartas</span> : null}</div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">{t('flowTitle')}</h2><div className="mt-3 grid gap-3">
      <RuleStep icon={<Drama size={20} />} number="1" text={t('flow.choose')} />
      <RuleStep icon={<Timer size={20} />} number="2" text={t('flow.act')} />
      <RuleStep icon={<Trophy size={20} />} number="3" text={t('flow.score')} />
    </div></div>
    <Card className="mx-auto mt-5 max-w-lg p-5"><h2 className="text-xl font-black">{t('rulesTitle')}</h2><div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300"><p>{t('rules.0')}</p><p>{t('rules.1')}</p><p>{t('rules.2')}</p><p>{t('rules.3')}</p></div></Card>
    <Card className="mx-auto mt-5 max-w-lg border-fuchsia-400/30 bg-fuchsia-400/10 p-5 text-sm leading-6 text-fuchsia-100"><strong>{t('tipTitle')}</strong> {t('tip')}</Card>
    {resumeError ? <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{resumeError}</p> : null}
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />{t('discardGame')}</Button> : null}<Button size="lg" variant="secondary" onClick={() => setShowRules(true)}><BookOpen size={19} />{t('howToPlay')}</Button></div>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">
      {session ? <Button className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={() => navigate(session.phase === 'finished' ? '/games/mimica/result' : '/games/mimica/play')}><Play size={19} />{t('continueGame')}</Button> : <Button className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={!initialized} size="lg" onClick={() => navigate('/games/mimica/setup')}><Play size={19} />{t('configureGame')}</Button>}
    </div>
    <BottomSheet open={showRules} title={t('howToPlay')} onClose={() => setShowRules(false)}><div className="space-y-3 leading-7 text-slate-300"><p>{t('rules.0')}</p><p>{t('rules.1')}</p><p>{t('rules.2')}</p><p>{t('rules.3')}</p></div></BottomSheet>
  </div>
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-fuchsia-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
