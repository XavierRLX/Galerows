import { useCallback, useEffect, useRef, useState } from 'react'
import { LocalPreferences } from '../../../../lib/capacitor/preferences'
import type { ReactNode } from 'react'
import { RoomSessionContext } from './RoomSessionContext'
import { describeRoomSessionError } from './roomSessionErrors'
import { createLobbyInviteQr } from './lobbyInviteQr'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../../persistentRoom'
import { syntheticMultiplayerGames } from '../../multiplayerGames.synthetic'
import { impostorLanGame } from '../../impostorLanGame'
import { pistaUnicaLanGame } from '../../pistaUnicaLanGame'
import { cidadeDormeLanGame } from '../../cidadeDormeLanGame'
import type { RoomCommandV2, RoomSnapshotV2 } from '../../persistentProtocol'
import { LanNativeHost } from '../lanNativeHost'
import { LanSecureNativeClient } from '../lanSecureNativeClient'
import { LanPersistentRoomHost } from '../lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from '../lanPersistentGuestAdmission'
import { decodePersistentLanInvite, encodePersistentLanInvite } from '../lanPersistentInvite'
import { hostVerificationCode } from '../lanInvite'
import { inviteFromDiscoveredCode, isValidDiscoveredRoom } from '../lanShortRoomCode'
import type { DiscoveredLanRoom } from '../lanRoomDiscovery'
import type { PersistentLanInvite } from '../lanPersistentInvite'

type Mode = 'entry' | 'join' | 'active'
type Role = 'host' | 'guest'
const HOST_ID = 'host'
const HOST_CONNECTION = 'host-local'

/**
 * G2: Only this provider owns the native WSS host/guest, authoritative runtime,
 * command sequence, and admission credentials. Routes unmount without closing Room.
 * The provider must stay above AppRoutes; the host cannot survive process death.
 */
