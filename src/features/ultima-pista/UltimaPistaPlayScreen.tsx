import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, HelpCircle, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import type { UltimaPistaCard } from './content/ultimaPistaContent.types'
import { useUltimaPistaStore } from './ultimaPista.store'
import type { UltimaPistaPhase } from './ultimaPista.types'
import { useUltimaPistaInitialization } from './useUltimaPistaInitialization'

export function UltimaPistaPlayScreen() {
  const { t } = useTranslation('ultima-pista')
  const { deck, progress, toggleSolved, resetProgress } = useUltimaPistaStore()
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [phase, setPhase] = useState<UltimaPistaPhase>('browsing')
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [resetOpen, setResetOpen] = useState(false)
  useUltimaPistaInitialization()

  if (!deck || !progress) return <div className="p-6 text-slate-400">{t('common:loading', { defaultValue: 'Carregando...' })}</div>
  const effectiveSelectedCardId = selectedCardId ?? deck.cards.find((card) => !progress.solvedCardIds.includes(card.id))?.id ?? deck.cards[0]?.id ?? null
  if (effectiveSelectedCardId === null) return null
  const cardIndex = Math.max(0, deck.cards.findIndex((card) => card.id === effectiveSelectedCardId))
  const card = deck.cards[cardIndex]
  if (!card) return null
  const solved = progress.solvedCardIds.includes(card.id)
  const allSolved = progress.solvedCardIds.length === deck.cards.length
  const changeCard = (offset: number) => {
    const nextIndex = (cardIndex + offset + deck.cards.length) % deck.cards.length
    setSlideDirection(offset > 0 ? 'left' : 'right')
    setSelectedCardId(deck.cards[nextIndex]?.id ?? card.id)
    setPhase('browsing')
    void AppHaptics.light()
  }

  return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.12),transparent_30%)] pb-10">{phase === 'browsing' ? <Header backTo="/games/ultima-pista" title={t('deck.title')} action={<span className="text-xs font-black text-[#c4b5fd]">{t('solvedProgress', { solved: progress.solvedCardIds.length, total: deck.cards.length })}</span>} /> : null}
    {phase === 'browsing' ? <BrowsingCard allSolved={allSolved} card={card} cardIndex={cardIndex} slideDirection={slideDirection} solved={solved} total={deck.cards.length} onChoose={() => { setSelectedCardId(card.id); setPhase('mediator-reading'); void AppHaptics.medium() }} onNext={() => changeCard(1)} onPrevious={() => changeCard(-1)} onReset={() => setResetOpen(true)} /> : null}
    {phase === 'mediator-reading' ? <MediatorBack card={card} solved={solved} onClose={() => { setPhase('browsing'); void AppHaptics.light() }} onToggleSolved={async () => { await toggleSolved(card.id); await AppHaptics.medium() }} /> : null}
    <Modal open={resetOpen} title={t('deck.resetTitle')} onClose={() => setResetOpen(false)}><p className="text-sm leading-6 text-slate-300">{t('deck.resetDescription')}</p><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => setResetOpen(false)}>{t('deck.cancel')}</Button><Button variant="danger" onClick={async () => { await resetProgress(); setResetOpen(false); await AppHaptics.light() }}>{t('deck.confirmReset')}</Button></div></Modal>
  </div>
}

