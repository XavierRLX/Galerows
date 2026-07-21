import { BookOpen, EyeOff, Play, RotateCcw, Sparkles, UserRoundSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FavoriteGameButton } from '../games/FavoriteGameButton'
import { useQuemSouEuStore } from './quemSouEu.store'
import { useQuemSouEuInitialization } from './useQuemSouEuInitialization'

export function QuemSouEuHomeScreen() {
  const { t } = useTranslation('quem-sou-eu')
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)
  const { session, initialized, discard } = useQuemSouEuStore()
  useQuemSouEuInitialization()

  return <div className="min-h-dvh pb-32"><Header action={<FavoriteGameButton gameId="quem-sou-eu" />} backTo="/" title={t('name')} /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-sky-500 text-white shadow-2xl shadow-sky-500/25"><UserRoundSearch size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">{t('eyebrow')}</p><h1 className="mt-2 text-4xl font-black tracking-tight">{t('name')}</h1><p className="mt-4 leading-7 text-slate-300">{t('summary')}</p></div>
    <Card className="mx-auto mt-8 max-w-lg border-sky-400/30 bg-sky-500/10 p-5"><h2 className="text-lg font-black">{t('objectiveTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('objective')}</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-cyan-200"><span>2+ jogadores · offline</span><span>{t('upToWords')}</span></div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">{t('flowTitle')}</h2><div className="mt-3 grid gap-3">
      <RuleStep icon={<Sparkles size={20} />} number="1" text={t('flow.write')} />
      <RuleStep icon={<EyeOff size={20} />} number="2" text={t('flow.hide')} />
      <RuleStep icon={<UserRoundSearch size={20} />} number="3" text={t('flow.guess')} />
    </div></div>
    <Card className="mx-auto mt-5 max-w-lg border-cyan-300/30 bg-cyan-400/10 p-5 text-sm leading-6 text-cyan-50"><strong>{t('tipTitle')}</strong> {t('tip')}</Card>
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />{t('discardGame')}</Button> : null}<Button size="lg" variant="secondary" onClick={() => setShowRules(true)}><BookOpen size={19} />{t('howToPlay')}</Button></div>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">
      {session ? <Button className="w-full bg-sky-400 text-slate-950 hover:bg-sky-300" size="lg" onClick={() => navigate(session.phase === 'summary' ? '/games/quem-sou-eu/result' : '/games/quem-sou-eu/play')}><Play size={19} />{t('continueGame')}</Button> : <Button className="w-full bg-sky-400 text-slate-950 hover:bg-sky-300" disabled={!initialized} size="lg" onClick={() => navigate('/games/quem-sou-eu/setup')}><Play size={19} />{t('startGame')}</Button>}
    </div>
    <BottomSheet open={showRules} title={t('howToPlay')} onClose={() => setShowRules(false)}><div className="space-y-3 leading-7 text-slate-300"><p>{t('rules.0')}</p><p>{t('rules.1')}</p><p>{t('rules.2')}</p></div></BottomSheet>
  </div>
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-cyan-200">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
