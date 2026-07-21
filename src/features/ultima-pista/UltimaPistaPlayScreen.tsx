import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, HelpCircle, ListOrdered, Shuffle, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import type { UltimaPistaCard } from './content/ultimaPistaContent.types'
import { useUltimaPistaStore } from './ultimaPista.store'
import type { UltimaPistaOrderMode, UltimaPistaPhase } from './ultimaPista.types'
import { useUltimaPistaInitialization } from './useUltimaPistaInitialization'

export function UltimaPistaPlayScreen() {
  const { t } = useTranslation('ultima-pista')
  const { deck, progress, orderCardsSequentially, shuffleCards, toggleSolved } = useUltimaPistaStore()
  const [searchParams] = useSearchParams()
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [phase, setPhase] = useState<UltimaPistaPhase>('browsing')
  useUltimaPistaInitialization()

  if (!deck || !progress) return <div className="p-6 text-slate-400">{t('common:loading', { defaultValue: 'Carregando...' })}</div>
  const cards = progress.cardOrder.map((cardId) => deck.cards.find((card) => card.id === cardId)).filter((card): card is UltimaPistaCard => Boolean(card))
  const requestedCardId = Number(searchParams.get('card'))
  const effectiveSelectedCardId = selectedCardId ?? cards.find((card) => card.id === requestedCardId)?.id ?? cards.find((card) => !progress.solvedCardIds.includes(card.id))?.id ?? cards[0]?.id ?? null
  if (effectiveSelectedCardId === null) return null
  const cardIndex = Math.max(0, cards.findIndex((card) => card.id === effectiveSelectedCardId))
  const card = cards[cardIndex]
  if (!card) return null
  const previousCard = cards[(cardIndex - 1 + cards.length) % cards.length] ?? card
  const nextCard = cards[(cardIndex + 1) % cards.length] ?? card
  const solved = progress.solvedCardIds.includes(card.id)
  const allSolved = progress.solvedCardIds.length === deck.cards.length
  const changeCard = (offset: number) => {
    const nextIndex = (cardIndex + offset + cards.length) % cards.length
    setSelectedCardId(cards[nextIndex]?.id ?? card.id)
    setPhase('browsing')
    void AppHaptics.light()
  }
  const changeOrder = async (action: () => Promise<void>) => {
    await action()
    const reorderedProgress = useUltimaPistaStore.getState().progress
    const nextCardId = reorderedProgress?.cardOrder.find((cardId) => !reorderedProgress.solvedCardIds.includes(cardId)) ?? reorderedProgress?.cardOrder[0] ?? card.id
    setSelectedCardId(nextCardId)
    await AppHaptics.medium()
  }

  return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.12),transparent_30%)] pb-10">{phase === 'browsing' ? <Header backTo="/games/ultima-pista" title={t('deck.title')} action={<span className="text-xs font-black text-[#c4b5fd]">{t('solvedProgress', { solved: progress.solvedCardIds.length, total: deck.cards.length })}</span>} /> : null}
    {phase === 'browsing' ? <BrowsingCard allSolved={allSolved} card={card} cardIndex={cardIndex} nextCard={nextCard} orderMode={progress.orderMode} previousCard={previousCard} solved={solved} solvedCardIds={progress.solvedCardIds} total={cards.length} onChoose={() => { setSelectedCardId(card.id); setPhase('mediator-reading'); void AppHaptics.medium() }} onNext={() => changeCard(1)} onPrevious={() => changeCard(-1)} onSequential={() => changeOrder(orderCardsSequentially)} onShuffle={() => changeOrder(shuffleCards)} /> : null}
    {phase === 'mediator-reading' ? <MediatorBack card={card} solved={solved} onClose={() => { setPhase('browsing'); void AppHaptics.light() }} onToggleSolved={async () => { await toggleSolved(card.id); await AppHaptics.medium() }} /> : null}
  </div>
}

type BrowsingCardProps = {
  card: UltimaPistaCard
  previousCard: UltimaPistaCard
  nextCard: UltimaPistaCard
  cardIndex: number
  total: number
  solved: boolean
  solvedCardIds: number[]
  allSolved: boolean
  orderMode: UltimaPistaOrderMode
  onPrevious: () => void
  onNext: () => void
  onChoose: () => void
  onSequential: () => Promise<void>
  onShuffle: () => Promise<void>
}

