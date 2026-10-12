import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AuthoritativeRoomRuntimeV2, RoomCoordinatorV2, RoomLifecycleAdapter } from '../persistentRoom'
import { syntheticMultiplayerGames } from '../multiplayerGames.synthetic'
import { LanNativeHost } from './lanNativeHost'
import { LanPersistentRoomHost } from './lanPersistentRoomHost'
import { LanPersistentGuestAdmission } from './lanPersistentGuestAdmission'
import { LanSecureNativeClient } from './lanSecureNativeClient'
import { decodePersistentLanInvite, encodePersistentLanInvite } from './lanPersistentInvite'
import { LanQrScanner } from './LanQrScanner'
import type { RoomCommandV2, RoomSnapshotV2 } from '../persistentProtocol'

const ROOM_ID = 'lan-v2-synthetic-probe'
type View = { roomId: string; revision: number; phase: string; players: string[];
  game: string | null; sessionId: string | null; hasPrivate: boolean; nextClientSeq: number }
function view(snapshot: RoomSnapshotV2): View {
  return { roomId: snapshot.roomId, revision: snapshot.revision,
    phase: snapshot.roomState.phase, players: snapshot.roomState.members.map(m => m.playerId),
    game: snapshot.roomState.selectedGameId, sessionId: snapshot.roomState.currentGameSessionId,
    hasPrivate: snapshot.privateState !== null, nextClientSeq: snapshot.nextClientSeq }
}

