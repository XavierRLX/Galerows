import { BookOpen, Eye, Moon, RotateCcw, Shield, Users, Vote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { GameEntryHero, GameModeEntry } from '../games/GameModeEntry'
import { FavoriteGameButton } from '../games/FavoriteGameButton'
import { useCidadeDormeStore } from './cidadeDorme.store'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

export function CidadeDormeHomeScreen() {
  const { t } = useTranslation('cidade-dorme')
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)
  const { session, initialized, resumeError, discard } = useCidadeDormeStore()
  useCidadeDormeInitialization()

  return <div className="game-entry-page game-entry-page--city"><Header action={<FavoriteGameButton gameId="cidade-dorme" />} backTo="/" title={t('name')} /><section className="game-entry-content">
    <GameEntryHero title={t('name')} eyebrow={t('home.eyebrow')} summary={t('home.summary')} players={t('home.players')} icon={<Moon size={36} />} />
    <GameModeEntry gameId="cidade-dorme" localReady={initialized} continuingLocal={Boolean(session)} onLocal={() => navigate(session ? (session.phase === 'gameOver' ? '/games/cidade-dorme/result' : session.phase === 'setup' ? '/games/cidade-dorme/setup' : '/games/cidade-dorme/play') : '/games/cidade-dorme/setup')} />
    <Card className="mx-auto mt-8 max-w-lg p-5"><h2 className="text-lg font-black">{t('home.objectiveTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t('home.objective')}</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-blue-300"><span className="inline-flex items-center gap-2"><Users size={18} />{t('home.players')}</span><span>{t('common.offline')}</span></div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">{t('home.flowTitle')}</h2><div className="mt-3 grid gap-3">
      <RuleStep icon={<Eye size={20} />} number="1" text={t('home.flow.reveal')} />
      <RuleStep icon={<Moon size={20} />} number="2" text={t('home.flow.night')} />
      <RuleStep icon={<Vote size={20} />} number="3" text={t('home.flow.vote')} />
      <RuleStep icon={<Shield size={20} />} number="4" text={t('home.flow.win')} />
    </div></div>
    {resumeError ? <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{t('resumeError')}</p> : null}
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />{t('home.discardGame')}</Button> : null}<Button size="lg" variant="secondary" onClick={() => setShowRules(true)}><BookOpen size={19} />{t('home.howToPlay')}</Button></div>
  </section>
    <BottomSheet open={showRules} title={t('home.howToPlay')} onClose={() => setShowRules(false)}><div className="space-y-3 leading-7 text-slate-300">{(t('home.rules', { returnObjects: true }) as string[]).map((rule) => <p key={rule}>{rule}</p>)}</div></BottomSheet>
  </div>
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-300 text-slate-950">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-blue-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
