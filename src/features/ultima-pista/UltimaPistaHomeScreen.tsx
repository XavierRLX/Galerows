import { BookKey, CheckCircle2, Eye, EyeOff, HelpCircle, MessagesSquare, Play, RotateCcw, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { FavoriteGameButton } from '../games/FavoriteGameButton'
import { useUltimaPistaStore } from './ultimaPista.store'
import { useUltimaPistaInitialization } from './useUltimaPistaInitialization'

export function UltimaPistaHomeScreen() {
  const { t } = useTranslation('ultima-pista')
  const navigate = useNavigate()
  const { deck, progress, resetProgress } = useUltimaPistaStore()
  const [resolvedOpen, setResolvedOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  useUltimaPistaInitialization()
  const solved = progress?.solvedCardIds.length ?? 0
  const total = deck?.cards.length ?? 0
  const resolvedCards = deck?.cards.filter((card) => progress?.solvedCardIds.includes(card.id)) ?? []

  return <div className="min-h-dvh pb-28"><Header action={<FavoriteGameButton gameId="ultima-pista" />} backTo="/" title={t('name')} /><section className="px-5 py-8">
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
      <div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-4"><p className="font-black">{t('solvedProgress', { solved, total })}</p><CheckCircle2 className={solved === total && total > 0 ? 'text-lime-300' : 'text-[#a78bfa]'} size={25} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-[#a78bfa] transition-[width]" style={{ width: total ? `${(solved / total) * 100}%` : '0%' }} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Button className="border-[#8b5cf6]/25 bg-[#2e1065]/30 px-3 text-[#ddd6fe]" disabled={solved === 0} variant="secondary" onClick={() => setResolvedOpen(true)}><Eye size={17} />{t('deck.viewSolved')}</Button><Button className="px-3 text-slate-400 hover:text-rose-200" disabled={solved === 0} variant="ghost" onClick={() => setResetOpen(true)}><RotateCcw size={17} />{t('deck.reset')}</Button></div></div>
    </Card>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-[#8b5cf6]/20 bg-[#0f0b1a]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl"><Button className="w-full bg-[#6d28d9] text-white hover:bg-[#7c3aed]" size="lg" onClick={() => navigate('/games/ultima-pista/play')}><Play size={19} />{t('rules.openDeck')}</Button></div>
    <Modal open={resolvedOpen} title={t('deck.solvedCardsTitle')} onClose={() => setResolvedOpen(false)}><p className="text-sm leading-6 text-slate-300">{t('deck.solvedCardsDescription', { count: resolvedCards.length })}</p><div className="mt-4 grid max-h-[55dvh] gap-3 overflow-y-auto pr-1">{resolvedCards.map((card) => <Card className="border-lime-300/15 bg-lime-400/[0.06] p-4" key={card.id}><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-xs font-black text-lime-200">{String(card.id).padStart(2, '0')}</span><div className="min-w-0 flex-1"><h3 className="font-black text-white">{card.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{card.prompt}</p></div></div><Button className="mt-3 w-full border-[#8b5cf6]/25 bg-[#2e1065]/35 text-[#ddd6fe]" variant="secondary" onClick={() => { setResolvedOpen(false); navigate(`/games/ultima-pista/play?card=${card.id}`) }}><Eye size={16} />{t('deck.review')}</Button></Card>)}</div></Modal>
    <Modal open={resetOpen} title={t('deck.resetTitle')} onClose={() => setResetOpen(false)}><p className="text-sm leading-6 text-slate-300">{t('deck.resetDescription')}</p><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => setResetOpen(false)}>{t('deck.cancel')}</Button><Button variant="danger" onClick={async () => { await resetProgress(); setResetOpen(false); await AppHaptics.light() }}>{t('deck.confirmReset')}</Button></div></Modal>
  </div>
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex gap-3 text-sm leading-6 text-slate-300"><span className="mt-0.5 text-[#a78bfa]">{icon}</span><p>{text}</p></div>
}
