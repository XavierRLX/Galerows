import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw, Search, QrCode, Wifi, WifiOff } from 'lucide-react'
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
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState(false)
  const [settled, setSettled] = useState(false)
  const [retry, setRetry] = useState(0)
  const matching = code.length === 6 ? rooms.filter(room => room.code === code) : rooms

  useEffect(() => {
    let alive = true
    let listener: { remove: () => Promise<void> } | null = null
    let timeout = window.setTimeout(() => { if (alive) setSettled(true) }, 4000)
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
          id: event.id, label: event.label && event.label !== event.id ? event.label : `Sala ${(event.roomId ?? '').slice(-6).toUpperCase()}`, roomId: event.roomId ?? '',
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
        setError(false)
        setSettled(false)
        window.clearTimeout(timeout)
        timeout = window.setTimeout(() => { if (alive) setSettled(true) }, 4000)
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

  return <section className="pl03-discovery" aria-labelledby="pl03-discovery-title">
    <div className="pl03-discovery-heading">
      <h2 id="pl03-discovery-title">Salas disponíveis</h2>
      <span className="pl03-count"><Wifi size={15} aria-hidden="true" /> Rede local</span>
    </div>
    <p className="pl03-discovery-explainer">Conecte os celulares ao mesmo Wi-Fi ou hotspot.</p>
    {rooms.length > 0 && <ul className="pl03-discovery-rooms" aria-label="Salas encontradas">
      {rooms.map(room => <li key={room.id}>
        <div><span className="pl03-room-icon"><Wifi size={21} aria-hidden="true" /></span><span>
          <strong>{room.label}</strong><small>Sala disponível · {room.code}</small>
        </span></div>
        <button type="button" className="pl03-secondary-btn"
          aria-label={`Entrar em ${room.label}`} onClick={() => onJoinRoom(room)} disabled={disabled}>
          Entrar <ArrowRight size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
    {error ? <p className="pl03-discovery-feedback" role="status">
      <WifiOff size={24} aria-hidden="true" /> Busca indisponível nesta rede. Leia o QR Code do anfitrião.
    </p> : rooms.length === 0 && <p className="pl03-discovery-feedback" role="status">
      <Search size={24} aria-hidden="true" />
      {settled ? 'Nenhuma sala encontrada. Crie uma no celular do anfitrião ou leia o QR Code.'
        : 'Buscando salas na rede local…'}
    </p>}
    <button type="button" className="pl03-quiet-btn pl03-refresh"
      onClick={() => { setRooms([]); setError(false); setSettled(false); setRetry(value => value + 1) }}
      disabled={disabled}><RefreshCw size={17} aria-hidden="true" /> Buscar novamente</button>

    <div className="pl03-join-alternatives">
      <button type="button" className="pl03-secondary-btn" onClick={onRequestQr} disabled={disabled}>
        <QrCode size={20} aria-hidden="true" /> Ler QR Code
      </button>
      <button type="button" className="pl03-quiet-btn" aria-expanded={showCode} aria-controls="pl03-code-alternative"
        onClick={() => { setShowCode(value => !value); setCode('') }} disabled={disabled}>
        {showCode ? 'Ocultar código' : 'Não encontrou a sala? Usar código'}
      </button>
      {showCode && <div id="pl03-code-alternative" className="pl03-code-alternative">
        <label className="pl03-short-code-label" htmlFor="pl03-room-short-code">Código de 6 dígitos</label>
        <input id="pl03-room-short-code" type="text" value={code} onChange={event => setCode(normalizeRoomCode(event.target.value))}
          placeholder="000000" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" disabled={disabled}
          aria-describedby="pl03-short-code-help" className="pl03-short-code-input" autoFocus />
        <p id="pl03-short-code-help" className="pl03-discovery-explainer" role="status">
          {code.length > 0 && code.length < 6 ? 'Digite os 6 dígitos.'
            : code.length === 6 && matching.length === 0 ? 'Esse código não apareceu na busca. Leia o QR Code do anfitrião para entrar.'
              : code.length === 6 && matching.length > 1 ? 'Há mais de uma sala com esse código. Escolha pelo nome na lista acima.'
                : 'Use o código de uma sala encontrada nesta rede.'}
        </p>
        {code.length === 6 && matching.length === 1 && <button type="button" className="pl03-primary-btn"
          onClick={() => onJoinRoom(matching[0])} disabled={disabled}>Entrar com código <ArrowRight size={17} aria-hidden="true" /></button>}
      </div>}
      <p className="pl03-discovery-security">As salas são visíveis para quem usa esta rede. Prefira o QR do anfitrião em redes compartilhadas.</p>
    </div>
  </section>
}
