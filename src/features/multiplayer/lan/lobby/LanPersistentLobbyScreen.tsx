import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, LoaderCircle, QrCode, Users, WifiOff } from 'lucide-react'
import { LanScreenHeader } from './LanScreenHeader'
import { LanQrScanner } from '../LanQrScanner'
import { LobbyRoomView } from './LobbyRoomView'
import { armCityAutomaticNarrator } from './cidadeAutomaticAudio'
import { LanRoomDiscoveryList } from './LanRoomDiscoveryList'
import type { LobbyGameId } from './lobbyView'
import { RoomSessionProvider } from './RoomSessionProvider'
import { useRoomSession, useRoomSessionOptional } from './RoomSessionContext'
import './lobby.css'

/**
 * G2 route is a view only. App-level RoomSessionProvider survives route changes;
 * standalone PL-03 tests can still mount this screen with an isolated provider.
 */
export function LanPersistentLobbyScreen({ initialMode = 'entry' }: { initialMode?: 'entry' | 'join' | 'create' } = {}) {
  const existing = useRoomSessionOptional()
  return existing ? <LanPersistentLobbyView initialMode={initialMode} />
    : <RoomSessionProvider><LanPersistentLobbyView initialMode={initialMode} /></RoomSessionProvider>
}

function LanPersistentLobbyView({ initialMode }: { initialMode: 'entry' | 'join' | 'create' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useRoomSession()
  const {
    mode: sessionMode, preferHotspot, setPreferHotspot, role,
    roomId, playerId, snapshot, qr, roomCode,
    scannerOpen, setScannerOpen, status, error, setError, busy, connected,
    startHost, joinScannedInvite, joinDiscoveredRoom, resumeGuest, action, leave, closeRoom, refreshInvite,
  } = session
  const creationRequested = useRef(false)
  const requestedGame = useRef<LobbyGameId | null>(null)
  const mode = sessionMode === 'active' ? 'active' : initialMode
  useEffect(() => {
    if (initialMode === 'create' && sessionMode !== 'active' && !creationRequested.current) {
      creationRequested.current = true
      const game = new URLSearchParams(location.search).get('game')
      // Only real supported games may be preselected; never override an existing Room.
      requestedGame.current = game === 'cidade-dorme' || game === 'impostor-da-palavra' || game === 'pista-unica'
        ? game : null
      void startHost()
    }
  }, [initialMode, sessionMode, startHost, location.search])
  useEffect(() => {
    if (!requestedGame.current || sessionMode !== 'active' || role !== 'host'
      || !connected || !snapshot) return
    if (snapshot.roomState.selectedGameId) { requestedGame.current = null; return }
    if (snapshot.roomState.phase !== 'lobby') return
    const gameId = requestedGame.current
    requestedGame.current = null
    void action('SELECT_GAME', { gameId })
  }, [sessionMode, role, connected, snapshot, action])
  useEffect(() => () => setScannerOpen(false), [setScannerOpen])

  const intro = mode !== 'active' || !snapshot
  if (!intro && roomId && playerId) {
    return <LobbyRoomView
      snapshot={snapshot} role={role} playerId={playerId}
      status={status} error={error} busy={busy} connected={connected}
      roomCode={role === 'host' ? roomCode : undefined}
      inviteQr={role === 'host' ? qr : undefined}
      onBack={() => navigate('/players')}
      onBrowseGames={() => navigate('/')}
      onSelect={(game: LobbyGameId) => action('SELECT_GAME', { gameId: game })}
      onConfigure={config => action('CONFIGURE_GAME', config)}
      onReady={ready => action('READY', { ready })}
      onStart={() => {
        if(snapshot.roomState.selectedGameId==='cidade-dorme'
          && (snapshot.roomState.selectedConfig as {conductionMode?:string}|null)?.conductionMode==='automatic') {
          armCityAutomaticNarrator()
        }
        action('START_GAME',null)
      }}
      onGameAction={() => action(snapshot.roomState.selectedGameId === 'counter' ? 'INCREMENT' : 'TOY_CLUE', null, 'game')}
      onGameCommand={(type, payload) => action(type, payload, 'game')}
      onRoomCommand={(type, payload) => action(type, payload)}
      onEnd={() => action('END_GAME', null)}
      onBackToLobby={() => action('RETURN_TO_LOBBY', null)}
      onFinishSession={() => action('FINISH_SESSION', null)}
      onReconnect={resumeGuest}
      onLeave={leave}
      onClose={closeRoom}
      onRefreshInvite={refreshInvite}
      onRename={session.saveDisplayName}
      onReplay={() => action('REPLAY_GAME', null)}
    />
  }

  return <main className="pl03 pl03-entry" data-testid="pl03-entry">
    <LanScreenHeader title={mode === 'join' ? 'Entrar em sala' : mode === 'create' ? 'Criar sala' : 'Rede local'}
      onBack={() => navigate('/players')} />
    <div className="pl03-entry-inner">
      {mode === 'join' ? <>
        <LanRoomDiscoveryList disabled={busy} onJoinRoom={joinDiscoveredRoom}
          onRequestQr={() => { setError(''); setScannerOpen(true) }} />
        {busy && <p className="pl03-connection-progress" role="status"><LoaderCircle size={18} className="pl03-spin" /> Conectando à sala…</p>}
      </> : mode === 'create' ? <section className="pl03-creating" aria-label="Criação da sala">
        <div className="pl03-create-glyph"><Users size={32} aria-hidden="true" /></div>
        <h2>{busy ? 'Preparando sua sala' : 'Criar sala'}</h2>
        <p role="status">{busy ? 'Conectando à rede local…' : error ? 'Confira a rede e tente novamente.' : 'Reúna os amigos na mesma rede.'}</p>
        {busy && <LoaderCircle className="pl03-spin" aria-hidden="true" />}
        {!busy && <button type="button" className="pl03-primary-btn" onClick={startHost}>{error ? 'Tentar novamente' : 'Criar sala'} <ArrowRight size={18} /></button>}
      </section> : <div className="pl03-entry-actions">
        <button type="button" className="pl03-primary-btn" onClick={startHost} disabled={busy}>
          <Users size={20} aria-hidden="true" /> Criar sala <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="pl03-secondary-btn" onClick={() => navigate('/__lan-lobby-v2/entrar')} disabled={busy}>
          <QrCode size={20} aria-hidden="true" /> Entrar em sala
        </button>
      </div>}
      {error && <p className="pl03-error" role="alert"><WifiOff size={17} aria-hidden="true" /> {error}</p>}
      {mode !== 'join' && <details className="pl03-network-options">
        <summary>Opções de rede</summary>
        <label className="pl03-network-choice">
          <input type="checkbox" checked={preferHotspot} disabled={busy} onChange={event => setPreferHotspot(event.target.checked)} />
          <span><strong>Usar hotspot deste celular</strong><small>Ative se os amigos estiverem conectados ao seu hotspot.</small></span>
        </label>
      </details>}
    </div>
    {scannerOpen && <LanQrScanner onClose={() => setScannerOpen(false)}
      onScan={value => { setScannerOpen(false); joinScannedInvite(value) }} />}
  </main>
}
