import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { GameAdapter } from '../gameAdapter'
import { PROTOCOL_VERSION } from '../protocol'
import { AuthoritativeRoomRuntime } from '../runtime'
import { decodeLanInvite, encodeLanInvite } from './lanInvite'
import type { LanInvite } from './lanInvite'
import { LanNativeHost } from './lanNativeHost'
import { LanQrScanner } from './LanQrScanner'
import { LanRoomHost } from './lanRoomHost'
import { LanRoomSession } from './lanRoomSession'
import type { LanJoinPhase, LanRoomBootstrap } from './lanRoomSession'

type TestState = { count: number }
type TestPublic = { count: number }
type TestPrivate = null
const adapter: GameAdapter<TestState, number, TestPublic, TestPrivate> = {
  createInitialState: () => ({ count: 0 }),
  parseCommand: command => command.type === 'testIncrement' && command.payload === 1
    ? { ok: true, command: 1 } : { ok: false, error: 'invalid_payload' },
  applyCommand: (state, amount) => ({ accepted: true, changed: true, state: { count: state.count + amount } }),
  projectPublic: state => ({ count: state.count }),
  projectPrivate: () => null,
}

const phaseText: Record<LanJoinPhase, string> = {
  connecting: 'Conectando', verifying_host: 'Verificando anfitrião', joining: 'Ingressando',
  confirming_credential: 'Confirmando credencial', in_room: 'Na sala',
}
const errors: Record<string, string> = {
  invalid_invite: 'Este não é um convite LAN válido. Confira o texto completo.',
  incompatible_invite: 'Esta versão de convite LAN não é compatível.',
  invite_expired: 'Convite vencido. Peça ao anfitrião um QR atualizado.',
  invite_used: 'Convite já utilizado. Peça ao anfitrião um novo QR.',
  host_identity_mismatch: 'Código diferente. Confira presencialmente com o anfitrião.',
  admission_timeout: 'Tempo esgotado ao ingressar. Confira a conexão local.',
  admission_confirmation_timeout: 'A confirmação demorou. Tente retomar a sessão.',
  connection_lost: 'Conexão perdida. Tentando retomar a sessão.',
  room_closed: 'O anfitrião encerrou a sala.',
  resume_credential_not_found: 'Não foi possível retomar esta sessão neste aparelho.',
  invalid_resume: 'A retomada não foi aceita. Peça um novo convite.',
  lan_interface_unavailable: 'Nenhum endereço Wi-Fi ou hotspot local disponível.',
  certificate_mismatch: 'A identidade TLS do anfitrião é diferente do convite.',
}
function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : String(error)
  if (/pin|fingerprint|certificate|tls/i.test(code)) return errors.certificate_mismatch
  if (/timeout/i.test(code)) return 'Tempo esgotado. Confira o hotspot e tente novamente.'
  if (/connect|socket|network|unreachable/i.test(code)) return 'Endereço LAN inacessível. Confira Wi-Fi, hotspot, IP e porta.'
  return errors[code] ?? 'Não foi possível completar a operação LAN. Tente novamente.'
}