function useRoomSessionManager() {
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
  const [roomCode, setRoomCode] = useState('')
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
  const disposed = useRef(false)
  const lastNameLoadedForRoom = useRef<string | null>(null)
  const roomActionRef = useRef<(type: string, payload: unknown) => void>(() => undefined)
  // Invalidates completion callbacks from the Room that was just terminated.
  const sessionEpoch = useRef(0)

  const resetUi = useCallback(() => {
    sessionEpoch.current += 1
    setMode('entry')
    setSnapshot(null)
    setRoomId(null)
    setPlayerId(null)
    setQr('')
    setHostCode('')
    setRoomCode('')
    setHostIp('')
    setInvitation('')
    setEnteredCode('')
    setError('')
    setConnected(true)
    setStatus('Pronto para jogar na rede local')
    idRef.current = null
    roomRef.current = null
    sequence.current = 1
    currentInviteCapability.current = null
  }, [])

  const refreshSnapshot = useCallback(() => {
    if (hostRef.current && runtimeRef.current) {
      // A native expiry, fatal authority error, or timeout can close WSS without
      // an explicit UI action. Never display an orphaned Room as joinable.
      if (!hostRef.current.currentInvite) {
        hostRef.current = null
        runtimeRef.current = null
        resetUi()
        setError('Esta sala foi encerrada ou expirou. Crie uma nova sala para continuar.')
        return
      }
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
      const guest = guestRef.current
      if (guest.wasClosedByHost()) {
        guestRef.current = null
        void guest.disconnect().catch(() => undefined)
        resetUi()
        setError('Esta sala foi encerrada pelo anfitrião. Entre em outra sala para continuar.')
        return
      }
      const current = guest.getState()
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
  }, [resetUi])

  useEffect(() => {
    disposed.current = false
    const poll = window.setInterval(refreshSnapshot, 400)
    const onForeground = () => {
      // WebView timers may be frozen while Android backgrounds the application.
      // Validate terminal closure / private redaction synchronously on return.
      if (document.visibilityState === 'visible') refreshSnapshot()
    }
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('focus', onForeground)
    return () => {
      disposed.current = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('focus', onForeground)
      void guestRef.current?.disconnect().catch(() => undefined)
      void hostRef.current?.stop().catch(() => undefined)
    }
  }, [refreshSnapshot])

  async function run(action: () => Promise<void>) {
    if (inFlight.current || disposed.current) return
    const operationEpoch = sessionEpoch.current
    inFlight.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (reason) {
      if (!disposed.current && sessionEpoch.current === operationEpoch) {
        setError(describeRoomSessionError(reason))
      }
    }
    finally {
      inFlight.current = false
      if (!disposed.current) {
        setBusy(false)
        refreshSnapshot()
      }
    }
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

  function startHost() {
    if (roomRef.current) return
    void run(async () => {
      const server = new LanNativeHost()
      const room = 'galerows-' + crypto.randomUUID()
      const runtime = new AuthoritativeRoomRuntimeV2({
        roomId: room, hostPlayerId: HOST_ID, hostConnectionId: HOST_CONNECTION,
        adapter: new RoomLifecycleAdapter([...syntheticMultiplayerGames, impostorLanGame, pistaUnicaLanGame, cidadeDormeLanGame]),
      })
      const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), server)
      try {
        const address = await server.discoverLanAddress(preferHotspot)
        const ticket = await host.start(room, address.ip)
        if (disposed.current) { await host.stop().catch(() => undefined); return }
        await regenerateInvite(host, ticket)
        if (disposed.current) { await host.stop().catch(() => undefined); return }
        hostRef.current = host
        runtimeRef.current = runtime
        roomRef.current = room
        setRoomId(room)
        setPlayerId(HOST_ID)
        idRef.current = HOST_ID
        setHostIp(address.ip)
        setRoomCode(host.publicRoomCode() ?? '')
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

  async function connectGuest(invite: PersistentLanInvite, codeCheck: () => string) {
    const guest = new LanPersistentGuestAdmission(new LanSecureNativeClient())
    guestRef.current = guest
    try {
      const joined = await guest.connectInvite(invite, codeCheck)
      if (disposed.current) { await guest.disconnect().catch(() => undefined); guestRef.current = null; return }
      roomRef.current = invite.roomId
      idRef.current = joined.playerId
      setRoomId(invite.roomId)
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
  }

  function joinGuest() {
    void run(async () => {
      const decoded = decodePersistentLanInvite(invitation.trim())
      if (!decoded.ok) throw new Error(decoded.error)
      await connectGuest(decoded.invite, () => enteredCode.trim())
    })
  }

  /** Optical scanning explicitly trusts the identity carried by the host's QR. */
  function joinScannedInvite(raw: string) {
    if (roomRef.current) return
    void run(async () => {
      const decoded = decodePersistentLanInvite(raw)
      if (!decoded.ok) throw new Error(decoded.error)
      setStatus('Conectando…')
      await connectGuest(decoded.invite, () => hostVerificationCode(decoded.invite.fingerprint))
    })
  }

  /** G4-lite: LAN announcement provides an unverified initial pin; QR mode remains stronger. */
  function joinDiscoveredRoom(room: DiscoveredLanRoom) {
    void run(async () => {
      if (mode === 'active' || !isValidDiscoveredRoom(room)) throw new Error('invalid_room_code')
      const invite = await inviteFromDiscoveredCode(room)
      // Code mode deliberately accepts advertised identity without a second manual check.
      await connectGuest(invite, () => hostVerificationCode(invite.fingerprint))
    })
  }

  function resumeGuest() {
    void run(async () => {
      if (!roomRef.current) throw new Error('room_not_found')
      await guestRef.current?.disconnect().catch(() => undefined)
      const client = new LanPersistentGuestAdmission(new LanSecureNativeClient())
      guestRef.current = client
      const result = await client.resume(roomRef.current, idRef.current || undefined)
      if (disposed.current) { await client.disconnect().catch(() => undefined); guestRef.current = null; return }
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

  useEffect(() => { roomActionRef.current = action })

  function saveDisplayName(name: string) {
    const trimmed = name.trim().replace(/\s+/g,' ')
    if (!trimmed || trimmed.length > 32 || [...trimmed].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return
    void LocalPreferences.setJson('galerows:lan:myDisplayName', trimmed)
      .then(() => action('SET_DISPLAY_NAME', { name: trimmed }))
      .catch(() => setError('Não foi possível salvar seu nome neste aparelho.'))
  }

  useEffect(() => {
    if (!roomId || !playerId || busy || !snapshot || !connected) return
    const key = roomId + ':' + playerId
    if (lastNameLoadedForRoom.current === key) return
    lastNameLoadedForRoom.current = key
    void LocalPreferences.getJson<string>('galerows:lan:myDisplayName')
      .then(name => { if (typeof name === 'string' && name.trim()
        && name !== snapshot.roomState.members.find(m => m.playerId === playerId)?.displayName) {
        roomActionRef.current('SET_DISPLAY_NAME', { name })
      } }).catch(() => undefined)
  }, [roomId, playerId, busy, snapshot, connected])

  function leave() {
    void run(async () => {
      const guest = guestRef.current
      if (!connected) {
        // A disconnected client cannot obtain the host's signed leave ACK.
        // Only close the local UI and socket; keep native resume credentials,
        // since revocation was not authenticated or confirmed by the host.
        await guest?.disconnect().catch(() => undefined)
        guestRef.current = null
        resetUi()
        setStatus('Sala fechada neste aparelho. A saída não foi confirmada pelo anfitrião.')
        return
      }
      await guest?.leaveRoom()
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

  function refreshInvite() {
    void run(async () => {
      const host = hostRef.current
      if (!host) throw new Error('room_closed')
      await regenerateInvite(host, await host.refreshInvite())
    })
  }

  return {
    mode, preferHotspot, setPreferHotspot, role, invitation, setInvitation,
    enteredCode, setEnteredCode, roomId, playerId, snapshot, qr, hostCode, roomCode, hostIp,
    scannerOpen, setScannerOpen, status, error, setError, busy, connected,
    startHost, joinGuest, joinScannedInvite, joinDiscoveredRoom, resumeGuest, action, leave, closeRoom, refreshInvite, saveDisplayName,
  }
}

export type RoomSession = ReturnType<typeof useRoomSessionManager>

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const session = useRoomSessionManager()
  return <RoomSessionContext.Provider value={session}>{children}</RoomSessionContext.Provider>
}
