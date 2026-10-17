import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createImpostorPreviewRoom } from '../prototypes/impostorPreviewRoom'
import { ImpostorImmersiveRound } from './ImpostorImmersiveRound'
import { LobbyRoomView } from './LobbyRoomView'

afterEach(() => { cleanup(); vi.useRealTimers() })
function mount(count = 12, legacy = false) {
  vi.useFakeTimers()
  const lab = createImpostorPreviewRoom(count, {
    impostorMode: 'no-word', conversationMode: 'guided-questions',
    ...(legacy ? {} : { flow: 'individual-vote' as const, timerSeconds: 120 as const, scoringMode: 'individual' as const }),
  })
  act(() => vi.advanceTimersByTime(4000))
  let actor = 0
  let connected = true
  const end = vi.fn(() => lab.send(0, 'END_GAME', null, 'room'))
  const back = vi.fn(() => lab.send(0, 'RETURN_TO_LOBBY', null, 'room'))
  const replay = vi.fn(() => lab.send(0, 'REPLAY_GAME', null, 'room'))
  const action = vi.fn((type: string, payload: unknown) => lab.send(actor, type, payload))
  function element() {
    return <ImpostorImmersiveRound snapshot={lab.view(actor)} playerId={lab.players[actor].id}
      isHost={actor === 0} connected={connected} busy={false} onAction={action} onEnd={end}
      onBackToLobby={back} onReplay={replay} onClose={vi.fn()} onLeave={vi.fn()} onReconnect={vi.fn()} />
  }
  const view = render(element())
  const update = () => view.rerender(element())
  function revealEveryone() {
    lab.players.forEach((_, i) => lab.send(i, 'ACK_BRIEFING'))
    update()
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a conversa' }))
  }
  return { lab, ...view, update, action, end, back, replay, revealEveryone,
    actor: (value: number) => { actor = value; update() },
    connection: (value: boolean) => { connected = value; update() },
  }
}

describe('Impostor mobile scenes with the real Room authority', () => {
  it('waits for authoritative acknowledgments, then moves to a separate conversation and shared timer', () => {
    const sim = mount()
    expect(screen.getByRole('button', { name: 'Ir para a conversa' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Revelar minha informação' }))
    sim.update()
    expect(sim.lab.publicState().seenCount).toBe(1)
    expect(screen.getByRole('button', { name: 'Ir para a conversa' })).toBeDisabled()
    sim.revealEveryone()
    expect(screen.queryByRole('heading', { name: 'Identidade protegida' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Conduzir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar cronômetro' }))
    sim.update()
    expect(sim.lab.publicState().timerStartedAt).not.toBeNull()
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByRole('timer')).toHaveTextContent('01:59')
    fireEvent.click(screen.getByRole('button', { name: 'Minha informação' }))
    expect(screen.queryByText(sim.lab.privateState(0).word!)).not.toBeInTheDocument()
  })

  it('paginates 12 candidates without losing selection; completes a real vote, guess, scoring and replay', () => {
    const sim = mount()
    sim.revealEveryone()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir votação para todos' }))
    sim.update()
    const suspects = screen.getByRole('group', { name: 'Escolher suspeito' })
    expect(within(suspects).getAllByRole('button')).toHaveLength(4)
    fireEvent.click(within(suspects).getByRole('button', { name: /Ana/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Suspeitos: próximos' }))
    expect(screen.queryByRole('button', { name: /^Ana/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar voto em Ana' }))
    sim.update()
    expect(screen.getByText('Voto confirmado.')).toBeInTheDocument()
    for (let i = 1; i < 12; i++) sim.lab.send(i, 'VOTE', { playerId: sim.lab.players[1].id })
    sim.update()
    expect(sim.lab.publicState().step).toBe('final-guess')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    sim.actor(1)
    fireEvent.change(screen.getByLabelText('Qual era a palavra?'), { target: { value: 'qualquer palavra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar palpite' }))
    sim.update()
    expect(sim.lab.publicState().step).toBe('summary')
    expect(screen.getByRole('heading', { name: 'Vitória da galera!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pontos da rodada' }))
    expect(within(screen.getByRole('region', { name: 'Pontos da rodada' })).getAllByRole('listitem')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Placar: próximos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Placar: próximos' }))
    expect(screen.getByText('Gabriel')).toBeInTheDocument()
    sim.actor(0)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pontuação' }))
    sim.update()
    expect(sim.lab.view().roomState.phase).toBe('results')
    const oldSession = sim.lab.view().roomState.currentGameSessionId
    fireEvent.click(screen.getByRole('button', { name: 'Jogar novamente' }))
    sim.update()
    expect(sim.lab.view().roomState.currentGameSessionId).not.toBe(oldSession)
    expect(sim.lab.publicState().step).toBe('reveal')
    expect(screen.queryByText(sim.lab.privateState(0).word!)).not.toBeInTheDocument()
  })

  it('keeps an offline guest from submitting a ballot and masks secrets after reconnecting', () => {
    const sim = mount()
    sim.actor(2)
    fireEvent.click(screen.getByRole('button', { name: 'Revelar minha informação' }))
    const secret = sim.lab.privateState(2).word!
    expect(screen.getByText(secret)).toBeInTheDocument()
    sim.connection(false)
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconectar' })).toBeInTheDocument()
    sim.connection(true)
    expect(screen.queryByText(secret)).not.toBeInTheDocument()
  })

  it('keeps legacy sessions in the full game screen and preserves clue, accusation and last-guess commands', () => {
    const sim = mount(3, true)
    sim.revealEveryone()
    fireEvent.click(screen.getByRole('button', { name: 'Começar pistas' }))
    sim.update()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Próxima pessoa' }))
      sim.update()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Escolher o acusado' }))
    sim.update()
    fireEvent.click(screen.getByRole('button', { name: 'Renan você' }))
    fireEvent.click(screen.getByRole('button', { name: 'Acusar Renan' }))
    sim.update()
    expect(screen.getByRole('textbox', { name: 'Qual era a palavra?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sem palpite' }))
    sim.update()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pontuação' }))
    sim.update()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar com todos ao lobby' }))
    expect(sim.lab.view().roomState.phase).toBe('lobby')
  })

  it('intercepts Android back before leaving the game and traps keyboard focus in the exit dialog', () => {
    mount()
    const event = new Event('galerows:back', { cancelable: true })
    fireEvent(window, event)
    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Encerrar sala?' })).toBeInTheDocument()
    const close = screen.getByRole('button', { name: 'Fechar menu' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Continuar no jogo' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('routes legacy sessions through the immersive surface instead of embedding them in the lobby', () => {
    const sim = mount(3, true)
    cleanup()
    render(<LobbyRoomView snapshot={sim.lab.view()} role="host" playerId="host" busy={false} connected status="Conectado"
      onSelect={vi.fn()} onConfigure={vi.fn()} onReady={vi.fn()} onStart={vi.fn()} onGameAction={vi.fn()}
      onGameCommand={vi.fn()} onEnd={vi.fn()} onBackToLobby={vi.fn()} onReconnect={vi.fn()} onLeave={vi.fn()} onClose={vi.fn()} onRefreshInvite={vi.fn()} />)
    expect(screen.getByTestId('impostor-immersive')).toBeInTheDocument()
    expect(screen.queryByTestId('pl03-lobby')).not.toBeInTheDocument()
  })
})
