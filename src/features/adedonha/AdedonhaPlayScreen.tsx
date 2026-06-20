import QRCode from 'qrcode'
import { Check, Copy, Home, QrCode, RotateCcw, Send, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { AppReviewCheckpoint } from '../play-store/AppReviewCheckpoint'
import { adedonhaLetters, encodeAdedonhaShare, getAdedonhaMatchTotal, getAdedonhaRoundTotal } from './adedonha.session'
import { useAdedonhaStore } from './adedonha.store'
import type { AdedonhaRound, AdedonhaScore } from './adedonha.types'
import { useAdedonhaInitialization } from './useAdedonhaInitialization'

export function AdedonhaPlayScreen() {
  const navigate = useNavigate()
  const { t } = useTranslation('adedonha')
  const { session, initialized, setAnswer, setScore, setPlayerName, selectLetter, drawLetter, beginAnswers, beginScoring, finishScoring, finishMatch, restartRound, clearAnswers, discard } = useAdedonhaStore()
  const [shareOpen, setShareOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  useAdedonhaInitialization()
  useEffect(() => { if (initialized && !session) navigate('/games/adedonha', { replace: true }) }, [initialized, navigate, session])
  const shareCode = useMemo(() => session ? encodeAdedonhaShare(session.categories, session.letter) : '', [session])
  const shareUrl = useMemo(() => shareCode ? `${window.location.origin}/games/adedonha/setup?code=${encodeURIComponent(shareCode)}` : '', [shareCode])
  useEffect(() => {
    if (!shareOpen || !shareUrl) return
    QRCode.toDataURL(shareUrl, { margin: 1, width: 280 }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [shareOpen, shareUrl])
  if (!session) return <div className="p-6 text-slate-400">{t('play.loading')}</div>
  const answered = session.categories.filter((category) => session.answers[category.id]?.trim()).length
  const roundTotal = getAdedonhaRoundTotal(session)
  const matchTotal = getAdedonhaMatchTotal(session)

  return <div className="min-h-dvh pb-10"><Header backTo="/games/adedonha" title={t('name')} action={<Button size="icon" variant="secondary" onClick={() => setShareOpen(true)}><QrCode size={18} /></Button>} /><section className="px-5 py-6">
    <Card className="border-yellow-300/40 bg-yellow-400/10 p-5 text-center"><p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-200">{t('play.roundLetter')}</p><div className="mx-auto mt-3 flex size-28 items-center justify-center rounded-[2rem] bg-yellow-400 text-6xl font-black text-slate-950 shadow-2xl shadow-yellow-500/20">{session.letter}</div><p className="mt-3 text-sm text-slate-300">{session.phase === 'summary' ? t('play.roundPoints', { roundTotal, matchTotal }) : session.phase === 'finished' ? t('play.finalPoints', { matchTotal }) : t('play.answeredCount', { answered, total: session.categories.length })}</p>{session.phase !== 'summary' && session.phase !== 'finished' ? <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => void drawLetter()}><Shuffle size={18} />{t('play.newLetter')}</Button><Button variant="secondary" onClick={() => void clearAnswers()}><RotateCcw size={18} />{t('play.clear')}</Button></div> : null}</Card>
    {session.phase === 'choosing-letter' ? <section className="mt-5"><Card className="p-5"><h2 className="text-xl font-black">{t('play.chooseLetter')}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{t('play.chooseLetterDescription')}</p><div className="mt-4 grid grid-cols-6 gap-2">{adedonhaLetters.map((letter) => <button className={letter === session.letter ? 'min-h-11 rounded-2xl bg-yellow-400 font-black text-slate-950' : 'min-h-11 rounded-2xl border border-white/15 bg-white/5 font-black text-slate-200'} key={letter} onClick={() => void selectLetter(letter)} type="button">{letter}</button>)}</div><Button className="mt-5 w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => void beginAnswers()}><Send size={18} />{t('play.startAnswers')}</Button></Card></section> : null}
    {session.phase === 'answering' ? <section className="mt-5 grid gap-3">{session.categories.map((category) => <label className="block rounded-2xl border border-white/10 bg-white/[0.07] p-4" key={category.id}><span className="text-xs font-black uppercase tracking-wider text-yellow-200">{category.title}</span><input className="mt-2 min-h-12 w-full bg-transparent text-lg font-bold outline-none placeholder:text-slate-600" placeholder={t('play.answerPlaceholder', { letter: session.letter })} value={session.answers[category.id] ?? ''} onChange={(event) => void setAnswer(category.id, event.target.value)} /></label>)}<Button className="mt-3 bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => void beginScoring()}><Check size={18} />{t('play.finishAndScore')}</Button></section> : null}
    {session.phase === 'scoring' ? <section className="mt-5"><Card className="border-yellow-300/30 bg-yellow-400/10 p-5"><h2 className="text-xl font-black">{t('play.scoring')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('play.scoringDescription')}</p></Card><div className="mt-4 grid gap-3">{session.categories.map((category) => <ScoreRow answer={session.answers[category.id] ?? ''} category={category.title} key={category.id} score={session.scores[category.id] ?? 0} onScore={(score) => void setScore(category.id, score)} />)}</div><Button className="mt-5 w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => void finishScoring()}>{t('play.viewSummary')}</Button></section> : null}
    {session.phase === 'summary' ? <section className="mt-5"><Card className="p-5"><h2 className="text-xl font-black">{t('play.roundSummary')}</h2><label className="mt-4 block text-left"><span className="text-xs font-black uppercase tracking-wider text-yellow-200">{t('play.yourName')}</span><input className="mt-2 min-h-12 w-full rounded-2xl border border-white/15 bg-white/5 px-4 font-bold outline-none focus:border-yellow-300" placeholder={t('play.namePlaceholder')} value={session.playerName} onChange={(event) => void setPlayerName(event.target.value)} /></label><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-3xl bg-yellow-400 p-5 text-slate-950"><p className="text-xs font-black uppercase tracking-wider">{t('play.round')}</p><p className="text-3xl font-black">{roundTotal}</p></div><div className="rounded-3xl border border-yellow-300/30 bg-yellow-400/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-yellow-200">{t('play.total')}</p><p className="text-3xl font-black text-yellow-200">{matchTotal}</p></div></div></Card><Card className="mt-4 overflow-hidden">{session.categories.map((category) => <div className="border-b border-white/10 px-4 py-3 last:border-0" key={category.id}><div className="flex items-center justify-between gap-3"><span className="font-bold text-yellow-200">{category.title}</span><span className="font-black text-yellow-300">{session.scores[category.id] ?? 0} pts</span></div><p className="mt-1 text-sm text-slate-300">{session.answers[category.id]?.trim() || '-'}</p></div>)}</Card><RoundsHistory rounds={session.rounds} t={t} /><div className="mt-5 grid gap-3"><Button className="bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => void restartRound()}><RotateCcw size={18} />{t('play.newRound')}</Button><Button size="lg" variant="secondary" onClick={() => void finishMatch()}>{t('play.finishMatch')}</Button></div></section> : null}
    {session.phase === 'finished' ? <section className="mt-5"><AppReviewCheckpoint matchId={session.id} /><Card className="p-5 text-center"><h2 className="text-2xl font-black">{t('play.matchFinished')}</h2><p className="mt-2 text-sm text-slate-400">{t('play.savedRounds', { count: session.rounds.length })}</p><div className="mt-5 rounded-3xl bg-yellow-400 p-6 text-slate-950"><p className="text-sm font-black uppercase tracking-wider">{t('play.finalScore')}</p><p className="text-5xl font-black">{matchTotal} pts</p></div></Card><RoundsHistory rounds={session.rounds} t={t} /><div className="mt-5 grid gap-3"><Button className="bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={async () => { await discard(); navigate('/games/adedonha/setup') }}><Home size={18} />{t('play.newMatch')}</Button></div></section> : null}
    {session.phase !== 'finished' ? <div className="mt-6 grid gap-3"><Button className="bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => setShareOpen(true)}><QrCode size={18} />{t('play.shareTopics')}</Button><Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/games/adedonha/setup') }}><Home size={18} />{t('play.newSheet')}</Button></div> : null}
  </section>
    <Modal open={shareOpen} title={t('play.shareModalTitle')} onClose={() => setShareOpen(false)}>
      <p className="text-sm leading-6 text-slate-300">{t('play.shareModalDescription')}</p>
      <div className="mt-4 rounded-2xl bg-white p-3">{qrDataUrl ? <img alt={t('play.qrAlt')} className="mx-auto size-64" src={qrDataUrl} /> : <div className="flex h-64 items-center justify-center text-slate-500">{t('play.generatingQr')}</div>}</div>
      <textarea aria-label={t('play.shareCodeLabel')} className="mt-4 h-28 w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-xs text-slate-200" readOnly value={shareCode} />
      <Button className="mt-3 w-full" variant="secondary" onClick={() => void navigator.clipboard?.writeText(shareCode)}><Copy size={18} />{t('play.copyCode')}</Button>
    </Modal>
  </div>
}

function ScoreRow({ answer, category, score, onScore }: { answer: string; category: string; score: AdedonhaScore; onScore: (score: AdedonhaScore) => void }) {
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-yellow-200">{category}</p><p className="mt-1 break-words text-lg font-bold">{answer.trim() || '-'}</p></div><span className="shrink-0 rounded-full bg-yellow-400 px-3 py-1 font-black text-slate-950">{score}</span></div><div className="mt-4 grid grid-cols-3 gap-2">{([10, 5, 0] as const).map((value) => <Button className={score === value ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300' : ''} key={value} variant={score === value ? 'primary' : 'secondary'} onClick={() => onScore(value)}>{value}</Button>)}</div></Card>
}

type AdedonhaTranslate = ReturnType<typeof useTranslation>['t']

function RoundsHistory({ rounds, t }: { rounds: AdedonhaRound[]; t: AdedonhaTranslate }) {
  if (!rounds.length) return null
  return <Card className="mt-4 overflow-hidden"><div className="border-b border-white/10 px-4 py-3"><h3 className="text-sm font-black uppercase tracking-wider text-slate-400">{t('play.savedRoundsTitle')}</h3></div>{rounds.map((round, index) => <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-0" key={round.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}</span>{t('play.letter', { letter: round.letter })}</span><span className="font-black text-yellow-300">{round.total} pts</span></div>)}</Card>
}