function BrowsingCard({ card, previousCard, nextCard, cardIndex, total, solved, solvedCardIds, allSolved, orderMode, onPrevious, onNext, onChoose, onSequential, onShuffle }: BrowsingCardProps) {
  const { t } = useTranslation('ultima-pista')
  const swipeStartX = useRef<number | null>(null)
  const passTimer = useRef<number | null>(null)
  const orderTimer = useRef<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const [orderAnimation, setOrderAnimation] = useState<'shuffle' | 'sequential' | null>(null)

  useEffect(() => () => {
    if (passTimer.current !== null) window.clearTimeout(passTimer.current)
    if (orderTimer.current !== null) window.clearTimeout(orderTimer.current)
  }, [])

  const passCard = (direction: 'left' | 'right') => {
    if (leaving || orderAnimation) return
    swipeStartX.current = null
    setDragging(false)
    setLeaving(direction)
    passTimer.current = window.setTimeout(() => {
      if (direction === 'left') onNext()
      else onPrevious()
      setDragX(0)
      setLeaving(null)
    }, 240)
  }
  const finishSwipe = (clientX: number) => {
    if (swipeStartX.current === null) return
    const distance = clientX - swipeStartX.current
    swipeStartX.current = null
    setDragging(false)
    if (Math.abs(distance) < 64) {
      setDragX(0)
      return
    }
    passCard(distance < 0 ? 'left' : 'right')
  }
  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null || leaving) return
    setDragX(Math.max(-180, Math.min(180, event.clientX - swipeStartX.current)))
  }
  const changeOrder = (mode: UltimaPistaOrderMode) => {
    if (leaving || orderAnimation) return
    swipeStartX.current = null
    setDragging(false)
    setDragX(0)
    setOrderAnimation(mode === 'shuffled' ? 'shuffle' : 'sequential')
    orderTimer.current = window.setTimeout(() => {
      const action = mode === 'shuffled' ? onShuffle : onSequential
      void action().finally(() => {
        orderTimer.current = window.setTimeout(() => setOrderAnimation(null), mode === 'shuffled' ? 360 : 260)
      })
    }, mode === 'shuffled' ? 220 : 160)
  }
  const revealProgress = leaving ? 1 : Math.min(1, Math.abs(dragX) / 120)
  const revealPrevious = leaving === 'right' || (!leaving && dragX > 0)
  const revealedCard = revealPrevious ? previousCard : nextCard
  const activeTransform = leaving
    ? `translate3d(${leaving === 'left' ? '-118%' : '118%'}, -10px, 0) rotate(${leaving === 'left' ? '-11deg' : '11deg'}) scale(.98)`
    : `translate3d(${dragX}px, 0, 0) rotate(${Math.max(-8, Math.min(8, dragX / 22))}deg)`
  const underTransform = `translateY(${12 - revealProgress * 12}px) scale(${0.94 + revealProgress * 0.06})`
  const topAnimationClass = orderAnimation === 'shuffle' ? 'ultima-pista-shuffle-top' : orderAnimation === 'sequential' ? 'ultima-pista-order-top' : ''
  const middleAnimationClass = orderAnimation === 'shuffle' ? 'ultima-pista-shuffle-middle' : orderAnimation === 'sequential' ? 'ultima-pista-order-middle' : ''

  return <section className="px-5 py-6">
    {allSolved ? <Card className="mx-auto mb-5 max-w-lg border-lime-300/30 bg-lime-400/10 p-5 text-center"><CheckCircle2 className="mx-auto text-lime-300" size={36} /><h1 className="mt-3 text-xl font-black">{t('deck.deckComplete')}</h1><p className="mt-1 text-sm text-slate-300">{t('deck.deckCompleteDescription')}</p></Card> : null}
    <div aria-label={t('deck.orderMode')} className="mx-auto mb-5 grid max-w-[23rem] grid-cols-2 rounded-2xl border border-[#8b5cf6]/20 bg-[#160b29]/80 p-1.5 shadow-inner" role="group"><Button aria-label={t('deck.sequential')} aria-pressed={orderMode === 'sequential'} className={cn('min-h-10 rounded-xl border-0 px-3 text-xs', orderMode === 'sequential' ? 'bg-[#6d28d9] text-white shadow-md shadow-[#2e1065]/40' : 'bg-transparent text-slate-400 hover:bg-white/5')} disabled={Boolean(leaving || orderAnimation)} title={t('deck.sequentialDescription')} variant="ghost" onClick={() => changeOrder('sequential')}><ListOrdered size={16} />{t('deck.sequential')}</Button><Button aria-label={t('deck.shuffle')} aria-pressed={orderMode === 'shuffled'} className={cn('min-h-10 rounded-xl border-0 px-3 text-xs', orderMode === 'shuffled' ? 'bg-[#6d28d9] text-white shadow-md shadow-[#2e1065]/40' : 'bg-transparent text-slate-400 hover:bg-white/5')} disabled={Boolean(leaving || orderAnimation)} title={t('deck.shuffledDescription')} variant="ghost" onClick={() => changeOrder('shuffled')}><Shuffle size={16} />{t('deck.shuffled')}</Button></div>
    <div className="mx-auto flex max-w-[23rem] items-center justify-between gap-3"><Button aria-label={t('deck.previous')} className="border-[#8b5cf6]/30 bg-[#2e1065]/25 text-[#ddd6fe]" disabled={Boolean(leaving || orderAnimation)} size="icon" variant="secondary" onClick={() => passCard('right')}><ArrowLeft size={19} /></Button><span className="rounded-full border border-[#8b5cf6]/20 bg-[#2e1065]/25 px-4 py-2 text-sm font-black text-[#c4b5fd]">{cardIndex + 1} / {total}</span><Button aria-label={t('deck.next')} className="border-[#8b5cf6]/30 bg-[#2e1065]/25 text-[#ddd6fe]" disabled={Boolean(leaving || orderAnimation)} size="icon" variant="secondary" onClick={() => passCard('left')}><ArrowRight size={19} /></Button></div>
    <div className="relative mx-auto mt-5 aspect-[5/7] w-full max-w-[23rem]" data-card-stack>
      <div aria-hidden="true" className={cn('absolute inset-0 rounded-[1.8rem] border-2 border-[#8b5cf6]/20 bg-[#170c29] shadow-xl', orderAnimation === 'shuffle' && 'ultima-pista-shuffle-bottom')} style={{ transform: 'translateY(22px) scale(.88)' }} />
      <Card aria-hidden="true" className={cn(cardShellClasses, 'absolute inset-0 border-[#8b5cf6]/35 opacity-75', middleAnimationClass)} data-card-layer="under" style={{ opacity: 0.72 + revealProgress * 0.28, transform: underTransform }}><CardArtwork card={revealedCard} heading={false} solved={solvedCardIds.includes(revealedCard.id)} /></Card>
      <Card aria-label={t('deck.swipeHint')} className={cn(cardShellClasses, 'absolute inset-0 touch-pan-y', !dragging && !leaving && !orderAnimation && 'ultima-pista-card-settle', solved && 'border-lime-300/50', topAnimationClass)} data-card-layer="top" key={card.id} style={{ opacity: leaving ? 0.82 : 1, transform: orderAnimation ? undefined : activeTransform, transition: dragging ? 'none' : 'transform 260ms cubic-bezier(.22,.8,.2,1), opacity 220ms ease', willChange: 'transform' }} onPointerCancel={() => { swipeStartX.current = null; setDragging(false); setDragX(0) }} onPointerDown={(event) => { if (leaving || orderAnimation) return; event.currentTarget.setPointerCapture?.(event.pointerId); swipeStartX.current = event.clientX; setDragging(true) }} onPointerMove={moveSwipe} onPointerUp={(event) => finishSwipe(event.clientX)}>
        <CardArtwork card={card} heading solved={solved} />
      </Card>
    </div>
    <p aria-live="polite" className="mx-auto mt-7 flex max-w-[23rem] items-center justify-center gap-2 text-xs font-bold text-[#8b5cf6]"><ArrowLeft size={14} />{t('deck.swipeHint')}<ArrowRight size={14} /></p>
    <div className="mx-auto mt-6 max-w-[23rem]"><Button className="w-full bg-[#6d28d9] text-white shadow-lg shadow-[#2e1065]/40 hover:bg-[#7c3aed]" size="lg" onClick={onChoose}><BookOpenCheck size={19} />{t(solved ? 'deck.review' : 'deck.choose')}</Button></div>
  </section>
}

