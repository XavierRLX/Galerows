import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { ArrowLeft, ArrowRight, CheckCircle2, Link2, QrCode, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react'
import { LanQrScanner } from '../LanQrScanner'
import { LobbyRoomView } from './LobbyRoomView'
import { LanRoomDiscoveryList } from './LanRoomDiscoveryList'
import type { LobbyGameId } from './lobbyView'
import { RoomSessionProvider } from './RoomSessionProvider'
import { useRoomSession, useRoomSessionOptional } from './RoomSessionContext'
import './lobby.css'

/**
 * G2 route is a view only. App-level RoomSessionProvider survives route changes;
 * standalone PL-03 tests can still mount this screen with an isolated provider.
 */
export function LanPersistentLobbyScreen({ initialMode = 'entry' }: { initialMode?: 'entry' | 'join' } = {}) {
  const existing = useRoomSessionOptional()
  return existing ? <LanPersistentLobbyView initialMode={initialMode} />
    : <RoomSessionProvider><LanPersistentLobbyView initialMode={initialMode} /></RoomSessionProvider>
}

function LanPersistentLobbyView({ initialMode }: { initialMode: 'entry' | 'join' }) {
  const navigate = useNavigate()
  const session = useRoomSession()
  const {
    mode: sessionMode, preferHotspot, setPreferHotspot, role, invitation, setInvitation,
    enteredCode, setEnteredCode, roomId, playerId, snapshot, qr, hostCode, roomCode, hostIp,
    scannerOpen, setScannerOpen, status, error, setError, busy, connected,
    startHost, joinGuest, joinDiscoveredRoom, resumeGuest, action, leave, closeRoom, refreshInvite,
  } = session
  const [entryMode, setMode] = useState<'entry' | 'join'>(initialMode)
  const mode = sessionMode === 'active' ? 'active' : entryMode

  const intro = mode !== 'active' || !snapshot
  if (!intro && roomId && playerId) {
    return <LobbyRoomView
      snapshot={snapshot} role={role} playerId={playerId}
      status={status} error={error} busy={busy} connected={connected}
      code={role === 'host' ? hostCode : undefined}
      roomCode={role === 'host' ? roomCode : undefined}
      hostIp={role === 'host' ? hostIp : undefined}
      inviteText={role === 'host' ? invitation : undefined}
      inviteQr={role === 'host' ? qr : undefined}
      onBrowseGames={() => navigate('/')}
      onSelect={(game: LobbyGameId) => action('SELECT_GAME', { gameId: game })}
      onConfigure={config => action('CONFIGURE_GAME', config)}
      onReady={ready => action('READY', { ready })}
      onStart={() => action('START_GAME', null)}
      onGameAction={() => action(snapshot.roomState.selectedGameId === 'counter' ? 'INCREMENT' : 'TOY_CLUE', null, 'game')}
      onGameCommand={(type, payload) => action(type, payload, 'game')}
      onEnd={() => action('END_GAME', null)}
      onBackToLobby={() => action('RETURN_TO_LOBBY', null)}
      onFinishSession={() => action('FINISH_SESSION', null)}
      onReconnect={resumeGuest}
      onLeave={leave}
      onClose={closeRoom}
      onRefreshInvite={refreshInvite}
    />
  }

  return <main className="pl03 pl03-entry" data-testid="pl03-entry">
    <header className="pl03-header"><img src="/assets/brand/galerows-logo.svg" alt="Galerows" width="168" height="42" />
      <span className="pl03-header-tag"><Wifi size={15} aria-hidden="true" /> REDE LOCAL</span></header>
    <div className="pl03-entry-inner">
      <button type="button" className="pl03-quiet-btn" onClick={() => navigate('/')} disabled={busy}>
        <ArrowLeft size={18} aria-hidden="true" /> Voltar aos jogos
      </button>
      <p className="pl03-kicker"><span className="pl03-light" /> GALEROWS / MULTIPLAYER LOCAL</p>
      <h1>O jogo começa <em>com a galera.</em></h1>
      <p className="pl03-entry-lead">Todo mundo no próprio celular. Uma sala que continua entre as rodadas — sem conta e sem matchmaking.</p>
      {mode === 'entry' && <label className="pl03-network-choice">
        <input type="checkbox" checked={preferHotspot} onChange={event => setPreferHotspot(event.target.checked)} />
        <span><strong>Usar hotspot deste celular</strong><small>Marque apenas se os amigos estiverem conectados ao hotspot do anfitrião. Para o mesmo Wi-Fi, deixe desmarcado.</small></span>
      </label>}
      <div className="pl03-entry-cards">
        {mode === 'entry' && <>
          <button type="button" className="pl03-entry-card" onClick={startHost} disabled={busy}>
            <span className="pl03-entry-icon lime"><Users size={31} aria-hidden="true" /></span><span><small>QUEM REÚNE A TURMA</small><strong>Criar uma sala</strong><span>Mostre o código de 6 dígitos aos amigos e escolha o jogo.</span></span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
          <button type="button" className="pl03-entry-card" onClick={() => { setMode('join'); setError('') }} disabled={busy}>
            <span className="pl03-entry-icon purple"><QrCode size={31} aria-hidden="true" /></span><span><small>QUEM CHEGA PRA JOGAR</small><strong>Entrar numa sala</strong><span>Digite 6 dígitos ou escolha a sala da lista.</span></span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </>}
        {mode === 'join' && <section className="pl03-panel pl03-join-card" aria-labelledby="pl03-join-title">
          <button type="button" className="pl03-quiet-btn" onClick={() => setMode('entry')} disabled={busy}><ArrowLeft size={18} /> Voltar</button>
          <p className="pl03-eyebrow">MULTIPLAYER LOCAL SIMPLES</p>
          <h2 id="pl03-join-title">Entre na <em>roda.</em></h2>
          <p>Digite os 6 números que aparecem no celular do anfitrião. Se a sala já aparecer na lista, basta tocar em Entrar.</p>
          {Capacitor.isNativePlatform() && <LanRoomDiscoveryList disabled={busy} onJoinRoom={joinDiscoveredRoom}
            onRequestQr={() => setScannerOpen(true)} />}
          <button type="button" className="pl03-secondary-btn" onClick={() => setScannerOpen(true)} disabled={busy}>
            <QrCode size={19} aria-hidden="true" /> Ler QR do convite
          </button>
          <label htmlFor="pl03-invite-input"><Link2 size={16} aria-hidden="true" /> Convite completo (alternativa pelo QR)</label>
          <textarea id="pl03-invite-input" rows={4} value={invitation} onChange={event => setInvitation(event.target.value)}
            placeholder="Cole o convite que começa com galerows-lan-v2:" autoCapitalize="off" spellCheck={false} />
          <label htmlFor="pl03-code-input"><ShieldCheck size={16} aria-hidden="true" /> Verificação do QR (somente convite antigo)</label>
          <input id="pl03-code-input" value={enteredCode} onChange={event => setEnteredCode(event.target.value)}
            placeholder="Confirme presencialmente" autoCapitalize="characters" spellCheck={false} />
          <button type="button" className="pl03-primary-btn" onClick={joinGuest}
            disabled={busy || !invitation.trim() || !enteredCode.trim()}>Entrar na sala <ArrowRight size={18} aria-hidden="true" /></button>
        </section>}
      </div>
      {error && <p className="pl03-error" role="alert"><WifiOff size={17} /> {error}</p>}
      <p className="pl03-entry-note"><CheckCircle2 size={17} aria-hidden="true" /> Celulares na mesma rede Wi-Fi ou hotspot • Teste PL-03 com jogos sintéticos</p>
    </div>
    {scannerOpen && <LanQrScanner onClose={() => setScannerOpen(false)}
      onScan={value => { setScannerOpen(false); setInvitation(value); setMode('join') }} />}
  </main>
}
