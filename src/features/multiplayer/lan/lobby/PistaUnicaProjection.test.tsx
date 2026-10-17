import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AuthoritativeRoomRuntimeV2, RoomLifecycleAdapter } from '../../persistentRoom'
import { pistaUnicaLanGame, type PistaUnicaLanPrivate, type PistaUnicaLanPublic } from '../../pistaUnicaLanGame'
import { PistaUnicaLanRound } from './PistaUnicaLanRound'

afterEach(cleanup)
function room(size = 3) {
  let n = 0
  const runtime = new AuthoritativeRoomRuntimeV2({ roomId: 'workshop', hostPlayerId: 'host', hostConnectionId: 'hc', adapter: new RoomLifecycleAdapter([pistaUnicaLanGame]), createPlayerId: () => `guest${++n}`, random: () => 0, clock: { now: () => 1000 } })
  const players = [{ id: 'host', conn: 'hc' }]
  for (let i = 1; i < size; i++) { const conn = `c${i}`; const joined = runtime.joinGuest(conn); if (!joined.ok) throw Error('join'); players.push({ id: joined.playerId, conn }) }
  const snapshot = (id: string) => { const player = players.find(p => p.id === id)!; const view = runtime.snapshotFor(id, player.conn); if (!view.ok) throw Error('snapshot'); return view.snapshot }
  const send = (id: string, type: string, payload: unknown = null, scope: 'room' | 'game' = 'game') => {
    const view = snapshot(id)
    const result = runtime.processCommand({ protocolVersion: 2, roomId: 'workshop', scope, playerId: id, clientSeq: view.nextClientSeq, commandId: crypto.randomUUID(), type, payload, ...(scope === 'game' ? { gameSessionId: view.roomState.currentGameSessionId! } : {}) }, players.find(p => p.id === id)!.conn)
    expect(result.result.status).toBe('accepted')
  }
  send('host', 'SELECT_GAME', { gameId: 'pista-unica' }, 'room'); send('host', 'CONFIGURE_GAME', { categories: ['words'] }, 'room')
  players.forEach(p => send(p.id, 'READY', { ready: true }, 'room')); send('host', 'START_GAME', null, 'room')
  const data = () => snapshot('host').gamePublicState!.data as PistaUnicaLanPublic
  const writers = () => players.filter(p => p.id !== data().guesserId)
  const target = () => (snapshot(writers()[0]!.id).privateState!.data as PistaUnicaLanPrivate).target!
  const write = () => writers().forEach((p, i) => send(p.id, 'SUBMIT_CLUE', { text: `Pista ${i + 1}` }))
  const props = (id: string) => ({ snapshot: snapshot(id), playerId: id, isHost: id === 'host', busy: false, connected: true, onAction: (type: string, payload: unknown) => send(id, type, payload), onEnd: () => send(id, 'END_GAME', null, 'room'), onBackToLobby: () => send(id, 'BACK_TO_LOBBY', null, 'room') })
  return { runtime, players, snapshot, send, data, writers, target, write, props }
}
it('uses real projections for host-guesser privacy, guest-reviewer controls, and host-reviewer next round', () => {
  const r = room(); r.write()
  const host = render(<PistaUnicaLanRound {...r.props('host')} />)
  expect(screen.queryByText('Pista 1')).not.toBeInTheDocument()
  expect(screen.queryByText(r.target())).not.toBeInTheDocument()
  expect(screen.getByText(/Nesta rodada você adivinha/)).toBeInTheDocument()
  host.unmount()
  const review = render(<PistaUnicaLanRound {...r.props('guest1')} />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByText('Pista 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pistas' }))
  expect(r.data().step).toBe('guessing')
  review.unmount()
  const guess = render(<PistaUnicaLanRound {...r.props('host')} />)
  fireEvent.change(screen.getByLabelText('Meu palpite'), { target: { value: r.target() } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar palpite' }))
  expect(r.data().scores).toEqual({ host: 2, guest1: 1, guest2: 1 })
  guess.unmount(); r.send('host', 'NEXT_ROUND'); r.write()
  const reviewer = render(<PistaUnicaLanRound {...r.props('host')} />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByRole('button', { name: /Remover pista de Anfitrião/ })).toBeInTheDocument()
  reviewer.unmount()
  render(<PistaUnicaLanRound {...r.props('guest2')} />)
  expect(screen.queryByText('Pista 1')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Abrir revisão privada' })).not.toBeInTheDocument()
})
it('pages all eleven real writer cards and disables actions through busy, offline and reconnect boundaries', () => {
  const r = room(12); r.write()
  const ui = render(<PistaUnicaLanRound {...r.props('guest1')} />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  for (let i = 1; i < 11; i++) fireEvent.click(screen.getByRole('button', { name: 'Revisão: próxima carta' }))
  expect(screen.getByText('Pista 11')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisão: próxima carta' })).toBeDisabled()
  ui.rerender(<PistaUnicaLanRound {...r.props('guest1')} busy />)
  expect(screen.getByRole('button', { name: 'Confirmar pistas' })).toBeDisabled()
  ui.rerender(<PistaUnicaLanRound {...r.props('guest1')} connected={false} />)
  expect(screen.queryByText('Pista 11')).not.toBeInTheDocument()
  ui.rerender(<PistaUnicaLanRound {...r.props('guest1')} />)
  expect(screen.queryByText('Pista 1')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir revisão privada' }))
  expect(screen.getByText('Pista 1')).toBeInTheDocument()
})
it('finishes duplicate-only rounds at zero, commits once at END_GAME and leaves guest waiting in the existing room', async () => {
  const r = room()
  for (let round = 0; round < 3; round++) {
    r.writers().forEach(p => r.send(p.id, 'SUBMIT_CLUE', { text: 'Iguais' }))
    expect(r.data().step).toBe('round-result')
    if (round === 0) {
      const zero = render(<PistaUnicaLanRound {...r.props('host')} />)
      expect(screen.getByText('0 pontos nesta rodada')).toBeInTheDocument()
      expect(screen.queryByLabelText('Meu palpite')).not.toBeInTheDocument()
      zero.unmount()
    }
    r.send('host', 'NEXT_ROUND')
  }
  const end = render(<PistaUnicaLanRound {...r.props('host')} />)
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar partida e pontuar' }))
  expect(r.snapshot('host').roomState.phase).toBe('playing')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar encerramento' })))
  expect(r.snapshot('host').roomState.phase).toBe('results')
  end.unmount()
  render(<PistaUnicaLanRound {...r.props('guest1')} />)
  expect(screen.queryByRole('button', { name: 'Voltar à sala' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Finalizar partida e pontuar' })).not.toBeInTheDocument()
  expect(r.snapshot('guest1').roomId).toBe('workshop')
})