const cardShellClasses = 'h-full w-full select-none overflow-hidden rounded-[1.8rem] border-2 border-[#8b5cf6]/55 bg-[radial-gradient(circle_at_50%_34%,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(192,132,252,0.12),transparent_25%),linear-gradient(145deg,#25113f,#12091f_72%)] p-0 shadow-[0_30px_70px_-25px_rgba(76,29,149,0.85),inset_0_1px_0_rgba(255,255,255,0.16)]'

function CardArtwork({ card, solved, heading }: { card: UltimaPistaCard; solved: boolean; heading: boolean }) {
  const { t } = useTranslation('ultima-pista')
  const title: ReactNode = heading ? <h1 className="mt-5 text-3xl font-black leading-tight text-white">{card.title}</h1> : <p className="mt-5 text-3xl font-black leading-tight text-white">{card.title}</p>
  return <>
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
        {title}
        <div className="mt-5 flex min-h-0 flex-1 items-center"><p className="text-base leading-7 text-[#ede9fe]">{card.prompt}</p></div>
        <p className="mt-4 text-[0.57rem] font-black uppercase tracking-[0.18em] text-[#8b5cf6]">{t('playing.yes')} · {t('playing.no')} · {t('playing.irrelevant')}</p>
      </div>
    </>
}

function MediatorBack({ card, solved, onClose, onToggleSolved }: { card: UltimaPistaCard; solved: boolean; onClose: () => void; onToggleSolved: () => void }) {
  const { t } = useTranslation('ultima-pista')
  return <section className="ultima-pista-back fixed inset-0 z-50 overflow-y-auto bg-[#08040f] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:py-5"><Card className="relative mx-auto min-h-[calc(100dvh-1rem)] max-w-2xl overflow-hidden rounded-[2rem] border-2 border-[#8b5cf6]/45 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(109,40,217,0.16),transparent_30%),linear-gradient(145deg,#25113f,#12091f_72%)] p-6 shadow-[0_30px_70px_-28px_rgba(76,29,149,0.8)] sm:min-h-[calc(100dvh-2.5rem)] sm:p-8"><div className="pointer-events-none absolute inset-2.5 rounded-[1.45rem] border border-[#c4b5fd]/20" /><div className="relative flex min-h-[calc(100dvh-4rem)] flex-col sm:min-h-[calc(100dvh-6.5rem)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0 pt-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#a78bfa]">{t('back.eyebrow')} · {String(card.id).padStart(2, '0')}</p>{solved ? <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-lime-300/20 bg-lime-400/15 px-3 py-1 text-xs font-black text-lime-200"><Check size={14} />{t('deck.resolved')}</span> : null}</div><Button aria-label={t('back.close')} className="shrink-0 border-[#8b5cf6]/30 bg-[#2e1065]/55 text-[#ddd6fe]" size="icon" variant="secondary" onClick={onClose}><X size={22} /></Button></div><h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{card.title}</h1><div className="mt-6 rounded-2xl border border-[#a78bfa]/25 bg-[#6d28d9]/15 p-4 shadow-inner"><h2 className="text-sm font-black text-[#c4b5fd]">{t('back.prompt')}</h2><p className="mt-2 text-lg leading-8 text-[#f5f3ff]">{card.prompt}</p><div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-wider"><span className="rounded-full bg-lime-400/15 px-2.5 py-1 text-lime-200">{t('playing.yes')}</span><span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-rose-200">{t('playing.no')}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-300">{t('playing.irrelevant')}</span></div></div><h2 className="mt-7 text-lg font-black text-[#c4b5fd]">{t('back.story')}</h2><p className="mt-3 text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">{card.story}</p><div className="mt-7 border-t border-[#8b5cf6]/20 pt-6"><h2 className="font-black text-[#ede9fe]">{t('back.essentialFacts')}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{t('back.essentialDescription')}</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{card.essentialFacts.map((fact) => <li className="flex gap-3 rounded-2xl border border-[#8b5cf6]/10 bg-white/5 p-3 text-sm leading-6" key={fact}><CheckCircle2 className="mt-0.5 shrink-0 text-[#a78bfa]" size={18} />{fact}</li>)}</ul></div><div className="mt-auto pt-7"><Button className={cn('w-full', solved ? 'border-[#8b5cf6]/35 text-[#ddd6fe]' : 'bg-[#6d28d9] text-white hover:bg-[#7c3aed]')} size="lg" variant={solved ? 'secondary' : 'primary'} onClick={onToggleSolved}><CheckCircle2 size={19} />{t(solved ? 'back.markUnsolved' : 'back.markSolved')}</Button></div></div></Card></section>
}