function BrowsingCard({ card, cardIndex, total, solved, allSolved, slideDirection, onPrevious, onNext, onChoose, onReset }: { card: UltimaPistaCard; cardIndex: number; total: number; solved: boolean; allSolved: boolean; slideDirection: 'left' | 'right'; onPrevious: () => void; onNext: () => void; onChoose: () => void; onReset: () => void }) {
  const { t } = useTranslation('ultima-pista')
  const swipeStartX = useRef<number | null>(null)
  const finishSwipe = (clientX: number) => {
    if (swipeStartX.current === null) return
    const distance = clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(distance) < 52) return
    if (distance < 0) onNext()
    else onPrevious()
  }
  return <section className="px-5 py-6">
    {allSolved ? <Card className="mx-auto mb-5 max-w-lg border-lime-300/30 bg-lime-400/10 p-5 text-center"><CheckCircle2 className="mx-auto text-lime-300" size={36} /><h1 className="mt-3 text-xl font-black">{t('deck.deckComplete')}</h1><p className="mt-1 text-sm text-slate-300">{t('deck.deckCompleteDescription')}</p></Card> : null}
    <div className="mx-auto flex max-w-[23rem] items-center justify-between gap-3"><Button aria-label={t('deck.previous')} className="border-[#8b5cf6]/30 bg-[#2e1065]/25 text-[#ddd6fe]" size="icon" variant="secondary" onClick={onPrevious}><ArrowLeft size={19} /></Button><span className="rounded-full border border-[#8b5cf6]/20 bg-[#2e1065]/25 px-4 py-2 text-sm font-black text-[#c4b5fd]">{cardIndex + 1} / {total}</span><Button aria-label={t('deck.next')} className="border-[#8b5cf6]/30 bg-[#2e1065]/25 text-[#ddd6fe]" size="icon" variant="secondary" onClick={onNext}><ArrowRight size={19} /></Button></div>
    <Card aria-label={t('deck.swipeHint')} className={cn('relative mx-auto mt-5 aspect-[5/7] w-full max-w-[23rem] touch-pan-y select-none overflow-hidden rounded-[1.8rem] border-2 border-[#8b5cf6]/55 bg-[radial-gradient(circle_at_50%_34%,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(192,132,252,0.12),transparent_25%),linear-gradient(145deg,#25113f,#12091f_72%)] p-0 shadow-[0_30px_70px_-25px_rgba(76,29,149,0.85),inset_0_1px_0_rgba(255,255,255,0.16)]', slideDirection === 'left' ? 'ultima-pista-card-from-right' : 'ultima-pista-card-from-left', solved && 'border-lime-300/50')} key={card.id} onPointerCancel={() => { swipeStartX.current = null }} onPointerDown={(event) => { swipeStartX.current = event.clientX }} onPointerUp={(event) => finishSwipe(event.clientX)}>
      <div className="pointer-events-none absolute inset-2.5 rounded-[1.35rem] border border-[#c4b5fd]/25" />
      <div className="pointer-events-none absolute inset-5 rounded-[1rem] border border-[#8b5cf6]/15" />
      <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full border border-[#a78bfa]/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 size-52 rounded-full border border-[#a78bfa]/10" />
      <div className="absolute left-6 top-6 z-10 text-center text-[#ddd6fe]"><span className="block text-xl font-black leading-none">{String(card.id).padStart(2, '0')}</span><HelpCircle className="mx-auto mt-1" size={14} /></div>
      <div className="absolute bottom-6 right-6 z-10 rotate-180 text-center text-[#ddd6fe]"><span className="block text-xl font-black leading-none">{String(card.id).padStart(2, '0')}</span><HelpCircle className="mx-auto mt-1" size={14} /></div>
      {solved ? <span className="absolute right-6 top-6 z-10 inline-flex items-center gap-1 rounded-full border border-lime-300/25 bg-lime-400/15 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-lime-200"><Check size={13} />{t('deck.resolved')}</span> : null}
      <div className="relative z-[1] flex h-full flex-col items-center px-8 pb-14 pt-16 text-center">
        <p className="text-[0.63rem] font-black uppercase tracking-[0.28em] text-[#a78bfa]">{t('name')}</p>
        <div className="mt-7 flex size-20 shrink-0 items-center justify-center rounded-full border border-[#c4b5fd]/35 bg-[#6d28d9]/18 shadow-[0_0_35px_rgba(109,40,217,0.3)]"><HelpCircle className="text-[#ddd6fe]" size={38} /></div>
        <div className="mt-6 h-px w-16 bg-gradient-to-r from-transparent via-[#a78bfa] to-transparent" />
        <h1 className="mt-5 text-3xl font-black leading-tight text-white">{card.title}</h1>
        <div className="mt-5 flex min-h-0 flex-1 items-center"><p className="text-base leading-7 text-[#ede9fe]">{card.prompt}</p></div>
        <p className="mt-4 text-[0.57rem] font-black uppercase tracking-[0.18em] text-[#8b5cf6]">{t('playing.yes')} · {t('playing.no')} · {t('playing.irrelevant')}</p>
      </div>
    </Card>
    <p className="mx-auto mt-3 flex max-w-[23rem] items-center justify-center gap-2 text-xs font-bold text-[#8b5cf6]"><ArrowLeft size={14} />{t('deck.swipeHint')}<ArrowRight size={14} /></p>
    <div className="mx-auto mt-6 grid max-w-[23rem] gap-3"><Button className="bg-[#6d28d9] text-white shadow-lg shadow-[#2e1065]/40 hover:bg-[#7c3aed]" size="lg" onClick={onChoose}><BookOpenCheck size={19} />{t(solved ? 'deck.review' : 'deck.choose')}</Button><Button className="text-[#c4b5fd]" variant="ghost" onClick={onReset}><RotateCcw size={17} />{t('deck.reset')}</Button></div>
  </section>
}

