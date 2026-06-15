import { List, Play, QrCode, RotateCcw, Shuffle, SquarePen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAdedonhaStore } from './adedonha.store'
import { useAdedonhaInitialization } from './useAdedonhaInitialization'

export function AdedonhaHomeScreen() {
  const navigate = useNavigate()
  const { session, initialized, discard } = useAdedonhaStore()
  useAdedonhaInitialization()

  return <div className="min-h-dvh pb-32"><Header backTo="/" title="Adedonha" /><section className="px-5 pt-8">
    <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-yellow-400 text-slate-950 shadow-2xl shadow-yellow-500/20"><List size={44} /></div>
    <div className="mx-auto mt-7 max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-yellow-200">Categorias, letras e respostas</p><h1 className="mt-2 text-4xl font-black tracking-tight">Adedonha</h1><p className="mt-4 leading-7 text-slate-300">Crie os temas, compartilhe com a galera e cada jogador preenche as próprias respostas no celular.</p></div>
    <Card className="mx-auto mt-8 max-w-lg border-yellow-300/30 bg-yellow-400/10 p-5"><h2 className="text-lg font-black">Como jogar</h2><div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
      <Rule icon={<SquarePen size={18} />} text="Escolham ou criem os temas da rodada." />
      <Rule icon={<QrCode size={18} />} text="Compartilhem os temas por QR Code ou código." />
      <Rule icon={<Shuffle size={18} />} text="Sorteiem uma letra e cada jogador escreve no próprio celular." />
    </div></Card>
    <Card className="mx-auto mt-5 max-w-lg border-yellow-300/30 bg-yellow-400/10 p-5 text-sm leading-6 text-yellow-50"><strong>Dica:</strong> misture categorias clássicas com temas tortos tipo “Minha sogra é...” e “Desculpa esfarrapada”. A rodada fica bem mais viva.</Card>
    {session ? <Button className="mx-auto mt-6 flex w-full max-w-lg" size="lg" variant="danger" onClick={() => void discard()}><RotateCcw size={19} />Descartar rodada</Button> : null}
  </section>
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-white/10 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-xl">
      {session ? <Button className="w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300" size="lg" onClick={() => navigate('/games/adedonha/play')}><Play size={19} />Continuar</Button> : <Button className="w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300" disabled={!initialized} size="lg" onClick={() => navigate('/games/adedonha/setup')}><Play size={19} />Criar temas</Button>}
    </div>
  </div>
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-slate-950">{icon}</span><span>{text}</span></div>
}
