import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Link2, QrCode, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react'
import { createLobbyInviteQr } from './lobbyInviteQr'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../../persistentRoom'
import { syntheticMultiplayerGames } from '../../multiplayerGames.synthetic'
import type { RoomCommandV2, RoomSnapshotV2 } from '../../persistentProtocol'
import { LanNativeHost } from '../lanNativeHost'
import { LanSecureNativeClient } from '../lanSecureNativeClient'
import { LanPersistentRoomHost } from '../lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from '../lanPersistentGuestAdmission'
import { decodePersistentLanInvite, encodePersistentLanInvite } from '../lanPersistentInvite'
import { LanQrScanner } from '../LanQrScanner'
import { LobbyRoomView } from './LobbyRoomView'
import type { LobbyGameId } from './lobbyView'
import './lobby.css'

type Mode = 'entry' | 'join' | 'active'
type Role = 'host' | 'guest'
const HOST_ID = 'host'
const HOST_CONNECTION = 'host-local'

function humanError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  if (code.includes('lan_interface_unavailable')) return 'Ative o Wi-Fi ou hotspot e espere a rede conectar para criar a sala.'
  if (code.includes('invite_expired')) return 'Este convite venceu. Peça outro ao anfitrião.'
  if (code.includes('invalid_invite')) return 'O convite não é válido. Confira o texto ou leia o QR novamente.'
  if (code.includes('host_identity_mismatch')) return 'O código não confere. Verifique pessoalmente com o anfitrião.'
  if (code.includes('not_ready')) return 'Ainda há jogadores que não marcaram pronto.'
  if (code.includes('invalid_player_count')) return 'São necessárias pelo menos duas pessoas conectadas.'
  if (code.includes('room_closed')) return 'Esta sala foi encerrada pelo anfitrião.'
  if (code.includes('connection') || code.includes('disconnected') || code.includes('timeout')) {
    return 'A conexão caiu. Confirme a rede Wi-Fi local e tente reconectar.'
  }
  if (code.includes('transition_pending')) return 'Aguarde a entrada ou reconexão de outro jogador.'
  if (code.includes('resync_required')) return 'O estado da sala precisa ser sincronizado. Aguarde ou reconecte.'
  return 'Não foi possível concluir a ação. Verifique a sala e tente novamente.'
}

