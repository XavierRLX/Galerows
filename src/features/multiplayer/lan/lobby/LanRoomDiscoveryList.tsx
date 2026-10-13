import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw, Search, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import { lanRoomDiscovery } from '../lanRoomDiscovery'
import type { DiscoveredLanRoom, RoomDiscoveryEvent } from '../lanRoomDiscovery'
import { isValidDiscoveredRoom, normalizeRoomCode } from '../lanShortRoomCode'

const MAX_VISIBLE = 24

/**
 * G4-lite: local code is a convenience identifier, not a security boundary.
 * Published NSD fingerprint is unverified at first contact (QR remains stronger).
 */
export function LanRoomDiscoveryList({
  onRequestQr, onJoinRoom, disabled = false,
}: { onRequestQr: () => void; onJoinRoom: (room: DiscoveredLanRoom) => void; disabled?: boolean }) {
  const [rooms, setRooms] = useState<DiscoveredLanRoom[]>([])
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [settled, setSettled] = useState(false)
  const [retry, setRetry] = useState(0)
  const matching = code.length === 6 ? rooms.filter(room => room.code === code) : rooms

  useEffect(() => {
    let alive = true
    let listener: { remove: () => Promise<void> } | null = null
    const timeout = window.setTimeout(() => { if (alive) setSettled(true) }, 4000)
    const onEvent = (event: RoomDiscoveryEvent) => {
      if (!alive) return
      if (event.type === 'error') { setError(true); setSettled(true); return }
      if (!event.id || !/^Galerows-[A-Za-z0-9]{4,16}$/.test(event.id)) return
      if (event.type === 'lost') {
        setRooms(current => current.filter(room => room.id !== event.id))
        return
      }
      if (event.type === 'found') {
        const record: DiscoveredLanRoom = {
          id: event.id, label: event.label ?? event.id, roomId: event.roomId ?? '',
          code: event.code ?? '', hostIp: event.hostIp ?? '',
          port: event.port ?? 0, fingerprint: event.fingerprint ?? '',
        }
        if (!isValidDiscoveredRoom(record)) return
        setRooms(current => current.some(room => room.id === record.id)
          ? current.map(room => room.id === record.id ? record : room)
          : current.length >= MAX_VISIBLE ? current : [...current, record])
        setSettled(true)
      }
    }

    void (async () => {
      try {
        listener = await lanRoomDiscovery.subscribe(onEvent)
        if (!alive) { await listener.remove(); return }
        if (document.visibilityState !== 'visible') return
        await lanRoomDiscovery.start()
        if (!alive || document.visibilityState !== 'visible') await lanRoomDiscovery.stop()
      } catch {
        if (alive) { setError(true); setSettled(true) }
      }
    })()
    const onVisibilityChange = () => {
      if (!alive) return
      if (document.visibilityState === 'hidden') {
        void lanRoomDiscovery.stop().catch(() => undefined)
      } else {
        setRooms([])
        setSettled(false)
        void lanRoomDiscovery.start().catch(() => {
          if (alive) { setError(true); setSettled(true) }
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(timeout)
      void listener?.remove()
      void lanRoomDiscovery.stop().catch(() => undefined)
    }
  }, [retry])

  return <section className="pl03-panel pl03-discovery" aria-labelledby="pl03-discovery-title">
    <div className="pl03-discovery-heading">
      <div>
        <p className="pl03-eyebrow">MESMA REDE LOCAL</p>
        <h3 id="pl03-discovery-title"><Search size={18} aria-hidden="true" /> Entrar com código</h3>
      </div>
      <button type="button" className="pl03-quiet-btn"
        onClick={() => { setRooms([]); setError(false); setSettled(false); setRetry(value => value + 1) }}
        aria-label="Buscar salas novamente" disabled={disabled}>
        <RefreshCw size={16} aria-hidden="true" /> Atualizar
      </button>
    </div>
    <label className="pl03-short-code-label" htmlFor="pl03-room-short-code">Código de 6 dígitos</label>
    <input id="pl03-room-short-code" type="text" value={code} onChange={event => setCode(normalizeRoomCode(event.target.value))}
      placeholder="000000" inputMode="numeric" autoComplete="off" maxLength={6} disabled={disabled}
      aria-describedby="pl03-short-code-help" className="pl03-short-code-input" />
    <p id="pl03-short-code-help" className="pl03-discovery-explainer">
      Peça os seis números para quem criou a sala. Também é possível escolher uma sala abaixo.
    </p>

    {error ? <p className="pl03-discovery-feedback" role="status">
      <WifiOff size={17} aria-hidden="true" /> Busca indisponível nesta rede. Use o QR do anfitrião.
    </p> : matching.length ? <ul className="pl03-discovery-rooms" aria-label="Salas encontradas">
      {matching.map(room => <li key={room.id}>
        <div><Wifi size={18} aria-hidden="true" /><span>
          <strong>{room.label}</strong><small>Rede local · Código {room.code}</small>
        </span></div>
        <button type="button" className="pl03-secondary-btn"
          aria-label={`Entrar em ${room.label}`} onClick={() => onJoinRoom(room)} disabled={disabled}>
          Entrar <ArrowRight size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ul> : <p className="pl03-discovery-feedback" role="status">
      <Search size={17} aria-hidden="true" />
      {code.length === 6 ? 'Não encontramos esse código nesta rede. Atualize ou peça o QR.'
        : settled ? 'Nenhuma sala encontrada. Você ainda pode entrar por QR.'
          : 'Buscando salas na rede local...'}
    </p>}
    {code.length === 6 && matching.length === 1 && <button type="button" className="pl03-primary-btn"
      onClick={() => onJoinRoom(matching[0])} disabled={disabled}>Entrar na sala <ArrowRight size={17} /></button>}
    {code.length === 6 && matching.length > 1 && <p className="pl03-discovery-explainer">
      Há mais de uma sala com esse código. Escolha a sala correta acima.
    </p>}
    <p className="pl03-discovery-security"><ShieldAlert size={15} aria-hidden="true" />
      Entrada rápida para amigos na mesma rede. Quem já estiver nesse Wi-Fi também pode ver as salas; QR é a alternativa mais segura.
    </p>
    <button type="button" className="pl03-quiet-btn" onClick={onRequestQr} disabled={disabled}>
      Não encontrou? Ler QR do anfitrião
    </button>
  </section>
}
