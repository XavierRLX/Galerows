import { BookOpen, EyeOff, ListOrdered, Play, RotateCcw, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useTop10Store } from './top10.store'
import { useTop10Initialization } from './useTop10Initialization'

export function Top10HomeScreen() {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)
  const { deck, session, initialized, resumeError, discard } = useTop10Store()
  useTop10Initialization()
  return <div className="min-h-dvh pb-32"><Header backTo="/" title="Top 10" /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-[#7f1d1d] text-white shadow-2xl shadow-red-950/30"><ListOrdered size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-red-300">listas secretas</p><h1 className="mt-2 text-4xl font-black tracking-tight">Top 10</h1><p className="mt-4 leading-7 text-slate-300">Descubra as respostas de um ranking oculto. Quanto mais alta a posição, mais pontos vale.</p></div>
    <Card className="mx-auto mt-8 max-w-lg border-red-900/60 bg-red-950/25 p-5"><h2 className="text-lg font-black">Objetivo</h2><p className="mt-2 text-sm leading-6 text-slate-300">O mediador mostra o tema e marca quem acertou cada item da lista. O primeiro lugar vale 10 pontos e o décimo vale 1.</p><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-red-300"><span className="inline-flex items-center gap-2"><Users size={18} />2+ jogadores · offline</span>{deck ? <span>{deck.cards.length} cartas</span> : null}</div></Card>
    <div className="mx-auto mt-5 max-w-lg"><h2 className="text-xl font-black">Fluxo</h2><div className="mt-3 grid gap-3">
      <RuleStep icon={<EyeOff size={20} />} number="1" text="As 10 respostas começam escondidas, com posição e pontos visíveis." />
      <RuleStep icon={<Users size={20} />} number="2" text="Quando alguém acertar, o mediador escolhe o jogador ou equipe e revela a resposta." />
      <RuleStep icon={<Trophy size={20} />} number="3" text="Depois da quantidade de cartas escolhida, vence quem somar mais pontos." />
    </div></div>
    <Card className="mx-auto mt-5 max-w-lg border-red-900/50 bg-red-950/20 p-5 text-sm leading-6 text-red-100"><strong>Dica:</strong> deixe uma pessoa controlando o celular como mediadora para a lista continuar surpresa para a galera.</Card>
    {resumeError ? <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{resumeError}</p> : null}
    <div className="mx-auto mt-6 grid max-w-lg gap-3">{session ? <Button size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />Descartar partida</Button> : null}<Button size="lg" variant="secondary" onClick={() => setRulesOpen(true)}><BookOpen size={19} />Como jogar</Button></div>
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">
      {session ? <Button className="w-full bg-[#991b1b] text-white hover:bg-[#b91c1c]" size="lg" onClick={() => navigate(session.phase === 'finished' ? '/games/top-10/result' : '/games/top-10/play')}><Play size={19} />Continuar partida</Button> : <Button className="w-full bg-[#991b1b] text-white hover:bg-[#b91c1c]" disabled={!initialized} size="lg" onClick={() => navigate('/games/top-10/setup')}><Play size={19} />Configurar partida</Button>}
    </div>
    <BottomSheet open={rulesOpen} title="Como jogar Top 10" onClose={() => setRulesOpen(false)}><div className="space-y-3 leading-7 text-slate-300"><p>Escolha modo individual ou equipes e a quantidade de cartas.</p><p>Em cada carta, o mediador revela apenas os itens acertados ou abre uma resposta sem pontuar.</p><p>A pontuação é automática: posição 1 vale 10, posição 10 vale 1.</p></div></BottomSheet>
  </div>
}

function RuleStep({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) {
  return <Card className="flex items-start gap-3 p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#7f1d1d] text-white">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-red-300">#{number}</p><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></Card>
}