/** Opt-in Android-only UX for persistent Room v2; no real games or public matchmaking. */
export function LanPersistentLobbyScreen() {
  const [mode, setMode] = useState<Mode>('entry')
  const [preferHotspot, setPreferHotspot] = useState(false)
  const [role, setRole] = useState<Role>('host')
  const [invitation, setInvitation] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<RoomSnapshotV2 | null>(null)
  const [qr, setQr] = useState('')
  const [hostCode, setHostCode] = useState('')
  const [hostIp, setHostIp] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [status, setStatus] = useState('Pronto para jogar na rede local')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(true)
  const hostRef = useRef<LanPersistentRoomHost | null>(null)
  const runtimeRef = useRef<AuthoritativeRoomRuntimeV2 | null>(null)
  const guestRef = useRef<LanPersistentGuestAdmission | null>(null)
  const idRef = useRef<string | null>(null)
  const roomRef = useRef<string | null>(null)
  const sequence = useRef(1)
  const currentInviteCapability = useRef<string | null>(null)
  const inFlight = useRef(false)

  const refreshSnapshot = useCallback(() => {
    if (hostRef.current && runtimeRef.current) {
      const latest = hostRef.current.currentInvite
      if (latest && latest.capability !== currentInviteCapability.current) {
        currentInviteCapability.current = latest.capability
        const serialized = encodePersistentLanInvite(latest)
        void createLobbyInviteQr(serialized)
          .then(image => {
            if (currentInviteCapability.current !== latest.capability) return
            setInvitation(serialized)
            setQr(image)
          }).catch(() => setError('O QR não pôde ser atualizado. Use renovar convite.'))
      }
      const current = runtimeRef.current.snapshotFor(HOST_ID, HOST_CONNECTION)
      if (current.ok) setSnapshot(previous => previous?.revision === current.snapshot.revision ? previous : current.snapshot)
    } else if (guestRef.current) {
      const current = guestRef.current.getState()
      if (current) {
        setConnected(true)
        setSnapshot(previous => previous?.revision === current.revision ? previous : current)
      } else if (!inFlight.current && roomRef.current) {
        // Never keep an old private projection on screen after a transport drop.
        setSnapshot(previous => previous?.privateState || previous?.gamePublicState
          ? { ...previous, privateState: null, gamePublicState: null } : previous)
        setConnected(false)
        setStatus('Conexão interrompida. A sala pode ser retomada.')
      }
    }
  }, [])

  useEffect(() => {
    const poll = window.setInterval(refreshSnapshot, 400)
    return () => {
      window.clearInterval(poll)
      void guestRef.current?.disconnect().catch(() => undefined)
      void hostRef.current?.stop().catch(() => undefined)
    }
  }, [refreshSnapshot])

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (reason) { setError(humanError(reason)) }
    finally { inFlight.current = false; setBusy(false); refreshSnapshot() }
  }

  async function regenerateInvite(host: LanPersistentRoomHost, ticket = host.currentInvite) {
    if (!ticket) throw new Error('room_closed')
    const text = encodePersistentLanInvite(ticket)
    const image = await createLobbyInviteQr(text)
    currentInviteCapability.current = ticket.capability
    setInvitation(text)
    setQr(image)
    setHostCode(host.hostCode())
  }

  function resetUi() {
    setMode('entry')
    setSnapshot(null)
    setRoomId(null)
    setPlayerId(null)
    setQr('')
    setInvitation('')
    setEnteredCode('')
    setError('')
    setConnected(true)
    setStatus('Pronto para jogar na rede local')
    idRef.current = null
    roomRef.current = null
    sequence.current = 1
    currentInviteCapability.current = null
  }

  function startHost() {
    void run(async () => {
      const server = new LanNativeHost()
      const room = 'galerows-' + crypto.randomUUID()
      const runtime = new AuthoritativeRoomRuntimeV2({
        roomId: room, hostPlayerId: HOST_ID, hostConnectionId: HOST_CONNECTION,
        adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames),
      })
      const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), server)
      try {
        const address = await server.discoverLanAddress(preferHotspot)
        const ticket = await host.start(room, address.ip)
        await regenerateInvite(host, ticket)
        hostRef.current = host
        runtimeRef.current = runtime
        roomRef.current = room
        setRoomId(room)
        setPlayerId(HOST_ID)
        idRef.current = HOST_ID
        setHostIp(address.ip)
        setRole('host')
        setMode('active')
        setConnected(true)
        setStatus('Sala criada. Convide quem está no mesmo Wi-Fi.')
        const own = runtime.snapshotFor(HOST_ID, HOST_CONNECTION)
        if (own.ok) setSnapshot(own.snapshot)
      } catch (reason) {
        await host.stop().catch(() => undefined)
        throw reason
      }
    })
  }

  function joinGuest() {
    void run(async () => {
      const decoded = decodePersistentLanInvite(invitation.trim())
      if (!decoded.ok) throw new Error(decoded.error)
      const guest = new LanPersistentGuestAdmission(new LanSecureNativeClient())
      guestRef.current = guest
      try {
        const joined = await guest.connectInvite(decoded.invite, () => enteredCode.trim())
        roomRef.current = decoded.invite.roomId
        idRef.current = joined.playerId
        setRoomId(decoded.invite.roomId)
        setPlayerId(joined.playerId)
        setRole('guest')
        setMode('active')
        setConnected(true)
        setSnapshot(joined.snapshot)
        setStatus('Conectado. Você já está na sala!')
      } catch (reason) {
        guestRef.current = null
        await guest.disconnect().catch(() => undefined)
        throw reason
      }
    })
  }

  function resumeGuest() {
    void run(async () => {
      if (!roomRef.current) throw new Error('room_not_found')
      await guestRef.current?.disconnect().catch(() => undefined)
      const client = new LanPersistentGuestAdmission(new LanSecureNativeClient())
      guestRef.current = client
      const result = await client.resume(roomRef.current, idRef.current || undefined)
      idRef.current = result.playerId
      setPlayerId(result.playerId)
      setSnapshot(result.snapshot)
      setConnected(true)
      setStatus('Reconectado. Você voltou à mesma sala!')
    })
  }

  function action(type: string, payload: unknown, scope: 'room' | 'game' = 'room') {
    void run(async () => {
      if (!snapshot || !playerId || !roomId) throw new Error('lan_disconnected')
      if (role === 'host') {
        const command: RoomCommandV2 = {
          protocolVersion: 2, scope, roomId, playerId: HOST_ID,
          commandId: crypto.randomUUID(), clientSeq: sequence.current, type, payload,
          ...(scope === 'game' && snapshot.roomState.currentGameSessionId
            ? { gameSessionId: snapshot.roomState.currentGameSessionId } : {}),
        }
        const response = await hostRef.current!.processLocalCommand(command, HOST_CONNECTION)
        if (response.nextClientSeq !== null) sequence.current = response.nextClientSeq
        if (response.status !== 'accepted') throw new Error(response.error ?? 'command_rejected')
      } else {
        if (!connected) throw new Error('lan_disconnected')
        const response = await guestRef.current!.sendCommand({
          scope, type, payload,
          ...(scope === 'game' && snapshot.roomState.currentGameSessionId
            ? { gameSessionId: snapshot.roomState.currentGameSessionId } : {}),
        })
        if (response.status !== 'accepted') throw new Error(response.error ?? 'command_rejected')
      }
      refreshSnapshot()
    })
  }

  function leave() {
    void run(async () => {
      await guestRef.current?.leaveRoom()
      guestRef.current = null
      resetUi()
    })
  }

  function closeRoom() {
    void run(async () => {
      await hostRef.current?.stop()
      hostRef.current = null
      runtimeRef.current = null
      resetUi()
    })
  }

  const intro = mode !== 'active' || !snapshot
  if (!intro && roomId && playerId) {
    return <LobbyRoomView
      snapshot={snapshot} role={role} playerId={playerId}
      status={status} error={error} busy={busy} connected={connected}
      code={role === 'host' ? hostCode : undefined}
      hostIp={role === 'host' ? hostIp : undefined}
      inviteText={role === 'host' ? invitation : undefined}
      inviteQr={role === 'host' ? qr : undefined}
      onSelect={(game: LobbyGameId) => action('SELECT_GAME', { gameId: game })}
      onConfigure={config => action('CONFIGURE_GAME', config)}
      onReady={ready => action('READY', { ready })}
      onStart={() => action('START_GAME', null)}
      onGameAction={() => action(snapshot.roomState.selectedGameId === 'counter' ? 'INCREMENT' : 'TOY_CLUE', null, 'game')}
      onEnd={() => action('END_GAME', null)}
      onBackToLobby={() => action('RETURN_TO_LOBBY', null)}
      onReconnect={resumeGuest}
      onLeave={leave}
      onClose={closeRoom}
      onRefreshInvite={() => void run(async () => {
        const host = hostRef.current
        if (!host) throw new Error('room_closed')
        await regenerateInvite(host, await host.refreshInvite())
      })}
    />
  }

  return <main className="pl03 pl03-entry" data-testid="pl03-entry">
    <header className="pl03-header"><img src="/assets/brand/galerows-logo.svg" alt="Galerows" width="168" height="42" />
      <span className="pl03-header-tag"><Wifi size={15} aria-hidden="true" /> REDE LOCAL</span></header>
    <div className="pl03-entry-inner">
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
            <span className="pl03-entry-icon lime"><Users size={31} aria-hidden="true" /></span><span><small>QUEM REÚNE A TURMA</small><strong>Criar uma sala</strong><span>Mostre o QR aos amigos e escolha o jogo.</span></span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
          <button type="button" className="pl03-entry-card" onClick={() => { setMode('join'); setError('') }} disabled={busy}>
            <span className="pl03-entry-icon purple"><QrCode size={31} aria-hidden="true" /></span><span><small>QUEM CHEGA PRA JOGAR</small><strong>Entrar numa sala</strong><span>Leia o QR ou digite o convite do anfitrião.</span></span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </>}
        {mode === 'join' && <section className="pl03-panel pl03-join-card" aria-labelledby="pl03-join-title">
          <button type="button" className="pl03-quiet-btn" onClick={() => setMode('entry')} disabled={busy}><ArrowLeft size={18} /> Voltar</button>
          <p className="pl03-eyebrow">ENTRADA SEGURA</p>
          <h2 id="pl03-join-title">Entre na <em>roda.</em></h2>
          <p>Use o QR ou o texto do anfitrião, depois confirme o código mostrado na tela dele.</p>
          <button type="button" className="pl03-secondary-btn" onClick={() => setScannerOpen(true)} disabled={busy}>
            <QrCode size={19} aria-hidden="true" /> Ler QR do convite
          </button>
          <label htmlFor="pl03-invite-input"><Link2 size={16} aria-hidden="true" /> Convite da sala</label>
          <textarea id="pl03-invite-input" rows={4} value={invitation} onChange={event => setInvitation(event.target.value)}
            placeholder="Cole o convite que começa com galerows-lan-v2:" autoCapitalize="off" spellCheck={false} />
          <label htmlFor="pl03-code-input"><ShieldCheck size={16} aria-hidden="true" /> Código de verificação do anfitrião</label>
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
