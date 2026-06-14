import { BookOpen, Check, Flame, Hammer, Play, RotateCcw, Spade, TrendingUp, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useNemFerrandoStore } from './nemFerrando.store'
import { useNemFerrandoInitialization } from './useNemFerrandoInitialization'

export function NemFerrandoHomeScreen() {
  const { t } = useTranslation('nem-ferrando'); const navigate = useNavigate(); const [showRules, setShowRules] = useState(false)
  const { deck, session, initialized, resumeError, discard } = useNemFerrandoStore()
  useNemFerrandoInitialization()
  const curiosityCount = deck?.cards.reduce((total, card) => total + card.curiosities.length, 0) ?? 0
  return (
    <div className="min-h-dvh pb-32"><Header backTo="/" title={t('name')} /><section className="px-5 pt-8">
      <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-orange-400 text-slate-950 shadow-2xl shadow-orange-400/20"><Spade size={44} /></div>
      <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">{t('eyebrow')}</p><h1 className="mt-2 text-4xl font-black tracking-tight">{t('name')}</h1><p className="mt-4 leading-7 text-slate-300">{t('summary')}</p></div>
      <Card className="mx-auto mt-8 max-w-lg p-5"><h2 className="text-lg font-black">{t('objectiveTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('objective')}</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-orange-300"><span className="inline-flex items-center gap-2"><Users size={18} />2 a 12 jogadores · totalmente offline</span>{deck ? <span>{deck.cards.length} cartas · {curiosityCount} curiosidades</span> : null}</div></Card>
      <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">{t('flowTitle')}</h2><div className="mt-3 grid gap-3">
        <RuleStep icon={<Spade size={20} />} number="1" text={t('flow.choose')} />
        <RuleStep icon={<TrendingUp size={20} />} number="2" text={t('flow.guess')} />
        <RuleStep icon={<Flame size={20} />} number="3" text={t('flow.challenge')} />
        <RuleStep icon={<Hammer size={20} />} number="4" text={t('flow.reveal')} />
      </div></div>
      <Card className="mx-auto mt-5 max-w-lg overflow-hidden"><div className="border-b border-white/10 p-5"><h2 className="text-xl font-black">{t('penaltyTitle')}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{t('penaltyIntro')}</p></div><div className="grid sm:grid-cols-2"><div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><div className="flex items-center gap-2 font-black text-lime-300"><Check size={19} />{t('penalty.safeTitle')}</div><p className="mt-2 text-sm leading-6 text-slate-300">{t('penalty.safe')}</p></div><div className="p-5"><div className="flex items-center gap-2 font-black text-rose-300"><X size={19} />{t('penalty.overTitle')}</div><p className="mt-2 text-sm leading-6 text-slate-300">{t('penalty.over')}</p></div></div></Card>
      <Card className="mx-auto mt-5 max-w-lg border-orange-400/30 bg-orange-400/10 p-5"><p className="text-sm font-black uppercase tracking-wider text-orange-300">{t('exampleTitle')}</p><p className="mt-2 text-sm leading-6 text-slate-200">{t('example')}</p></Card>
      {resumeError ? <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{resumeError}</p> : null}
      <div className="mx-auto mt-6 grid max-w-lg gap-3">
        {session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />{t('discardGame')}</Button> : null}
        <Button size="lg" variant="secondary" onClick={() => setShowRules(true)}><BookOpen size={19} />{t('howToPlay')}</Button>
      </div>
    </section>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">
        {session ? <Button className="w-full" size="lg" onClick={() => navigate(session.phase === 'finished' ? '/games/nem-ferrando/result' : '/games/nem-ferrando/play')}><Play size={19} />{t('continueGame')}</Button> : <Button className="w-full" disabled={!initialized} size="lg" onClick={() => navigate('/games/nem-ferrando/setup')}><Play size={19} />{t('configureGame')}</Button>}
      </div>
      <BottomSheet open={showRules} title={t('howToPlay')} onClose={() => setShowRules(false)}><div className="space-y-3 leading-7 text-slate-300"><p>{t('rules.0')}</p><p>{t('rules.1')}</p><p>{t('rules.2')}</p><p>{t('rules.3')}</p><div className="rounded-2xl bg-orange-400/10 p-4 text-sm"><strong className="text-orange-300">{t('exampleTitle')}:</strong> {t('example')}</div></div></BottomSheet></div>
  )
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-400 text-slate-950">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-orange-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
