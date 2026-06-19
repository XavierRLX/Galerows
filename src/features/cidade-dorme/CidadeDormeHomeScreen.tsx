import { BookOpen, Eye, Moon, Play, RotateCcw, Shield, Users, Vote } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useCidadeDormeStore } from './cidadeDorme.store'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

export function CidadeDormeHomeScreen() {
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)
  const { session, initialized, resumeError, discard } = useCidadeDormeStore()
  useCidadeDormeInitialization()

  return <div className="min-h-dvh pb-32"><Header backTo="/" title="Cidade Dorme" /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-blue-300 text-slate-950 shadow-2xl shadow-blue-500/20"><Moon size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Dedução social</p><h1 className="mt-2 text-4xl font-black tracking-tight">Cidade Dorme</h1><p className="mt-4 leading-7 text-slate-300">Um assistente offline para o mediador sortear papéis secretos e conduzir a partida presencial.</p></div>
    <Card className="mx-auto mt-8 max-w-lg p-5"><h2 className="text-lg font-black">Objetivo</h2><p className="mt-2 text-sm leading-6 text-slate-300">A cidade tenta descobrir os assassinos. Os assassinos vencem quando dominam a votação. Papéis especiais ajudam, confundem e criam blefes.</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-blue-300"><span className="inline-flex items-center gap-2"><Users size={18} />4 a 12 jogadores</span><span>Totalmente offline</span></div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">Fluxo</h2><div className="mt-3 grid gap-3">
      <RuleStep icon={<Eye size={20} />} number="1" text="O app sorteia e revela um papel por pessoa." />
      <RuleStep icon={<Moon size={20} />} number="2" text="O mediador conduz a noite em turnos secretos." />
      <RuleStep icon={<Vote size={20} />} number="3" text="A cidade discute, vota e elimina suspeitos." />
      <RuleStep icon={<Shield size={20} />} number="4" text="O app verifica quando cidade, assassinos ou Coringa vencem." />
    </div></div>
    {resumeError ? <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{resumeError}</p> : null}
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />Descartar partida</Button> : null}<Button size="lg" variant="secondary" onClick={() => setShowRules(true)}><BookOpen size={19} />Como jogar</Button></div>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">{session ? <Button className="w-full bg-blue-300 text-slate-950 hover:bg-blue-200" size="lg" onClick={() => navigate('/games/cidade-dorme/play')}><Play size={19} />Continuar partida</Button> : <Button className="w-full bg-blue-300 text-slate-950 hover:bg-blue-200" disabled={!initialized} size="lg" onClick={() => navigate('/games/cidade-dorme/setup')}><Play size={19} />Configurar partida</Button>}</div>
    <BottomSheet open={showRules} title="Como jogar" onClose={() => setShowRules(false)}><div className="space-y-3 leading-7 text-slate-300"><p>Escolha os jogadores e configure os papéis especiais.</p><p>Passe o celular para cada pessoa ver a própria função em segredo.</p><p>Depois das revelações, o mediador guia a noite e mantém as ações secretas.</p><p>Durante o dia, registre a votação no app e avance até a condição de vitória.</p></div></BottomSheet>
  </div>
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-300 text-slate-950">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-blue-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
