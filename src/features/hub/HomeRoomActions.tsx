import { ArrowRight, DoorOpen, Users, Wifi } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRoomSessionOptional } from '../multiplayer/lan/lobby/RoomSessionContext'

/** G5D: only mounted under Minha Galera on experimental native builds. */
export function HomeRoomActions() {
  const navigate = useNavigate()
  const session = useRoomSessionOptional()
  const hasRoom = session?.mode === 'active' && session.roomId && session.playerId

  if (hasRoom) {
    return <section aria-label="Sala LAN ativa" className="mt-5 rounded-2xl bg-[#1b1129] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-lime-300">
        <Wifi aria-hidden="true" size={18} /> Sala em andamento
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

  return <section aria-labelledby="galera-lan-title" className="mt-5 rounded-2xl bg-[linear-gradient(115deg,#261b38,#14132a)] p-4">
    <div className="flex items-center gap-2">
      <Wifi aria-hidden="true" className="text-lime-300" size={18} />
      <h2 id="galera-lan-title" className="text-base font-black">Jogar em rede local</h2>
    </div>
    <p className="mt-1 text-sm text-slate-300">Cada pessoa no seu celular. Todos no mesmo Wi-Fi.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-300/40 bg-violet-300/10 px-3 text-sm font-bold text-white hover:bg-violet-300/20"
        type="button" onClick={() => navigate('/__lan-lobby-v2/entrar')}>
        <DoorOpen aria-hidden="true" size={18} /> Entrar em sala
      </button>
      <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 text-sm font-black text-slate-950 hover:bg-lime-200"
        type="button" onClick={() => navigate('/__lan-lobby-v2/criar')}>
        <Users aria-hidden="true" size={18} /> Criar sala <ArrowRight aria-hidden="true" size={16} />
      </button>
    </div>
    {session && <details className="mt-2 text-xs text-slate-300">
      <summary className="flex min-h-11 cursor-pointer items-center text-[#B8A0FF]">Opções de rede</summary>
      <label className="flex min-h-12 items-center gap-3 pb-2">
        <input type="checkbox" className="size-5 shrink-0 accent-[#D2F86A]" checked={session.preferHotspot}
          disabled={session.busy} onChange={event => session.setPreferHotspot(event.target.checked)} />
        Usar hotspot deste celular
      </label>
    </details>}
  </section>
}
