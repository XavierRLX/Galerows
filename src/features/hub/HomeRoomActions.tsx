import { ArrowRight, DoorOpen, Users, Wifi } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRoomSessionOptional } from '../multiplayer/lan/lobby/RoomSessionContext'

/** G5D: only mounted under Minha Galera on experimental native builds. */
export function HomeRoomActions() {
  const navigate = useNavigate()
  const session = useRoomSessionOptional()
  const hasRoom = session?.mode === 'active' && session.roomId && session.playerId

  if (hasRoom) {
    return <section aria-label="Sala LAN ativa" className="mt-5 rounded-2xl border border-lime-300/35 bg-lime-300/[0.07] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-lime-300">
        <Wifi aria-hidden="true" size={18} /> Sala LAN em andamento
      </div>
      <p className="mt-1 text-sm text-slate-300">
        {session.connected ? 'Sua sala continua conectada.' : 'Conexão interrompida. Volte à sala para reconectar.'}
      </p>
      <button type="button" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-lime-200"
        onClick={() => navigate('/__lan-lobby-v2')}>
        Voltar à sala <ArrowRight aria-hidden="true" size={17} />
      </button>
    </section>
  }

  return <section aria-labelledby="galera-lan-title" className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-4">
    <div className="flex items-center gap-2">
      <Wifi aria-hidden="true" className="text-lime-300" size={18} />
      <h2 id="galera-lan-title" className="text-base font-black">Jogar em rede local</h2>
    </div>
    <p className="mt-1 text-sm text-slate-300">Cada pessoa no seu celular, usando a mesma rede Wi-Fi ou hotspot.</p>
    <div className="mt-3 grid gap-2 min-[360px]:grid-cols-2">
      <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-300/40 bg-violet-300/10 px-3 text-sm font-bold text-white hover:bg-violet-300/20"
        type="button" onClick={() => navigate('/__lan-lobby-v2/entrar')}>
        <DoorOpen aria-hidden="true" size={18} /> Entrar em sala
      </button>
      <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 text-sm font-black text-slate-950 hover:bg-lime-200"
        type="button" onClick={() => navigate('/__lan-lobby-v2/criar')}>
        <Users aria-hidden="true" size={18} /> Criar sala <ArrowRight aria-hidden="true" size={16} />
      </button>
    </div>
  </section>
}