function MediatorBack({ card, solved, onClose, onToggleSolved }: { card: UltimaPistaCard; solved: boolean; onClose: () => void; onToggleSolved: () => void }) {
  const { t } = useTranslation('ultima-pista')
  return <section className="ultima-pista-back fixed inset-0 z-50 overflow-y-auto bg-[#08040f] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:py-5"><Card className="relative mx-auto min-h-[calc(100dvh-1rem)] max-w-2xl overflow-hidden rounded-[2rem] border-2 border-[#8b5cf6]/45 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(109,40,217,0.16),transparent_30%),linear-gradient(145deg,#25113f,#12091f_72%)] p-6 shadow-[0_30px_70px_-28px_rgba(76,29,149,0.8)] sm:min-h-[calc(100dvh-2.5rem)] sm:p-8"><div className="pointer-events-none absolute inset-2.5 rounded-[1.45rem] border border-[#c4b5fd]/20" /><div className="relative flex min-h-[calc(100dvh-4rem)] flex-col sm:min-h-[calc(100dvh-6.5rem)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0 pt-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#a78bfa]">{t('back.eyebrow')} · {String(card.id).padStart(2, '0')}</p>{solved ? <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-lime-300/20 bg-lime-400/15 px-3 py-1 text-xs font-black text-lime-200"><Check size={14} />{t('deck.resolved')}</span> : null}</div><Button aria-label={t('back.close')} className="shrink-0 border-[#8b5cf6]/30 bg-[#2e1065]/55 text-[#ddd6fe]" size="icon" variant="secondary" onClick={onClose}><X size={22} /></Button></div><h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{card.title}</h1><div className="mt-6 rounded-2xl border border-[#a78bfa]/25 bg-[#6d28d9]/15 p-4 shadow-inner"><h2 className="text-sm font-black text-[#c4b5fd]">{t('back.prompt')}</h2><p className="mt-2 text-lg leading-8 text-[#f5f3ff]">{card.prompt}</p><div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-wider"><span className="rounded-full bg-lime-400/15 px-2.5 py-1 text-lime-200">{t('playing.yes')}</span><span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-rose-200">{t('playing.no')}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-300">{t('playing.irrelevant')}</span></div></div><h2 className="mt-7 text-lg font-black text-[#c4b5fd]">{t('back.story')}</h2><p className="mt-3 text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">{card.story}</p><div className="mt-7 border-t border-[#8b5cf6]/20 pt-6"><h2 className="font-black text-[#ede9fe]">{t('back.essentialFacts')}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{t('back.essentialDescription')}</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{card.essentialFacts.map((fact) => <li className="flex gap-3 rounded-2xl border border-[#8b5cf6]/10 bg-white/5 p-3 text-sm leading-6" key={fact}><CheckCircle2 className="mt-0.5 shrink-0 text-[#a78bfa]" size={18} />{fact}</li>)}</ul></div><div className="mt-auto pt-7"><Button className={cn('w-full', solved ? 'border-[#8b5cf6]/35 text-[#ddd6fe]' : 'bg-[#6d28d9] text-white hover:bg-[#7c3aed]')} size="lg" variant={solved ? 'secondary' : 'primary'} onClick={onToggleSolved}><CheckCircle2 size={19} />{t(solved ? 'back.markUnsolved' : 'back.markSolved')}</Button></div></div></Card></section>
}
