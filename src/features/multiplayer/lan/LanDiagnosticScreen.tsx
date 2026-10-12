import { useEffect, useRef, useState } from 'react'
import { LanNativeHost } from './lanNativeHost'
import { LanSecureNativeClient } from './lanSecureNativeClient'
import { PROTOCOL_VERSION } from '../protocol'

/** Manual transport probe bundled only when VITE_LAN_DIAGNOSTICS=1. */
export function LanDiagnosticScreen() {
  const [hostIp, setHostIp] = useState('')
  const [port, setPort] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [roomId, setRoomId] = useState<string>(() => crypto.randomUUID())
  const [token, setToken] = useState(() => crypto.randomUUID().replaceAll('-', ''))
  const [status, setStatus] = useState('idle')
  const [peerId, setPeerId] = useState('')
  const [entries, setEntries] = useState<string[]>([])
  const host = useRef(new LanNativeHost())
  const client = useRef(new LanSecureNativeClient())
  const hostListener = useRef<{ remove: () => Promise<void> } | null>(null)
  const clientListener = useRef<{ remove: () => Promise<void> } | null>(null)
  const log = (message: string) => setEntries(previous => [...previous, `${new Date().toISOString()} ${message}`])

  useEffect(() => () => {
    void client.current.disconnect()
    void host.current.stop()
    void hostListener.current?.remove()
    void clientListener.current?.remove()
  }, [])

  async function startHost() {
    try {
      hostListener.current = await host.current.onEvent(event => {
        log(`native ${event.type} peer=${event.peerId}${event.frame ? ` kind=${event.frame.kind}` : ''}`)
        if (event.type === 'connected') {
          setPeerId(event.peerId)
          void host.current.send(event.peerId, { kind: 'ping', protocolVersion: PROTOCOL_VERSION })
            .then(() => log('native sent ping'))
            .catch(() => log('native ping failed'))
        }
        if (event.type === 'disconnected') setPeerId('')
      })
      const result = await host.current.startSecure(roomId, token)
      setPort(String(result.port))
      setFingerprint(result.fingerprint)
      setStatus('hosting')
      log(`server started port=${result.port}`)
    } catch (error) { setStatus('error'); log(`start failed ${String(error)}`) }
  }

  async function stopHost() {
    try {
      await host.current.stop()
      await hostListener.current?.remove()
      hostListener.current = null
      setPeerId('')
      setStatus('stopped')
      log('server stopped')
    } catch (error) { log(`stop failed ${String(error)}`) }
  }

  async function connect() {
    try {
      clientListener.current = await client.current.onEvent(event => {
        if (event.type === 'message') log(`native client received kind=${event.frame?.kind}`)
        else { setStatus(event.type); log(`native client ${event.type}`) }
      })
      await client.current.connect(hostIp, Number(port), fingerprint, roomId, token)
      setStatus('open')
      log(`pinned WSS open ${hostIp}:${port}`)
    } catch (error) {
      await clientListener.current?.remove()
      clientListener.current = null
      setStatus('error')
      log(`connect failed ${String(error)}`)
    }
  }

  async function disconnect() {
    await client.current.disconnect()
    await clientListener.current?.remove()
    clientListener.current = null
    setStatus('closed')
    log('client disconnected')
  }

  async function sendHost() {
    try { await host.current.send(peerId, { kind: 'ping', protocolVersion: PROTOCOL_VERSION }); log(`native sent ping peer=${peerId}`) }
    catch (error) { log(`host send failed ${String(error)}`) }
  }

  async function sendGuest() {
    try { await client.current.send({ kind: 'pong', protocolVersion: PROTOCOL_VERSION }); log('native client sent pong') }
    catch (error) { log(`guest send failed ${String(error)}`) }
  }

  return <main style={{ padding: 24, background: '#0f172a', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
    <h1>LAN Debug</h1>
    <p id="lan-status">Status: {status} | Peer: {peerId || 'none'}</p>
    <label>Host IP <input aria-label="Host IP" value={hostIp} onChange={event => setHostIp(event.target.value)} /></label><br />
    <label>Port <input aria-label="Port" value={port} onChange={event => setPort(event.target.value)} /></label><br />
    <label>Host fingerprint <input aria-label="Host fingerprint" value={fingerprint} onChange={event => setFingerprint(event.target.value)} /></label><br />
    <label>Room ID <input aria-label="Room ID" value={roomId} onChange={event => setRoomId(event.target.value)} /></label><br />
    <label>Invite token <input aria-label="Invite token" value={token} onChange={event => setToken(event.target.value)} /></label><br />
    <button onClick={() => void startHost()}>Start host</button> <button onClick={() => void stopHost()}>Stop host</button><br />
    <button onClick={() => void connect()}>Connect guest</button> <button onClick={() => void disconnect()}>Disconnect guest</button><br />
    <button onClick={() => void sendHost()} disabled={!peerId}>Host ping</button> <button onClick={() => void sendGuest()}>Guest pong</button>
    <pre id="lan-log" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entries.join('\n')}</pre>
  </main>
}
