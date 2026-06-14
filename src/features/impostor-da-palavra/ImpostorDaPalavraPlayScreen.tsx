import { ArrowRight, Eye, EyeOff, HelpCircle, Home, MessageCircle, Search, ShieldQuestion, Trophy, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { cn } from '../../lib/utils/cn'
import { getParticipantBriefing } from './impostorDaPalavra.session'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'
import { useImpostorDaPalavraInitialization } from './useImpostorDaPalavraInitialization'

export function ImpostorDaPalavraPlayScreen() {
  const { t } = useTranslation('impostor-da-palavra')
  const navigate = useNavigate()
  const { deck, session, initialized, advanceRole, beginConversation, advanceClue, beginAccusation, selectAccused, confirmAccusation, recordFinalGuess, continueSummary } = useImpostorDaPalavraStore()
  const [showSecret, setShowSecret] = useState(false)
  useImpostorDaPalavraInitialization()
  useEffect(() => {
    if (initialized && !session) navigate('/games/impostor-da-palavra', { replace: true })
    if (session?.phase === 'finished') navigate('/games/impostor-da-palavra/result', { replace: true })
  }, [initialized, navigate, session])
  if (!deck || !session) return <div className="p-6 text-slate-400">Carregando partida...</div>

  const card = deck.cards.find((item) => item.id === session.currentCardId)
  const impostor = session.participants.find((item) => item.id === session.currentImpostorId)
  const accused = session.participants.find((item) => item.id === session.accusedParticipantId)
  const title = t('play.round', { current: session.round, total: session.participants.length })
  if (!card || !impostor) return <div className="p-6 text-rose-200">Não foi possível carregar a rodada atual.</div>

  if (session.phase === 'role-pass') {
    const participantId = session.rolePassOrder[session.rolePassIndex]
    const participant = session.participants.find((item) => item.id === participantId)!
    const briefing = getParticipantBriefing(session, deck, participant.id)
    return <Shell action={t('play.progress', { current: session.rolePassIndex + 1, total: session.participants.length })} title={title}>
      <div className="text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-full border border-violet-400/50 bg-violet-400/10 text-violet-300"><UserRound size={38} /></div><h1 className="mt-5 text-3xl font-black">{t('play.passTo', { name: participant.name })}</h1><p className="mt-2 text-slate-400">{t('play.private', { name: participant.name })}</p></div>
      <Card className={cn('mx-auto mt-8 flex min-h-60 max-w-lg items-center justify-center p-6 text-center transition', showSecret && 'border-violet-400 bg-violet-400/15 shadow-2xl shadow-violet-500/20')}>
        {showSecret && briefing ? <Briefing briefing={briefing} t={t} /> : <div><EyeOff className="mx-auto text-slate-500" size={54} /><p className="mt-4 text-lg font-bold text-slate-400">Palavra escondida</p></div>}
      </Card>
      <div className="mx-auto mt-6 grid max-w-lg gap-3">{showSecret ? <Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { setShowSecret(false); await advanceRole(); await AppHaptics.light() }}><EyeOff size={19} />{t('play.hide')}</Button> : <Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { setShowSecret(true); await AppHaptics.medium() }}><Eye size={19} />{t('play.show')}</Button>}</div>
    </Shell>
  }

  if (session.phase === 'conversation-intro') return <Shell title={title}><CenteredIcon icon={<MessageCircle size={40} />} /><h1 className="mt-5 text-center text-3xl font-black">{t('play.everyoneReady')}</h1><p className="mx-auto mt-3 max-w-md text-center leading-7 text-slate-400">{t('play.conversationIntro')}</p><Button className="mx-auto mt-8 flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={() => void beginConversation()}>{t('play.startConversation')}<ArrowRight size={19} /></Button></Shell>

  if (session.phase === 'clue-turn') {
    const participantId = session.speakingOrder[session.clueTurnIndex]
    const participant = session.participants.find((item) => item.id === participantId)!
    const questionId = session.questionAssignments[participant.id]
    const question = deck.questions.find((item) => item.id === questionId)
    const last = session.clueTurnIndex === session.speakingOrder.length - 1
    return <Shell action={t('play.progress', { current: session.clueTurnIndex + 1, total: session.participants.length })} title={title}>
      <div className="text-center"><CenteredIcon icon={<MessageCircle size={38} />} /><h1 className="mt-5 text-3xl font-black">{t('play.yourTurn', { name: participant.name })}</h1></div>
      <Card className="mx-auto mt-8 max-w-lg border-violet-400/30 bg-violet-400/10 p-6 text-center">{session.config.conversationMode === 'guided-questions' ? <><p className="text-sm font-black uppercase tracking-wider text-violet-300">{t('play.questionLabel')}</p><p className="mt-3 text-2xl font-black leading-9">{question?.text}</p></> : <><p className="text-sm font-black uppercase tracking-wider text-violet-300">{t('conversation.one-word.name')}</p><p className="mt-3 text-xl font-bold leading-8">{t('play.sayOneWord')}</p></>}</Card>
      <Button className="mx-auto mt-8 flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { await advanceClue(); await AppHaptics.light() }}>{last ? t('play.startDiscussion') : t('play.nextClue')}<ArrowRight size={19} /></Button>
    </Shell>
  }

  if (session.phase === 'discussion') return <Shell title={title}><CenteredIcon icon={<Search size={40} />} /><h1 className="mt-5 text-center text-3xl font-black">{t('play.discussionTitle')}</h1><p className="mx-auto mt-3 max-w-md text-center leading-7 text-slate-400">{t('play.discussionText')}</p><Button className="mx-auto mt-8 flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={() => void beginAccusation()}>{t('play.chooseAccused')}<ArrowRight size={19} /></Button></Shell>

  if (session.phase === 'accusation') return <Shell title={title}><CenteredIcon icon={<ShieldQuestion size={40} />} /><h1 className="mt-5 text-center text-3xl font-black">{t('play.accusationTitle')}</h1><p className="mx-auto mt-2 max-w-md text-center text-slate-400">{t('play.accusationText')}</p><Card className="mx-auto mt-6 max-w-lg overflow-hidden">{session.participants.map((item) => <button className={cn('flex min-h-14 w-full items-center justify-between border-b border-white/10 px-5 text-left font-bold last:border-0', session.accusedParticipantId === item.id && 'bg-violet-400/15 text-violet-300')} key={item.id} onClick={() => void selectAccused(item.id)} type="button"><span>{item.name}</span><span>{session.accusedParticipantId === item.id ? '✓' : ''}</span></button>)}</Card><Button className="mx-auto mt-6 flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={!accused} size="lg" onClick={() => void confirmAccusation()}>{accused ? t('play.confirmAccusation', { name: accused.name }) : t('play.chooseAccused')}</Button></Shell>

  if (session.phase === 'final-guess') return <Shell title={title}><CenteredIcon icon={<HelpCircle size={40} />} /><h1 className="mt-5 text-center text-3xl font-black">{t('play.finalGuessTitle')}</h1><p className="mx-auto mt-3 max-w-md text-center leading-7 text-slate-400">{t('play.finalGuessText', { name: impostor.name })}</p><div className="mx-auto mt-8 grid max-w-lg gap-3"><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={() => void recordFinalGuess(true)}>{t('play.guessCorrect')}</Button><Button size="lg" variant="secondary" onClick={() => void recordFinalGuess(false)}>{t('play.guessWrong')}</Button></div></Shell>

  if (session.phase === 'round-summary' && session.lastRoundResult) {
    const finished = session.round >= session.participants.length
    const impostorInfo = session.config.impostorMode === 'no-word' ? t('play.noWord') : session.config.impostorMode === 'hint' ? card.impostorHint : card.alternateWord
    return <Shell title={title}><CenteredIcon icon={<Trophy size={40} />} /><h1 className="mt-5 text-center text-3xl font-black">{t('play.summaryTitle')}</h1><Card className="mx-auto mt-6 max-w-lg p-5"><SummaryRow label={t('play.secretWord')} value={card.word} /><SummaryRow label={t('play.impostorWas')} value={impostor.name} /><SummaryRow label={t('play.accusedWas')} value={accused?.name ?? '-'} /><SummaryRow label={t('play.impostorInfo')} value={impostorInfo} /></Card><Card className="mx-auto mt-4 max-w-lg overflow-hidden"><p className="border-b border-white/10 p-4 text-sm font-black uppercase tracking-wider text-slate-400">{t('play.pointsAwarded')}</p>{session.participants.map((item) => { const award = session.lastRoundResult?.awards.find((entry) => entry.participantId === item.id)?.points ?? 0; return <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 last:border-0" key={item.id}><span className="font-bold">{item.name}</span><span className={cn('font-black', award ? 'text-violet-300' : 'text-slate-500')}>{award ? `+${award}` : t('play.noPoints')}</span></div> })}</Card><Button className="mx-auto mt-6 flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={async () => { const done = await continueSummary(); if (done) navigate('/games/impostor-da-palavra/result') }}>{finished ? t('play.seeResult') : t('play.nextRound')}<ArrowRight size={19} /></Button></Shell>
  }

  return <Shell title={title}><p className="text-center text-slate-400">Carregando...</p></Shell>
}

function Shell({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  const { t } = useTranslation('impostor-da-palavra')
  const navigate = useNavigate()
  return <div className="min-h-dvh pb-10"><Header backTo="/games/impostor-da-palavra" title={title} action={action ? <span className="text-sm font-black text-violet-300">{action}</span> : undefined} /><section className="px-5 py-8">{children}<Button className="mx-auto mt-8 flex max-w-lg" variant="ghost" onClick={() => navigate('/games/impostor-da-palavra')}><Home size={17} />{t('play.leave')}</Button></section></div>
}

function CenteredIcon({ icon }: { icon: React.ReactNode }) { return <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-violet-400 text-slate-950 shadow-xl shadow-violet-500/20">{icon}</div> }

function Briefing({ briefing, t }: { briefing: NonNullable<ReturnType<typeof getParticipantBriefing>>; t: (key: string) => string }) {
  if (briefing.kind === 'word') return <div><p className="text-sm font-black uppercase tracking-wider text-violet-200">{t('play.wordLabel')}</p><p className="mt-4 text-5xl font-black tracking-wide text-white">{briefing.word}</p><p className="mt-5 text-sm text-slate-300">{t('play.alternateNotice')}</p></div>
  if (briefing.kind === 'impostor-hint') return <div><p className="text-sm font-black uppercase tracking-wider text-violet-200">{t('play.impostorTitle')}</p><p className="mt-4 text-2xl font-black text-white">{t('play.hintLabel')}</p><p className="mt-3 text-3xl font-black text-violet-200">{briefing.hint}</p></div>
  return <div><p className="text-sm font-black uppercase tracking-wider text-violet-200">{t('play.impostorTitle')}</p><p className="mt-4 text-xl font-bold leading-8 text-white">{t('play.noWord')}</p></div>
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="border-b border-white/10 py-3 first:pt-0 last:border-0 last:pb-0"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-violet-200">{value}</p></div> }