export function LanRoomScreen() {
  const [mode, setMode] = useState<'choice' | 'host' | 'guest'>('choice')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [rawInvite, setRawInvite] = useState('')
  const [invite, setInvite] = useState<LanInvite | null>(null)
  const [qr, setQr] = useState('')
  const [address, setAddress] = useState('')
  const [hostCode, setHostCode] = useState('')
  const [guestCode, setGuestCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [hostMembers, setHostMembers] = useState<Array<{ playerId: string; connected: boolean }>>([])
  const [playerId, setPlayerId] = useState('')
  const [hostPlayerId, setHostPlayerId] = useState('')
  const [count, setCount] = useState(0)
  const [scanner, setScanner] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const host = useRef<LanRoomHost<TestState, number, TestPublic, TestPrivate> | null>(null)
  const session = useRef<LanRoomSession<TestPublic, TestPrivate> | null>(null)
  const bootstrap = useRef<LanRoomBootstrap<TestPublic, TestPrivate> | null>(null)
  const comparison = useRef<((value: string) => void) | null>(null)
  const generation = useRef(0)
  const busy = useRef(false)

  const updateInvite = useCallback((next: LanInvite) => {
    setInvite(next)
    const raw = encodeLanInvite(next)
    setRawInvite(raw)
    void QRCode.toString(raw, { type: 'svg', margin: 2, width: 288 })
      .then(svg => setQr(`data:image/svg+xml,${encodeURIComponent(svg)}`))
      .catch(() => setQr(''))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = host.current
      if (!active) return
      const current = active.currentInvite
      if (current && current.capability !== invite?.capability) updateInvite(current)
      setPlayers(active.localSnapshot()?.roomState.playerIds.slice() ?? [])
      setHostMembers(active.localMembers())
      setCount(active.localSnapshot()?.gamePublicState.count ?? 0)
      if (current && current.expiresAt - Date.now() < 5_000 && !busy.current) {
        busy.current = true
        void active.refreshInvite().then(updateInvite).catch(reason => setError(errorText(reason)))
          .finally(() => { busy.current = false })
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [invite?.capability, updateInvite])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!host.current || busy.current) return
      void new LanNativeHost().discoverLanAddress().then(found => {
        if (!host.current || (found.ip === address && qr) || busy.current) return
        busy.current = true
        setAddress(found.ip)
        void host.current.refreshInvite(found.ip).then(updateInvite).catch(reason => setError(errorText(reason)))
          .finally(() => { busy.current = false })
      }).catch(() => { setError(errors.lan_interface_unavailable); setQr('') })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [address, qr, updateInvite])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const reason = session.current?.lastClosureReason
      if (reason === 'room_closed') { setStatus('Sala encerrada'); setError(errors.room_closed); return }
      if (reason === 'connection_lost' && bootstrap.current && !busy.current && status === 'Na sala') {
        setStatus('Conexão perdida')
        void retryResume(3)
      }
    }, 700)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => () => {
    generation.current++
    comparison.current?.('')
    void session.current?.disconnect()
    void host.current?.stop()
  }, [])

  async function startHost() {
    setError(''); setStatus('Preparando sala')
    const epoch = ++generation.current
    let coordinator: LanRoomHost<TestState, number, TestPublic, TestPrivate> | null = null
    try {
      const found = await new LanNativeHost().discoverLanAddress()
      const roomId = `room-${crypto.randomUUID()}`
      coordinator = new LanRoomHost(new AuthoritativeRoomRuntime({ roomId, adapter }), new LanNativeHost())
      const next = await coordinator.start(roomId, found.ip)
      if (epoch !== generation.current) { await coordinator.stop(); return }
      const local = coordinator.joinLocal()
      host.current = coordinator
      setAddress(found.ip)
      setHostCode(coordinator.hostCode())
      setPlayers(local.snapshot.roomState.playerIds.slice())
      setHostMembers(coordinator.localMembers())
      setHostPlayerId(local.playerId)
      setCount(local.snapshot.gamePublicState.count)
      updateInvite(next)
      setStatus('Sala aberta')
      setMode('host')
    } catch (reason) {
      await coordinator?.stop().catch(() => undefined)
      setStatus('Não foi possível criar a sala')
      setError(errorText(reason))
    }
  }

  async function refreshHost() {
    const active = host.current
    if (!active || busy.current) return
    busy.current = true
    try {
      const found = await new LanNativeHost().discoverLanAddress()
      setAddress(found.ip)
      updateInvite(await active.refreshInvite(found.ip))
      setError('')
    } catch (reason) { setError(errorText(reason)) }
    finally { busy.current = false }
  }

  function validateInvite(raw: string): LanInvite | null {
    const decoded = decodeLanInvite(raw.trim())
    if (!decoded.ok) {
      setError(raw.trim().startsWith('galerows-lan-v1:') ? errorText(new Error(decoded.error))
        : 'Este não é um convite LAN. O QR da Adedonha usa outro formato.')
      return null
    }
    setError('')
    return decoded.invite
  }

  async function join(raw: string) {
    const parsed = validateInvite(raw)
    if (!parsed) return
    setScanner(false)
    setMode('guest')
    setShowCode(false)
    setEnteredCode('')
    const epoch = ++generation.current
    const active = new LanRoomSession<TestPublic, TestPrivate>()
    session.current = active
    try {
      const joined = await active.connectInvite(parsed, () => new Promise<string>(resolve => {
        comparison.current = resolve
        setGuestCode(parsed.fingerprint.slice(0, 12).toUpperCase().match(/.{4}/g)?.join('-') ?? '')
        setShowCode(true)
      }), phase => { if (epoch === generation.current) setStatus(phaseText[phase]) })
      if (epoch !== generation.current) { await active.disconnect(); return }
      bootstrap.current = joined
      setPlayerId(joined.playerId)
      joined.transport.subscribe(message => {
        if ('roomState' in message) {
          setPlayers(message.roomState.playerIds.slice())
          setCount(message.gamePublicState.count)
        }
      })
      setPlayers(joined.snapshot.roomState.playerIds.slice())
      setCount(joined.snapshot.gamePublicState.count)
      setShowCode(false)
    } catch (reason) {
      if (epoch !== generation.current) return
      setShowCode(false)
      setStatus('Ingresso não concluído')
      setError(errorText(reason))
    }
  }

  async function retryResume(limit: number) {
    const previous = bootstrap.current
    if (!previous || busy.current) return
    busy.current = true
    const epoch = generation.current
    for (let attempt = 1; attempt <= limit && epoch === generation.current; attempt++) {
      setAttempts(attempt)
      setStatus(`Retomando (${attempt}/${limit})`)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      if (epoch !== generation.current) break
      const next = new LanRoomSession<TestPublic, TestPrivate>()
      session.current = next
      try {
        const joined = await next.resume(previous.snapshot.roomId, previous.playerId, previous.replica)
        if (epoch !== generation.current) { await next.disconnect(); break }
        bootstrap.current = joined
        joined.transport.subscribe(message => {
          if ('roomState' in message) {
            setPlayers(message.roomState.playerIds.slice())
            setCount(message.gamePublicState.count)
          }
        })
        setPlayers(joined.snapshot.roomState.playerIds.slice())
        setCount(joined.snapshot.gamePublicState.count)
        setStatus('Na sala'); setError(''); setAttempts(0)
        busy.current = false
        return
      } catch (reason) {
        setError(errorText(reason))
        if (/credential_not_found|invalid_resume|room_closed/.test(reason instanceof Error ? reason.message : '')) break
      }
    }
    if (epoch === generation.current) setStatus('Retomada indisponível')
    busy.current = false
  }

  async function disconnectOnly() {
    generation.current++
    comparison.current?.('')
    comparison.current = null
    await session.current?.disconnect()
    session.current = null
    setShowCode(false)
    setStatus('Você saiu da conexão')
    setError('')
  }

  async function leaveDefinitively() {
    const active = session.current
    if (!active || !playerId || busy.current) return
    busy.current = true
    generation.current++
    setStatus('Confirmando saída')
    setError('')
    try {
      await active.leaveRoom()
      session.current = null
      bootstrap.current = null
      setPlayerId('')
      setStatus('Você saiu da sala')
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'revocation_failed') {
        setStatus('Saída não concluída')
        setError('O anfitrião não confirmou a revogação. Tente sair novamente.')
      } else {
        await active.disconnect().catch(() => undefined)
        session.current = null
        bootstrap.current = null
        setPlayerId('')
        setStatus('Saída não confirmada neste aparelho')
        setError('Peça um novo convite se precisar ingressar novamente.')
      }
    } finally { busy.current = false }
  }

  async function stopHost() {
    generation.current++
    await host.current?.stop()
    host.current = null
    setInvite(null); setQr(''); setConfirmStop(false); setStatus('Sala encerrada'); setMode('choice')
  }

  async function incrementTest() {
    const roomId = host.current?.currentInvite?.roomId ?? bootstrap.current?.snapshot.roomId
    const id = host.current ? hostPlayerId : playerId
    if (!roomId || !id) return
    const command = { protocolVersion: PROTOCOL_VERSION, roomId, playerId: id,
      commandId: crypto.randomUUID(), type: 'testIncrement', payload: 1 }
    try {
      if (host.current) {
        const result = host.current.processLocalCommand(command)
        if (result.status !== 'accepted') throw new Error(result.error ?? 'command_rejected')
        setCount(host.current.localSnapshot()?.gamePublicState.count ?? 0)
      } else await bootstrap.current?.transport.sendCommand(command)
    } catch (reason) { setError(errorText(reason)) }
  }

  const button = 'rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40'
  return <main className="min-h-dvh bg-slate-950 px-5 py-8 text-white">
    <div className="mx-auto max-w-xl space-y-6">
      <header><p className="text-sm font-bold uppercase tracking-widest text-yellow-300">Galerows · LAN experimental</p>
        <h1 className="mt-2 text-3xl font-black">Salas LAN</h1><p className="mt-2 text-slate-300">Conecte dois Androids na mesma rede Wi-Fi ou hotspot.</p></header>
      {status && <p className="rounded-xl bg-slate-800 p-3" role="status">{status}</p>}
      {error && <p className="rounded-xl bg-rose-950 p-3 text-rose-100" role="alert">{error}</p>}
      {mode === 'choice' && <div className="grid gap-3"><button className={button} onClick={() => void startHost()}>Criar sala de teste</button>
        <button className={button} onClick={() => setMode('guest')}>Entrar em sala</button></div>}
      {mode === 'host' && <section className="space-y-4 rounded-3xl bg-slate-900 p-5" aria-label="Sala do anfitrião">
        <h2 className="text-xl font-black">Convite da sala</h2>
        {qr && invite ? <img alt="QR do convite LAN" className="mx-auto rounded-xl bg-white p-2" src={qr} /> : <p>Sem endereço LAN disponível. Confira o hotspot.</p>}
        <p>Código presencial: <strong className="text-yellow-300">{hostCode}</strong></p>
        <p className="text-sm text-slate-300">Mostre este código presencialmente ao convidado. Ele não está no QR.</p>
        <p>Endereço: {address}:{invite?.port ?? '—'}</p>
        <p>Válido até: {invite ? new Date(invite.expiresAt).toLocaleTimeString('pt-BR') : '—'}</p>
        <label className="block">Convite LAN completo<textarea readOnly aria-label="Convite LAN completo" className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-xs" rows={5} value={invite && qr ? rawInvite : ''} /></label>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={!qr} onClick={() => void navigator.clipboard.writeText(rawInvite).catch(() => setError('Não foi possível copiar. Selecione o texto.'))}>Copiar convite</button>
          <button className={button} onClick={() => void refreshHost()}>Renovar convite</button></div>
        <h3 className="font-bold">Participantes ({hostMembers.length})</h3><ul>{hostMembers.map((member, index) => <li key={member.playerId}>{index === 0 ? 'Anfitrião' : `Convidado ${index}`} · {member.connected ? 'conectado' : 'desconectado'}</li>)}</ul>
        <p>Contador: {count}</p><button className={button} onClick={() => void incrementTest()}>Incrementar contador de teste</button>
        {!confirmStop ? <button className="rounded-xl border border-rose-300 px-4 py-2" onClick={() => setConfirmStop(true)}>Encerrar sala</button>
          : <div className="flex gap-3"><button className="rounded-xl bg-rose-600 px-4 py-2" onClick={() => void stopHost()}>Confirmar encerramento</button>
            <button onClick={() => setConfirmStop(false)}>Cancelar</button></div>}
      </section>}
      {mode === 'guest' && <section className="space-y-4 rounded-3xl bg-slate-900 p-5" aria-label="Sala do convidado">
        {!playerId && <><h2 className="text-xl font-black">Entrar com convite LAN</h2>
          <button className={button} onClick={() => setScanner(true)}>Ler QR pela câmera</button>
          <label className="block">Convite LAN completo<textarea aria-label="Convite LAN completo" className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-xs" rows={5} value={rawInvite} onChange={event => setRawInvite(event.target.value)} /></label>
          <button className={button} onClick={() => void join(rawInvite)}>Continuar</button></>}
        {showCode && <div className="space-y-3 rounded-xl border border-yellow-300 p-4">
          <p>Canal TLS verificado. Compare presencialmente este código com a tela do anfitrião:</p>
          <strong className="block text-2xl tracking-wider text-yellow-300">{guestCode}</strong>
          <label className="block">Código visto no anfitrião<input aria-label="Código visto no anfitrião" autoComplete="off" className="mt-2 w-full rounded-xl bg-slate-800 p-3" value={enteredCode} onChange={event => setEnteredCode(event.target.value)} /></label>
          <button className={button} onClick={() => { comparison.current?.(enteredCode.trim().toUpperCase()); comparison.current = null }}>Confirmar código presencial</button>
        </div>}
        {playerId && <><h2 className="text-xl font-black">{status}</h2><p>Participantes: {players.length}</p>
          <p>Contador: {count}</p>
          {status === 'Na sala' && <button className={button} onClick={() => void incrementTest()}>Incrementar contador de teste</button>}
          {attempts > 0 && <p>Tentativa {attempts} de 3</p>}
          {(status === 'Retomada indisponível' || status === 'Você saiu da conexão') && <button className={button} onClick={() => void retryResume(1)}>Tentar retomar</button>}</>}
        {playerId && <button className="rounded-xl border border-rose-300 px-4 py-2" disabled={status === 'Confirmando saída'} onClick={() => void leaveDefinitively()}>Sair definitivamente</button>}
        {(playerId || showCode) && <button className="rounded-xl border border-white/40 px-4 py-2" onClick={() => void disconnectOnly()}>{showCode ? 'Cancelar ingresso' : 'Desconectar e retomar'}</button>}
      </section>}
      {scanner && <LanQrScanner onClose={() => setScanner(false)} onScan={raw => { setScanner(false); setRawInvite(raw); void join(raw) }} />}
    </div>
  </main>
}