/** Opt-in Android-only physical validation of Room v2; never import from the default Release. */
export function LanPersistentRoomProbeScreen() {
  const [role, setRole] = useState<'choice' | 'host' | 'guest'>('choice')
  const [ip, setIp] = useState('')
  const [invite, setInvite] = useState('')
  const [qr, setQr] = useState('')
  const [hostCode, setHostCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [local, setLocal] = useState<View | null>(null)
  const [scanner, setScanner] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [rekeys, setRekeys] = useState(0)
  const hostRef = useRef<LanPersistentRoomHost | null>(null)
  const runtimeRef = useRef<AuthoritativeRoomRuntimeV2 | null>(null)
  const guestRef = useRef<LanPersistentGuestAdmission | null>(null)
  const idRef = useRef<string | null>(null)
  const seqRef = useRef(1)
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)

  const log = (note: string) => setResults(previous => [...previous.slice(-19), note])
  useEffect(() => {
    timeoutRef.current = setInterval(() => {
      const host = runtimeRef.current
      const owner = host && host.snapshotFor('host', 'host-local')
      const guest = guestRef.current?.getState()
      setRekeys(guestRef.current?.getRekeyCount() ?? 0)
      if (owner?.ok) setLocal(view(owner.snapshot))
      else if (guest) setLocal(view(guest))
    }, 500)
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current)
      void guestRef.current?.disconnect().catch(() => undefined)
      void hostRef.current?.stop().catch(() => undefined)
    }
  }, [])

  async function startHost() {
    if (busyRef.current) return
    busyRef.current = true
    const server = new LanNativeHost()
    const runtime = new AuthoritativeRoomRuntimeV2({ roomId: ROOM_ID,
      hostPlayerId: 'host', hostConnectionId: 'host-local',
      adapter: new RoomLifecycleAdapter(syntheticMultiplayerGames) })
    const host = new LanPersistentRoomHost(new RoomCoordinatorV2(runtime), server,
      import.meta.env.VITE_LAN_REKEY_PROBE === '1' ? { rekeyAfterMs: 2500, rekeyRetryMs: 1500 } : {})
    try {
      const { ip: hostIp } = await server.discoverLanAddress()
      const ticket = await host.start(ROOM_ID, hostIp)
      const text = encodePersistentLanInvite(ticket)
      hostRef.current = host
      runtimeRef.current = runtime
      setIp(hostIp)
      setInvite(text)
      setQr(await QRCode.toDataURL(text, { margin: 1, width: 288 }))
      setHostCode(host.hostCode())
      setRole('host')
      setStatus('hosting')
      log('Host v2 ready; compare identity code in person')
    } catch (error) {
      setStatus('host_error')
      log(String(error))
      await host.stop().catch(() => undefined)
    } finally { busyRef.current = false }
  }

  async function connect() {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const parsed = decodePersistentLanInvite(invite.trim())
      if (!parsed.ok) throw new Error(parsed.error)
      const current = new LanPersistentGuestAdmission(new LanSecureNativeClient())
      guestRef.current = current
      setStatus('connecting')
      const joined = await current.connectInvite(parsed.invite, () => enteredCode)
      idRef.current = joined.playerId
      setRole('guest')
      setStatus('admitted')
      setLocal(view(joined.snapshot))
      log('Guest admitted; snapshot privately projected')
    } catch (error) {
      setStatus('connect_error')
      log(String(error))
    } finally { busyRef.current = false }
  }

  async function resume() {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const current = new LanPersistentGuestAdmission(new LanSecureNativeClient())
      guestRef.current = current
      setStatus('resuming')
      const joined = await current.resume(ROOM_ID, idRef.current ?? undefined)
      idRef.current = joined.playerId
      setLocal(view(joined.snapshot))
      setStatus('resumed')
      log('Guest resumed the same player and current game')
    } catch (error) {
      setStatus('resume_error')
      log(String(error))
    } finally { busyRef.current = false }
  }

  async function drop() {
    await guestRef.current?.disconnect().catch(() => undefined)
    guestRef.current = null
    setStatus('disconnected')
    log('Socket dropped; Keystore credential retained')
  }

  async function leave() {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await guestRef.current?.leaveRoom('probe-leave-' + crypto.randomUUID())
      guestRef.current = null
      idRef.current = null
      setStatus('left_confirmed')
      setLocal(null)
      log('Leave confirmed; membership removed and vault cleared')
    } catch (error) {
      setStatus('leave_unconfirmed')
      log(String(error))
    } finally { busyRef.current = false }
  }

  async function hostAction(type: string, payload: unknown) {
    const host = hostRef.current
    if (!host || busyRef.current) return
    busyRef.current = true
    const command: RoomCommandV2 = { protocolVersion: 2, scope: 'room', roomId: ROOM_ID,
      playerId: 'host', commandId: crypto.randomUUID(), clientSeq: seqRef.current, type, payload }
    try {
      const result = await host.processLocalCommand(command, 'host-local')
      if (result.nextClientSeq) seqRef.current = result.nextClientSeq
      log('Host ' + type + ' = ' + result.status + (result.error ? ' ' + result.error : ''))
      const snapshot = runtimeRef.current?.snapshotFor('host', 'host-local')
      if (snapshot?.ok) setLocal(view(snapshot.snapshot))
    } catch (error) { log('Host error ' + String(error)) }
    finally { busyRef.current = false }
  }

  async function guestAction(type: string, payload: unknown, scope: 'room' | 'game' = 'room') {
    const guest = guestRef.current
    if (!guest || busyRef.current) return
    busyRef.current = true
    try {
      const result = await guest.sendCommand({ scope, type, payload,
        gameSessionId: scope === 'game' ? guest.getState()?.roomState.currentGameSessionId ?? undefined : undefined })
      log('Guest ' + type + ' = ' + result.status + (result.error ? ' ' + result.error : ''))
    } catch (error) { log('Guest error ' + String(error)) }
    finally { busyRef.current = false }
  }

  async function closeHost() {
    await hostRef.current?.stop()
    hostRef.current = null
    runtimeRef.current = null
    setStatus('room_closed')
    log('Room closed permanently')
  }

  const button = 'rounded bg-slate-700 px-3 py-3 text-white disabled:opacity-50'
  return <main className="min-h-dvh space-y-3 bg-slate-950 p-4 text-slate-100" data-testid="lan-v2-probe">
    <h1 className="text-2xl font-bold">Galerows · Room v2 synthetic probe</h1>
    <p role="status" data-testid="v2-status">Status: {status}</p>
    <p data-testid="v2-rekeys">Native vault rotations: {rekeys}</p>
    {role === 'choice' && <div className="flex gap-2">
      <button className={button} onClick={() => void startHost()}>Start v2 host</button>
      <button className={button} onClick={() => setRole('guest')}>Join as guest</button>
    </div>}
    {role === 'host' && <>
      <p>Host LAN IP: {ip}</p>
      <p>Host verification code: <strong data-testid="v2-code">{hostCode}</strong></p>
      {qr && <img width="288" height="288" alt="Room v2 invite QR" src={qr} />}
      <label>Invite text <textarea readOnly aria-label="v2 invite" rows={5} className="w-full bg-slate-800 text-xs" value={invite} /></label>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => void hostAction('SELECT_GAME', { gameId: 'toy' })}>Select toy A</button>
        <button className={button} onClick={() => void hostAction('CONFIGURE_GAME', { rounds: 2 })}>Configure toy A</button>
        <button className={button} onClick={() => void hostAction('SELECT_GAME', { gameId: 'counter' })}>Select counter B</button>
        <button className={button} onClick={() => void hostAction('CONFIGURE_GAME', { target: 3 })}>Configure counter B</button>
        <button className={button} onClick={() => void hostAction('READY', { ready: true })}>Host ready</button>
        <button className={button} onClick={() => void hostAction('START_GAME', null)}>Start game</button>
        <button className={button} onClick={() => void hostAction('END_GAME', null)}>End game</button>
        <button className={button} onClick={() => void hostAction('RETURN_TO_LOBBY', null)}>Back to lobby</button>
        <button className={button} onClick={() => void closeHost()}>Close Room</button>
      </div>
    </>}
    {role === 'guest' && <>
      <label>v2 invite <textarea aria-label="v2 invite" rows={5} className="w-full bg-slate-800 text-xs" value={invite} onChange={event => setInvite(event.target.value)} /></label>
      <button className={button} onClick={() => setScanner(true)}>Scan QR</button>
      <label>Verified host code <input aria-label="v2 code" className="w-full bg-slate-800" value={enteredCode} onChange={event => setEnteredCode(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => void connect()}>Connect v2 guest</button>
        <button className={button} onClick={() => void guestAction('READY', { ready: true })}>Guest ready</button>
        <button className={button} onClick={() => void guestAction('INCREMENT', null, 'game')}>Increment counter B</button>
        <button className={button} onClick={() => void drop()}>Drop socket</button>
        <button className={button} onClick={() => void resume()}>Resume v2 guest</button>
        <button className={button} onClick={() => void leave()}>Leave Room v2</button>
      </div>
    </>}
    {local && <pre data-testid="v2-state" className="overflow-x-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify(local, null, 2)}</pre>}
    <pre data-testid="v2-log" className="whitespace-pre-wrap break-words text-xs">{results.join('\n')}</pre>
    {scanner && <LanQrScanner onClose={() => setScanner(false)}
      onScan={value => { setScanner(false); setInvite(value) }} />}
  </main>
}
