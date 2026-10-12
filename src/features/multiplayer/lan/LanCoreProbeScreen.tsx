import { useEffect, useRef, useState } from 'react'
import type { GameAdapter } from '../gameAdapter'
import { PROTOCOL_VERSION } from '../protocol'
import type { Command } from '../protocol'
import { AuthoritativeRoomRuntime } from '../runtime'
import { decodeLanInvite, encodeLanInvite } from './lanInvite'
import { LanNativeHost } from './lanNativeHost'
import { LanRoomHost } from './lanRoomHost'
import { LanRoomSession } from './lanRoomSession'
import type { LanRoomBootstrap } from './lanRoomSession'

type State = { count: number }
type Public = { count: number }
type Private = { tag: string }
const adapter: GameAdapter<State, number, Public, Private> = {
  createInitialState: () => ({ count: 0 }),
  parseCommand: command => command.type === 'add' && command.payload === 1
    ? { ok: true, command: 1 } : { ok: false, error: 'invalid_payload' },
  applyCommand: (state, amount) => ({ accepted: true, changed: true, state: { count: state.count + amount } }),
  projectPublic: state => ({ count: state.count }),
  projectPrivate: (_state, playerId) => ({ tag: `private-${playerId}` }),
}

/** Short-lived Android physical probe; only loaded with VITE_LAN_CORE_PROBE=1. */
export function LanCoreProbeScreen() {
  const [hostIp, setHostIp] = useState('')
  const [inviteText, setInviteText] = useState('')
  const [hostCode, setHostCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [entries, setEntries] = useState<string[]>([])
  const host = useRef<LanRoomHost<State, number, Public, Private> | null>(null)
  const session = useRef<LanRoomSession<Public, Private> | null>(null)
  const guest = useRef<LanRoomBootstrap<Public, Private> | null>(null)
  const unsubscribe = useRef<(() => void) | null>(null)
  const log = (message: string) => setEntries(previous => [...previous.slice(-30), message])

  useEffect(() => () => {
    unsubscribe.current?.()
    void session.current?.disconnect()
    void host.current?.stop()
  }, [])

  async function startHost() {
    try {
      const runtime = new AuthoritativeRoomRuntime({ roomId: 'lan-core-probe', adapter })
      const coordinator = new LanRoomHost(runtime, new LanNativeHost())
      const invite = await coordinator.start('lan-core-probe', hostIp)
      const local = coordinator.joinLocal()
      host.current = coordinator
      setInviteText(encodeLanInvite(invite))
      setHostCode(coordinator.hostCode())
      setStatus('hosting')
      log(`host ready port=${invite.port} local=${local.playerId} revision=${local.snapshot.revision} private=${local.snapshot.privateState?.tag}`)
    } catch (error) { setStatus('error'); log(`host failed ${String(error)}`) }
  }

  async function connectGuest() {
    try {
      const parsed = decodeLanInvite(inviteText)
      if (!parsed.ok) throw new Error(parsed.error)
      const current = new LanRoomSession<Public, Private>()
      session.current = current
      setStatus('connecting')
      const joined = await current.connectInvite(parsed.invite, () => enteredCode)
      guest.current = joined
      observeGuest(joined)
      setStatus('admitted')
      log(`guest admitted player=${joined.playerId} revision=${joined.replica.getState().lastAppliedRevision} private=${joined.replica.getState().privateState?.tag}`)
    } catch (error) { setStatus('error'); log(`guest failed ${String(error)}`) }
  }

  function observeGuest(joined: LanRoomBootstrap<Public, Private>) {
      unsubscribe.current?.()
      unsubscribe.current = joined.transport.subscribe(message => {
        if ('status' in message) log(`result ${message.commandId} status=${message.status} error=${message.error ?? 'none'}`)
        else if ('kind' in message) log(`event revision=${message.revision} kind=${message.kind} count=${joined.replica.getState().gamePublicState.count}`)
        else log(`snapshot revision=${message.revision} count=${joined.replica.getState().gamePublicState.count} private=${joined.replica.getState().privateState?.tag}`)
      })
  }

  async function dropGuestSocket() {
    try {
      await session.current?.disconnect()
      setStatus('disconnected')
      log('guest socket dropped; resume credential retained')
    } catch (error) { log(`drop failed ${String(error)}`) }
  }

  async function resumeGuest() {
    const previous = guest.current
    if (!previous) return
    try {
      const current = new LanRoomSession<Public, Private>()
      session.current = current
      setStatus('resuming')
      const joined = await current.resume('lan-core-probe', previous.playerId, previous.replica)
      guest.current = joined
      observeGuest(joined)
      setStatus('resumed')
      log(`guest resumed player=${joined.playerId} revision=${joined.replica.getState().lastAppliedRevision} private=${joined.replica.getState().privateState?.tag}`)
    } catch (error) { setStatus('error'); log(`resume failed ${String(error)}`) }
  }

  async function stopHost() {
    try { await host.current?.stop(); setStatus('room_closed'); log('host stopped permanently') }
    catch (error) { log(`stop failed ${String(error)}`) }
  }

  async function sendCommand(valid: boolean) {
    const joined = guest.current
    if (!joined) return
    const command: Command = { protocolVersion: PROTOCOL_VERSION, roomId: 'lan-core-probe',
      playerId: joined.playerId, commandId: crypto.randomUUID(), type: valid ? 'add' : 'invalid', payload: valid ? 1 : null }
    try { await joined.transport.sendCommand(command); log(`sent ${valid ? 'valid' : 'invalid'} ${command.commandId}`) }
    catch (error) { log(`send failed ${String(error)}`) }
  }

  async function forceGap() {
    const joined = guest.current
    if (!joined) return
    const before = joined.replica.getState().lastAppliedRevision
    const outcome = joined.replica.applyEvent({ protocolVersion: PROTOCOL_VERSION, roomId: 'lan-core-probe', revision: before + 2, kind: 'marker' })
    log(`synthetic gap outcome=${outcome} at=${before}`)
    try {
      await joined.transport.sendResyncRequest({ protocolVersion: PROTOCOL_VERSION, roomId: 'lan-core-probe',
        playerId: joined.playerId, lastAppliedRevision: before })
    } catch (error) { log(`resync failed ${String(error)}`) }
  }

  return <main style={{ padding: 18, background: '#0f172a', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
    <h1>LAN Core Debug</h1>
    <p>Status: {status}</p>
    <label>Host IP <input aria-label="Host IP" value={hostIp} onChange={event => setHostIp(event.target.value)} /></label><br />
    <button onClick={() => void startHost()}>Start core host</button>
    <button onClick={() => void stopHost()}>Stop core host</button>
    <p>Host code: <span id="core-host-code">{hostCode}</span></p>
    <label>Invite <textarea aria-label="Invite" value={inviteText} onChange={event => setInviteText(event.target.value)} rows={4} style={{ width: '100%' }} /></label><br />
    <label>Entered host code <input aria-label="Entered host code" value={enteredCode} onChange={event => setEnteredCode(event.target.value)} /></label><br />
    <button onClick={() => void connectGuest()}>Connect core guest</button><br />
    <button onClick={() => void dropGuestSocket()}>Drop guest socket</button>
    <button onClick={() => void resumeGuest()}>Resume guest</button><br />
    <button onClick={() => void sendCommand(true)}>Send valid command</button>
    <button onClick={() => void sendCommand(false)}>Send invalid command</button><br />
    <button onClick={() => void forceGap()}>Force gap and resync</button>
    <pre id="core-log" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entries.join('\n')}</pre>
  </main>
}
