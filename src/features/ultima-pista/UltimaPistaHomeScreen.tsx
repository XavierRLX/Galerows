import { BookKey, CheckCircle2, EyeOff, HelpCircle, MessagesSquare, Play, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useUltimaPistaStore } from './ultimaPista.store'
import { useUltimaPistaInitialization } from './useUltimaPistaInitialization'

export function UltimaPistaHomeScreen() {
  const { t } = useTranslation('ultima-pista')
  const navigate = useNavigate()
  const { deck, progress } = useUltimaPistaStore()
  useUltimaPistaInitialization()
  const solved = progress?.solvedCardIds.length ?? 0
  const total = deck?.cards.length ?? 0

  return <div className="min-h-dvh pb-28"><Header backTo="/" title={t('name')} /><section className="px-5 py-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] border border-[#a78bfa]/35 bg-[#6d28d9]/20 text-[#ddd6fe] shadow-2xl shadow-[#2e1065]/45"><BookKey size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">{t('tagline')}</p><h1 className="mt-3 text-4xl font-black tracking-tight">{t('name')}</h1><p className="mt-4 leading-7 text-slate-300">{t('description')}</p></div>

    <Card className="mx-auto mt-8 max-w-lg border-[#8b5cf6]/25 bg-[radial-gradient(circle_at_top_right,rgba(109,40,217,0.16),transparent_34%),linear-gradient(145deg,rgba(38,19,65,0.72),rgba(15,23,42,0.86))] p-5 shadow-2xl shadow-[#2e1065]/20">
      <h2 className="text-xl font-black">{t('rules.title')}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{t('objective')}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-[#c4b5fd]"><span className="inline-flex items-center gap-2"><Users size={18} />2+ · offline</span><span className="inline-flex items-center gap-2"><HelpCircle size={18} />{t('cards', { count: total })}</span></div>
      <div className="mt-6 grid gap-3 border-t border-white/10 pt-5">
        <Rule icon={<EyeOff size={19} />} text={t('rules.compactSecret')} />
        <Rule icon={<MessagesSquare size={19} />} text={t('rules.compactQuestions')} />
        <Rule icon={<CheckCircle2 size={19} />} text={t('rules.compactResolve')} />
      </div>
      <div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-4"><p className="font-black">{t('solvedProgress', { solved, total })}</p><CheckCircle2 className={solved === total && total > 0 ? 'text-lime-300' : 'text-[#a78bfa]'} size={25} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-[#a78bfa] transition-[width]" style={{ width: total ? `${(solved / total) * 100}%` : '0%' }} /></div></div>
    </Card>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-[#8b5cf6]/20 bg-[#0f0b1a]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl"><Button className="w-full bg-[#6d28d9] text-white hover:bg-[#7c3aed]" size="lg" onClick={() => navigate('/games/ultima-pista/play')}><Play size={19} />{t('rules.openDeck')}</Button></div>
  </div>
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex gap-3 text-sm leading-6 text-slate-300"><span className="mt-0.5 text-[#a78bfa]">{icon}</span><p>{text}</p></div>
}
