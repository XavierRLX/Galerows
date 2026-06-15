import { Check, FastForward, RotateCcw, UserRoundSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { useQuemSouEuStore } from './quemSouEu.store'
import type { QuemSouEuSession } from './quemSouEu.types'
import { useQuemSouEuInitialization } from './useQuemSouEuInitialization'

export function QuemSouEuPlayScreen() {
  const { t } = useTranslation('quem-sou-eu')
  const navigate = useNavigate()
  const { session, initialized, revealCurrent, markCorrect, skip } = useQuemSouEuStore()
  useQuemSouEuInitialization()

  useEffect(() => {
    if (initialized && !session) navigate('/games/quem-sou-eu', { replace: true })
    if (session?.phase === 'summary') navigate('/games/quem-sou-eu/result', { replace: true })
  }, [initialized, navigate, session])

  if (!session) return <div className="p-6 text-slate-400">{t('loading')}</div>
  const currentWord = session.words[session.currentIndex]
  const progress = t('play.progress', { current: session.currentIndex + 1, total: session.words.length })

  if (session.phase === 'countdown') {
    return <CountdownScreen key={session.currentIndex} onExit={() => navigate('/games/quem-sou-eu')} onReveal={revealCurrent} progress={progress} session={session} />
  }

  return <div className="flex min-h-dvh flex-col bg-sky-600 text-white"><div className="flex items-center justify-between px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-slate-950/25 px-4 py-2 text-sm font-black"><UserRoundSearch size={18} />{progress}</span><Button className="rounded-full bg-slate-950/25 text-white hover:bg-slate-950/35" variant="ghost" onClick={() => navigate('/games/quem-sou-eu')}><RotateCcw size={18} />{t('play.exit')}</Button></div>
    <section className="flex flex-1 flex-col items-center justify-center px-5 text-center"><p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-100">{t('play.wordLabel')}</p><h1 className="mt-6 max-w-full break-words text-6xl font-black leading-none tracking-tight sm:text-7xl">{currentWord.text}</h1><p className="mt-7 max-w-sm text-base font-bold leading-7 text-sky-50">{t('play.revealedHint')}</p></section>
    <div className="grid gap-3 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"><Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" size="lg" onClick={async () => { await markCorrect(); await AppHaptics.light() }}><Check size={20} />{t('play.correct')}</Button><Button className="bg-amber-300 text-slate-950 hover:bg-amber-200" size="lg" onClick={async () => { await skip(); await AppHaptics.light() }}><FastForward size={20} />{t('play.skip')}</Button></div>
  </div>
}

function CountdownScreen({ onExit, onReveal, progress, session }: { onExit: () => void; onReveal: () => Promise<void>; progress: string; session: QuemSouEuSession }) {
  const { t } = useTranslation('quem-sou-eu')
  const [remaining, setRemaining] = useState<number>(session.countdownSeconds)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((current) => {
        const next = current - 1
        if (next <= 0) {
          window.clearInterval(id)
          void onReveal()
          return 0
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [onReveal])

  return <div className="flex min-h-dvh flex-col bg-sky-950 text-white"><div className="flex items-center justify-between px-5 py-5"><Button className="rounded-full bg-white/10 text-white hover:bg-white/15" variant="ghost" onClick={onExit}><RotateCcw size={18} />{t('play.exit')}</Button><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{progress}</span></div>
    <section className="flex flex-1 flex-col items-center justify-center px-5 text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-200">{t('play.getReady')}</p><div className="mt-8 flex size-44 items-center justify-center rounded-full border-8 border-cyan-200 bg-sky-500 text-7xl font-black shadow-2xl shadow-sky-500/30">{remaining}</div><p className="mt-8 max-w-sm text-lg font-bold leading-7 text-sky-100">{t('play.countdownHint')}</p></section>
  </div>
}
