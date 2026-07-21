import { ArrowRight, Check, Eye, EyeOff, Lightbulb, Pencil, RotateCcw, SkipForward, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { getPistaUnicaTarget } from './pistaUnica.content'
import { getVisiblePistaUnicaClues } from './pistaUnica.session'
import { usePistaUnicaStore } from './pistaUnica.store'
import type { PistaUnicaClue, PistaUnicaSession } from './pistaUnica.types'
import { usePistaUnicaInitialization } from './usePistaUnicaInitialization'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'

export function PistaUnicaPlayScreen() {
  const { t } = useTranslation('pista-unica')
  const navigate = useNavigate()
  const { session, initialized, openClue, addClue, updateClue, toggleClue, beginGuess, finishRound, continueRound } = usePistaUnicaStore()
  usePistaUnicaInitialization()
  usePistaUnicaTheme()
  useEffect(() => {
    if (initialized && !session) navigate('/games/pista-unica', { replace: true })
    if (session?.phase === 'finished') navigate('/games/pista-unica/result', { replace: true })
  }, [initialized, navigate, session])
  if (!session) return <div className="p-6 text-slate-400">{t('loading')}</div>
  const target = getPistaUnicaTarget(session.currentTargetId)
  const guesser = session.participants[session.currentGuesserIndex]
  if (!target || !guesser) return null

  if (session.phase === 'pass-clue') {
    const contributor = session.participants.find((participant) => participant.id === session.clueOrder[session.clueIndex])
    if (!contributor) return null
    return <PrivateGate label={t('play.passTo', { name: contributor.name })} description={t('play.passDescription', { guesser: guesser.name })} button={t('play.showTarget')} onContinue={() => void openClue()} />
  }
  if (session.phase === 'write-clue') {
    const contributor = session.participants.find((participant) => participant.id === session.clueOrder[session.clueIndex])
    if (!contributor) return null
    return <WriteClue contributorName={contributor.name} target={target.title} onSave={async (text) => { await addClue(contributor.id, text); await AppHaptics.light() }} />
  }
  if (session.phase === 'review') return <ReviewClues session={session} target={target.title} onBegin={async () => { await beginGuess(); await AppHaptics.medium() }} onToggle={toggleClue} onUpdate={updateClue} />
  if (session.phase === 'guess') return <GuessScreen clues={getVisiblePistaUnicaClues(session.clues)} guesserName={guesser.name} onResult={async (correct) => { await finishRound(correct); await AppHaptics.medium() }} />
  if (session.phase === 'round-result') return <RoundResult session={session} target={target.title} onContinue={async () => { await continueRound(); await AppHaptics.light() }} />
  return null
}

function PrivateGate({ label, description, button, onContinue }: { label: string; description: string; button: string; onContinue: () => void }) {
  const { t } = useTranslation('pista-unica')
  return <div className="flex min-h-dvh flex-col bg-[#03150d] text-white"><div className="flex items-center justify-between px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200"><EyeOff size={18} />{t('play.secret')}</span><Button className="rounded-full text-slate-300" variant="ghost" onClick={() => history.back()}><RotateCcw size={17} />{t('play.exit')}</Button></div><section className="flex flex-1 flex-col items-center justify-center px-5 text-center"><div className="flex size-24 items-center justify-center rounded-[2rem] border border-emerald-300/25 bg-emerald-700/35 text-emerald-200"><Users size={44} /></div><p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-emerald-300">{t('play.clueTurn')}</p><h1 className="mt-4 max-w-md text-4xl font-black leading-tight">{label}</h1><p className="mt-5 max-w-sm text-base leading-7 text-emerald-50/80">{description}</p></section><div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"><Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" size="lg" onClick={onContinue}><Eye size={19} />{button}</Button></div></div>
}

function WriteClue({ contributorName, target, onSave }: { contributorName: string; target: string; onSave: (text: string) => Promise<void> }) {
  const { t } = useTranslation('pista-unica')
  const [text, setText] = useState('')
  return <div className="flex min-h-dvh flex-col bg-[#052617] text-white"><div className="flex items-center justify-between px-5 py-5"><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{contributorName}</span><span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-200"><Eye size={18} />{t('play.onlyYou')}</span></div><section className="flex flex-1 flex-col justify-center px-5 text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">{t('play.secretTarget')}</p><h1 className="mt-5 break-words text-5xl font-black leading-tight text-emerald-50">{target}</h1><div className="mx-auto mt-9 w-full max-w-md text-left"><label className="text-sm font-black text-emerald-100" htmlFor="pista">{t('play.clueLabel')}</label><p className="mt-1 text-sm leading-6 text-emerald-100/70">{t('play.clueHint')}</p><input autoComplete="off" autoFocus className="mt-3 min-h-14 w-full rounded-2xl border border-emerald-300/25 bg-black/20 px-4 text-lg font-bold outline-none placeholder:text-emerald-100/35 focus:border-emerald-300" id="pista" maxLength={48} placeholder={t('play.cluePlaceholder')} value={text} onChange={(event) => setText(event.target.value)} /></div></section><div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"><Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={!text.trim()} size="lg" onClick={() => void onSave(text)}><ArrowRight size={19} />{t('play.saveClue')}</Button></div></div>
}

function ReviewClues({ session, target, onToggle, onUpdate, onBegin }: { session: PistaUnicaSession; target: string; onToggle: (id: string) => Promise<void>; onUpdate: (id: string, text: string) => Promise<void>; onBegin: () => Promise<void> }) {
  const { t } = useTranslation('pista-unica')
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(session.clues.map((clue) => [clue.id, clue.text])))
  const visible = getVisiblePistaUnicaClues(session.clues)
  const commit = (clue: PistaUnicaClue) => { const text = drafts[clue.id] ?? clue.text; if (text.trim() && text !== clue.text) void onUpdate(clue.id, text) }
  const saveAllAndBegin = async () => {
    for (const clue of session.clues) {
      const text = drafts[clue.id] ?? clue.text
      if (text.trim() && text !== clue.text) await onUpdate(clue.id, text)
    }
    await onBegin()
  }
  return <div className="min-h-dvh bg-[#03150d] pb-28 text-white"><div className="border-b border-emerald-400/15 px-5 py-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">{t('review.private')}</p><h1 className="mt-2 text-2xl font-black">{t('review.title')}</h1><p className="mt-2 text-sm leading-6 text-slate-300">{t('review.description')}</p></div><section className="px-5 py-6"><Card className="border-emerald-300/25 bg-emerald-700/20 p-4"><p className="text-xs font-black uppercase tracking-wider text-emerald-200">{t('play.secretTarget')}</p><p className="mt-1 text-2xl font-black">{target}</p></Card><div className="mt-5 grid gap-3">{session.clues.map((clue) => <div className={clue.included ? 'rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-4' : 'rounded-3xl border border-white/10 bg-white/[0.03] p-4 opacity-60'} key={clue.id}><div className="flex items-center gap-3"><button aria-label={clue.included ? t('review.exclude') : t('review.include')} className={cnToggle(clue.included)} type="button" onClick={() => void onToggle(clue.id)}>{clue.included ? <Check size={17} /> : <X size={17} />}</button><input aria-label={t('review.clueField')} className="min-h-11 min-w-0 flex-1 bg-transparent font-bold outline-none" maxLength={48} value={drafts[clue.id] ?? clue.text} onBlur={() => commit(clue)} onChange={(event) => setDrafts((current) => ({ ...current, [clue.id]: event.target.value }))} /><Pencil className="text-emerald-200" size={16} /></div></div>)}</div><p className="mt-5 text-sm font-bold text-emerald-200">{t('review.ready', { count: visible.length })}</p><p className="mt-1 text-sm leading-6 text-slate-400">{t('review.duplicates')}</p></section><div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl border-t border-emerald-400/15 bg-[#03150d]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur"><Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={!visible.length} size="lg" onClick={() => void saveAllAndBegin()}><EyeOff size={19} />{t('review.showGuesser')}</Button></div></div>
}

function GuessScreen({ guesserName, clues, onResult }: { guesserName: string; clues: PistaUnicaClue[]; onResult: (correct: boolean) => Promise<void> }) {
  const { t } = useTranslation('pista-unica')
  return <div className="flex min-h-dvh flex-col bg-emerald-700 text-white"><div className="flex items-center justify-between px-5 py-5"><span className="rounded-full bg-black/20 px-4 py-2 text-sm font-black">{guesserName}</span><span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-100"><Lightbulb size={18} />{t('guess.yourTurn')}</span></div><section className="flex flex-1 flex-col items-center justify-center px-5 text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-100">{t('guess.title')}</p><h1 className="mt-4 max-w-md text-4xl font-black leading-tight">{t('guess.instruction')}</h1><div className="mt-8 flex max-w-lg flex-wrap justify-center gap-3">{clues.map((clue) => <span className="rounded-full border border-emerald-100/30 bg-black/20 px-5 py-3 text-lg font-black shadow-lg" key={clue.id}>{clue.text}</span>)}</div></section><div className="grid gap-3 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"><Button className="bg-lime-300 text-emerald-950 hover:bg-lime-200" size="lg" onClick={() => void onResult(true)}><Check size={20} />{t('guess.correct')}</Button><Button className="bg-amber-300 text-amber-950 hover:bg-amber-200" size="lg" onClick={() => void onResult(false)}><SkipForward size={20} />{t('guess.skip')}</Button></div></div>
}

function RoundResult({ session, target, onContinue }: { session: PistaUnicaSession; target: string; onContinue: () => Promise<void> }) {
  const { t } = useTranslation('pista-unica')
  const result = session.lastRoundResult
  const guesser = session.participants[session.currentGuesserIndex]
  if (!result || !guesser) return null
  const finalRound = session.round >= session.participants.length
  return <div className="flex min-h-dvh flex-col bg-[#03150d] text-white"><section className="flex flex-1 flex-col items-center justify-center px-5 text-center"><div className={result.correct ? 'flex size-24 items-center justify-center rounded-[2rem] bg-lime-300 text-emerald-950' : 'flex size-24 items-center justify-center rounded-[2rem] bg-amber-300 text-amber-950'}>{result.correct ? <Check size={48} /> : <SkipForward size={48} />}</div><p className="mt-7 text-sm font-black uppercase tracking-[0.22em] text-emerald-300">{t('result.round', { current: session.round, total: session.participants.length })}</p><h1 className="mt-3 text-4xl font-black">{result.correct ? t('result.correctTitle') : t('result.skipTitle')}</h1><p className="mt-3 text-lg text-slate-300">{result.correct ? t('result.correctDescription', { name: guesser.name }) : t('result.skipDescription', { name: guesser.name })}</p><Card className="mt-8 w-full max-w-md border-emerald-300/25 bg-emerald-400/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-200">{t('result.answer')}</p><p className="mt-2 break-words text-3xl font-black">{target}</p></Card></section><div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"><Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" size="lg" onClick={() => void onContinue()}>{finalRound ? t('result.seeRanking') : t('result.nextRound')}<ArrowRight size={19} /></Button></div></div>
}

function cnToggle(active: boolean) { return active ? 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-emerald-950' : 'flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/20 text-slate-300' }
