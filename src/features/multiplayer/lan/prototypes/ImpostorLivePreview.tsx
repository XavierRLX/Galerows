import { useState } from 'react'
import { ImpostorImmersiveRound } from '../lobby/ImpostorImmersiveRound'
import { createImpostorPreviewRoom } from './impostorPreviewRoom'

// The production component and authoritative reducer, with simulated peers only.
export default function ImpostorLivePreview() {
  const [lab, setLab] = useState(() => createImpostorPreviewRoom(12))
  const [actor, setActor] = useState(0)
  const [connected, setConnected] = useState(true)
  const [tools, setTools] = useState(false)
  const [lobby, setLobby] = useState(false)
  const [revision, refresh] = useState(0)
  const [error, setError] = useState('')
  const snapshot = lab.view(actor)
  function send(type: string, payload: unknown = null, scope: 'room' | 'game' = 'game') {
    try { lab.send(actor, type, payload, scope); setError('') }
    catch (failure) { setError(String(failure)) }
    refresh(revision + 1)
  }
  function others() {
    const pub = lab.publicState()
    lab.players.forEach((_, i) => {
      if (i === actor) return
      if (pub.step === 'reveal') lab.send(i, 'ACK_BRIEFING')
      if (pub.step === 'voting' && !lab.privateState(i).hasVoted) {
        const target = pub.runoffCandidates?.[0] ?? lab.players[1].id
        lab.send(i, 'VOTE', { playerId: target })
      }
    })
    refresh(revision + 1); setTools(false)
  }
  function rehearseResult() {
    const next = createImpostorPreviewRoom(12)
    const word = next.privateState(0).word!
    next.players.forEach((_, i) => next.send(i, 'ACK_BRIEFING'))
    next.send(0, 'START_VOTING')
    next.players.forEach((_, i) => next.send(i, 'VOTE', { playerId: next.players[1].id }))
    next.send(1, 'GUESS_WORD', { word })
    next.send(0, 'END_GAME', null, 'room')
    setLab(next); setActor(0); setLobby(false); setConnected(true); setTools(false); setError('')
  }
  function restart(count: number) {
    setLab(createImpostorPreviewRoom(count)); setActor(0); setLobby(false); setConnected(true); setTools(false); setError('')
  }
  return <>
    {lobby ? <div style={{ padding: 30 }}><h1>Retorno ao lobby confirmado</h1><p>O comando real retornou a mesma Room para o lobby.</p><button onClick={() => restart(12)}>Recomeçar prévia</button></div>
      : <ImpostorImmersiveRound key={`${snapshot.gamePublicState?.gameSessionId}:${lab.players.length}`} snapshot={snapshot}
        playerId={lab.players[actor].id} isHost={actor === 0} busy={false} connected={connected} error={error}
        onAction={(type, payload) => send(type, payload)} onEnd={() => send('END_GAME', null, 'room')}
        onBackToLobby={() => { send('RETURN_TO_LOBBY', null, 'room'); setLobby(true) }}
        onReplay={() => send('REPLAY_GAME', null, 'room')} onReconnect={() => setConnected(true)}
        onLeave={() => setLobby(true)} onClose={() => setLobby(true)} />}
    <button type="button" onClick={() => setTools(!tools)} style={{ position: 'fixed', left: 5, bottom: 4, zIndex: 50, padding: '4px 8px', color: '#b8a0ff', background: '#191222', border: '1px solid #b8a0ff55', borderRadius: 7, fontSize: 9 }}>LAB · sem rede</button>
    {tools && <div role="dialog" aria-label="Controles da prévia" style={{ position: 'fixed', inset: 'auto 12px 32px', zIndex: 60, margin: 'auto', maxWidth: 440, padding: 20, border: '1px solid #b8a0ff', borderRadius: 18, background: '#21172f', display: 'grid', gap: 12 }}>
      <strong>Componente real · participantes simulados</strong><p style={{ fontSize: 12 }}>Esta prévia não conecta outros celulares.</p>
      <button onClick={others}>Simular ações dos demais</button>
      <button onClick={rehearseResult}>Ensaiar resultado com 12 jogadores</button>
      <button onClick={() => { setActor(actor === 0 ? 1 : 0); setTools(false) }}>Ver como {actor === 0 ? 'Ana' : 'Renan (host)'}</button>
      <button onClick={() => { setConnected(!connected); setTools(false) }}>Alternar conexão</button>
      <button onClick={() => restart(3)}>Reiniciar com 3 jogadores</button><button onClick={() => restart(12)}>Reiniciar com 12 jogadores</button>
      <button onClick={() => setTools(false)}>Fechar laboratório</button>
    </div>}
  </>
}
