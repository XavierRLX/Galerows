import { ArrowLeft } from 'lucide-react'

export function LanScreenHeader({ title, onBack, room }: { title: string; onBack: () => void;
  room?: { code: string; connected: boolean } }) {
  return <header className="pl03-header">
    <button type="button" className="pl03-back" aria-label="Voltar para Minha Galera" onClick={onBack}>
      <ArrowLeft size={23} aria-hidden="true" />
    </button>
    <h1>{title}</h1>
    {room && <div className="pl03-header-room" role="status" aria-live="polite">
      <span className={`pl03-connection-light ${room.connected ? 'is-connected' : 'is-disconnected'}`} aria-hidden="true" />
      <div><strong>Sala {room.code}</strong>
        <small>{room.connected ? 'Conectado' : 'Sem conexão'}</small></div>
    </div>}
  </header>
}
