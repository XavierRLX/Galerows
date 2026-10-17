import { ArrowRight, Check, Smartphone, Users, Wifi } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { lanNativeMvpAvailable } from '../multiplayer/lan/lanPlatform'
import { useRoomSessionOptional } from '../multiplayer/lan/lobby/RoomSessionContext'
import './game-mode-entry.css'

const copy = {
  'pt-BR': {
    title: 'Como vocês vão jogar?', single: '1 celular', singleHint: 'Uma tela para a galera',
    multi: 'Multiplayer local', multiHint: 'Cada um no seu celular',
    localDescription: 'Um celular guia a partida com a galera reunida. Sem sala, conexão ou cadastro de todo mundo.',
    group: 'Minha Galera salva os nomes para jogar neste celular.',
    start: 'Configurar partida · 1 celular', resume: 'Continuar partida · 1 celular',
    multiDescription: 'Todo mundo junto, na mesma rede Wi-Fi. O anfitrião configura as regras uma vez na sala.',
    create: 'Criar sala', join: 'Entrar em sala', back: 'Voltar à sala', active: 'Sua sala continua ativa. Volte para jogar com a galera.',
    unavailable: 'Disponível no Android com multiplayer LAN habilitado. Na web e no iOS, joguem com 1 celular.',
  },
  'en-US': {
    title: 'How will you play?', single: '1 phone', singleHint: 'One screen for the group',
    multi: 'Local multiplayer', multiHint: 'Everyone on their own phone',
    localDescription: 'One phone guides the game with everyone together. No room, connection or accounts for everyone needed.',
    group: 'My Group saves names for games on this phone.', start: 'Set up game · 1 phone', resume: 'Continue game · 1 phone',
    multiDescription: 'Together on the same Wi-Fi network. The host sets the rules once in the room.',
    create: 'Create room', join: 'Join room', back: 'Back to room', active: 'Your room is still active. Return to play with your group.',
    unavailable: 'Available on Android with LAN multiplayer enabled. On the web and iOS, play with 1 phone.',
  },
  'es-419': {
    title: '¿Cómo van a jugar?', single: '1 celular', singleHint: 'Una pantalla para el grupo',
    multi: 'Multijugador local', multiHint: 'Cada quien en su celular',
    localDescription: 'Un celular guía la partida con el grupo reunido. Sin sala, conexión ni registro de todo el grupo.',
    group: 'Mi Grupo guarda los nombres para jugar en este celular.', start: 'Configurar partida · 1 celular', resume: 'Continuar partida · 1 celular',
    multiDescription: 'Juntos en la misma red Wi-Fi. El anfitrión configura las reglas una vez en la sala.',
    create: 'Crear sala', join: 'Entrar a una sala', back: 'Volver a la sala', active: 'Tu sala sigue activa. Vuelve para jugar con tu grupo.',
    unavailable: 'Disponible en Android con multijugador LAN habilitado. En la web y en iOS, jueguen con 1 celular.',
  },
} as const

type Props = {
  gameId: 'cidade-dorme' | 'impostor-da-palavra' | 'pista-unica'
  localReady: boolean
  continuingLocal: boolean
  onLocal: () => void
}

/** The choice changes only entry UI; local saves and Room lifecycle retain their owners. */
export function GameModeEntry({ gameId, localReady, continuingLocal, onLocal }: Props) {
  const [mode, setMode] = useState<'local' | 'lan' | null>(null)
  const id = useId()
  const { i18n } = useTranslation()
  const text = copy[i18n.resolvedLanguage as keyof typeof copy] ?? copy['pt-BR']
  const room = useRoomSessionOptional()
  const navigate = useNavigate()
  const lanAvailable = import.meta.env.VITE_GAMES_FIRST_LAN_ENTRY === '1'
    && import.meta.env.VITE_LAN_PERSISTENT_LOBBY_UI === '1' && lanNativeMvpAvailable()

  return <section className="game-mode-entry" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{text.title}</h2>
    <div className="game-mode-entry__choices">
      <button type="button" className="game-mode-entry__choice" aria-pressed={mode === 'local'} aria-controls={`${id}-panel`} onClick={() => setMode('local')}>
        <Smartphone aria-hidden="true" size={23} /><span><strong>{text.single}</strong><small>{text.singleHint}</small></span>
        {mode === 'local' && <Check className="game-mode-entry__check" aria-hidden="true" size={19} />}
      </button>
      <button type="button" className="game-mode-entry__choice" aria-pressed={mode === 'lan'} aria-controls={`${id}-panel`} onClick={() => setMode('lan')}>
        <Wifi aria-hidden="true" size={23} /><span><strong>{text.multi}</strong><small>{text.multiHint}</small></span>
        {mode === 'lan' && <Check className="game-mode-entry__check" aria-hidden="true" size={19} />}
      </button>
    </div>
    <div id={`${id}-panel`} className={mode ? 'game-mode-entry__panel' : undefined}>
      {mode === 'local' && <>
        <p>{text.localDescription}</p>
        <Button className="game-mode-entry__primary" disabled={!localReady} size="lg" onClick={onLocal}>{continuingLocal ? text.resume : text.start}<ArrowRight aria-hidden="true" size={19} /></Button>
        <p className="game-mode-entry__note">{text.group}</p>
      </>}
      {mode === 'lan' && (!lanAvailable ? <p role="status">{text.unavailable}</p> : room?.mode === 'active' ? <>
        <p>{text.active}</p>
        <Button className="game-mode-entry__primary" size="lg" onClick={() => navigate('/__lan-lobby-v2')}>{text.back}<ArrowRight aria-hidden="true" size={19} /></Button>
      </> : <>
        <p>{text.multiDescription}</p>
        <div className="game-mode-entry__actions">
          <Button className="game-mode-entry__primary" size="lg" onClick={() => navigate(`/__lan-lobby-v2/criar?game=${gameId}`)}>{text.create}</Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/__lan-lobby-v2/entrar')}>{text.join}</Button>
        </div>
      </>)}
    </div>
  </section>
}

export function GameEntryHero({ title, eyebrow, summary, players, icon }: {
  title: string; eyebrow: string; summary: string; players: string; icon: ReactNode
}) {
  return <div className="game-entry-hero">
    <div className="game-entry-hero__identity"><div className="game-entry-hero__art" aria-hidden="true">{icon}</div><div><p className="game-entry-hero__eyebrow">{eyebrow}</p><h1>{title}</h1></div></div>
    <p className="game-entry-hero__summary">{summary}</p>
    <p className="game-entry-hero__players"><Users size={16} aria-hidden="true" />{players}</p>
  </div>
}
