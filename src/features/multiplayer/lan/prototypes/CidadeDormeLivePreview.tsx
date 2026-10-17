import { useState } from 'react'
import { CidadeDormeImmersiveRound } from '../lobby/CidadeDormeImmersiveRound'
import { CidadeDormePreviewRoom } from './cidadeDormePreviewRoom'

function startRoom(count: number) {
  const room = new CidadeDormePreviewRoom()
  for (let index = 1; index < count; index++) room.joinNext()
  room.roomCommand('host', 'SELECT_GAME', { gameId: 'cidade-dorme' })
  room.roomCommand('host', 'CONFIGURE_GAME', {
    enableDoctor: count > 4, enableDetective: count > 4,
    enableJester: false, revealRoleOnDeath: false,
  })
  room.playerIds().forEach(id => room.roomCommand(id, 'READY', { ready: true }))
  room.roomCommand('host', 'START_GAME')
  return room
}

/** Development harness for the production component and authoritative reducer. No network traffic. */
export default function CidadeDormeLivePreview() {
  const [room, setRoom] = useState(() => startRoom(8))
  const [actor, setActor] = useState('host')
  const [connected, setConnected] = useState(true)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [revision, refresh] = useState(0)
  const [error, setError] = useState('')
  const snapshot = room.snapshot(actor)
  void revision
  function send(type: string, payload: unknown = null, scope: 'room' | 'game' = 'game') {
    const result = scope === 'game' ? room.gameCommand(actor, type, payload) : room.roomCommand(actor, type, payload)
    setError(result.status === 'accepted' ? '' : `Comando ${type}: ${result.error ?? 'não aceito'}`)
    refresh(value => value + 1)
  }
  function others() {
    const state = room.gameState()
    if (state.step === 'reveal') {
      room.playerIds().filter(id => id !== actor).forEach(id => room.gameCommand(id, 'ACK_ROLE'))
    } else if (state.step === 'voting') room.simulateRemainingVotes(actor)
    else room.simulateCurrentAction(actor)
    refresh(value => value + 1); setToolsOpen(false)
  }
  function result() {
    const next = startRoom(4)
    next.playerIds().forEach(id => next.gameCommand(id, 'ACK_ROLE'))
    next.gameCommand('host', 'START_NIGHT')
    next.simulateCurrentAction()
    next.gameCommand('host', 'START_DISCUSSION')
    next.gameCommand('host', 'START_VOTE')
    next.simulateRemainingVotes()
    next.gameCommand('host', 'RESOLVE_VOTE')
    if (next.gameState().step === 'summary') next.roomCommand('host', 'END_GAME')
    setRoom(next); setActor('host'); setError(''); setToolsOpen(false)
  }
  function restart(count: number) {
    setRoom(startRoom(count)); setActor('host'); setConnected(true); setError(''); setToolsOpen(false)
  }
  const playing = snapshot.roomState.phase === 'playing' || snapshot.roomState.phase === 'results'
  return <>
    {playing ? <CidadeDormeImmersiveRound snapshot={snapshot} playerId={actor} isHost={actor === 'host'}
      busy={false} connected={connected} error={error} onAction={(type, payload) => send(type, payload)}
      onEnd={() => send('END_GAME', null, 'room')} onBackToLobby={() => send('RETURN_TO_LOBBY', null, 'room')}
      onReplay={() => send('REPLAY_GAME', null, 'room')} onReconnect={() => setConnected(true)}
      onLeave={() => setConnected(false)} onClose={() => setConnected(false)}/>
      : <main style={{ padding: 30, background: '#07131f', color: '#f5f0e8', minHeight: '100dvh' }}>
        <h1>A mesma sala continua aberta.</h1><p>Esta é uma prévia local do componente real.</p>
        <button onClick={() => restart(8)}>Recomeçar com 8 pessoas</button></main>}
    <button type="button" onClick={() => setToolsOpen(value => !value)} style={{ position: 'fixed', zIndex: 80,
      left: 7, bottom: 5, padding: '5px 8px', border: '1px solid #e7c99788', borderRadius: 7,
      color: '#e7c997', background: '#0b1c2b', fontSize: 10 }}>LAB · sem LAN</button>
    {toolsOpen && <aside role="dialog" aria-label="Controles da prévia" style={{ position: 'fixed', zIndex: 81,
      inset: 'auto 10px 35px', maxWidth: 420, maxHeight: '70dvh', overflowY: 'auto', margin: 'auto',
      padding: 16, display: 'grid', gap: 8, background: '#102333', border: '1px solid #e7c997', color: '#f5f0e8' }}>
      <strong>Componente real · participantes simulados</strong>
      <button onClick={others}>Simular ação dos demais</button>
      <button onClick={result}>Ensaiar resultado de 4 pessoas</button>
      <button onClick={() => { setActor(actor === 'host' ? 'guest-1' : 'host'); setToolsOpen(false) }}>
        Ver como {actor === 'host' ? 'Ana' : 'anfitrião'}</button>
      <button onClick={() => { setConnected(value => !value); setToolsOpen(false) }}>Alternar conexão</button>
      <button onClick={() => restart(4)}>Recomeçar com 4 pessoas</button>
      <button onClick={() => restart(12)}>Recomeçar com 12 pessoas</button>
      <button onClick={() => setToolsOpen(false)}>Fechar</button>
    </aside>}
  </>
}
