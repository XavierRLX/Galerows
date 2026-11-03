import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeI18n } from '../../i18n'
import { gamesRegistry } from '../games/games.registry'
import { GameCoverflow } from './GameCoverflow'

const games = gamesRegistry.filter(game => game.status === 'available').slice(0, 5)
const renderCarousel = (shown = games) => render(
  <MemoryRouter>
    <GameCoverflow games={shown} getBadges={() => []} isFavorite={() => false} onOpenGame={vi.fn()} />
  </MemoryRouter>,
)

beforeAll(async () => { await initializeI18n() })
afterEach(cleanup)

describe('GameCoverflow', () => {
  it('shows one playable featured card and quick-access previews', () => {
    renderCarousel()
    expect(screen.getByRole('heading', { name: games[0].name })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Jogar agora / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: `Selecionar ${games[1].name}` })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Selecionar / })).toHaveLength(games.length)
    expect(screen.queryByRole('button', { name: 'Mostrar todos os jogos' })).not.toBeInTheDocument()
  })

  it('wraps around the catalog in both directions without repeating the selected game', async () => {
    const user = userEvent.setup()
    renderCarousel()
    await user.click(screen.getByRole('button', { name: 'Jogo anterior' }))
    expect(screen.getByRole('heading', { name: games[4].name })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próximo jogo' }))
    expect(screen.getByRole('heading', { name: games[0].name })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Jogar agora / })).toHaveLength(1)
  })

  it('supports keyboard and swipe gesture without changing the mode filters', async () => {
    renderCarousel()
    const carousel = screen.getByRole('region', { name: 'Carrossel de jogos' })
    fireEvent.keyDown(carousel, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: games[1].name })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId(`coverflow-card-${games[1].id}`).style.transform).toContain('translate3d(0.00px')
    }, { timeout: 2000 })
    const stage = carousel.querySelector('.hub-coverflow-stage')!
    fireEvent.pointerDown(stage, { clientX: 260, clientY: 160, pointerType: 'touch' })
    fireEvent.pointerUp(stage, { clientX: 70, clientY: 162, pointerType: 'touch' })
    expect(screen.getByRole('heading', { name: games[2].name })).toBeInTheDocument()
    fireEvent.pointerDown(stage, { clientX: 150, clientY: 80, pointerType: 'touch' })
    fireEvent.pointerUp(stage, { clientX: 153, clientY: 190, pointerType: 'touch' })
    expect(screen.getByRole('heading', { name: games[2].name })).toBeInTheDocument()
  })

  it('selects directly from mini previews with the full catalog always exposed', async () => {
    const user = userEvent.setup()
    renderCarousel()
    await user.click(screen.getByRole('button', { name: `Selecionar ${games[3].name}` }))
    expect(screen.getByRole('heading', { name: games[3].name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Selecionar ${games[3].name}` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /^Selecionar / })).toHaveLength(games.length)
    expect(screen.queryByRole('button', { name: 'Recolher jogos' })).not.toBeInTheDocument()
  })

  it('keeps the same card DOM node moving between front and side positions', async () => {
    const user = userEvent.setup()
    renderCarousel()
    const persistentCard = screen.getByTestId(`coverflow-card-${games[0].id}`)
    await user.click(screen.getByRole('button', { name: 'Próximo jogo' }))
    expect(screen.getByTestId(`coverflow-card-${games[0].id}`)).toBe(persistentCard)
    expect(screen.getAllByRole('button', { name: /^Jogar agora / })).toHaveLength(1)
  })

  it('renders one dynamic pagination dot per game and supports direct selection', async () => {
    const user = userEvent.setup()
    renderCarousel()
    expect(screen.getAllByRole('button', { name: /^Ir para / })).toHaveLength(games.length)
    const dot = screen.getByRole('button', { name: `Ir para ${games[3].name}` })
    await user.click(dot)
    expect(dot).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { name: games[3].name })).toBeInTheDocument()
  })

  it('does not cancel a slide transition when the player taps its play button', async () => {
    const onOpenGame = vi.fn()
    const user = userEvent.setup()
    render(<MemoryRouter><GameCoverflow games={games} getBadges={() => []} isFavorite={() => false} onOpenGame={onOpenGame} /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Próximo jogo' }))
    await user.click(screen.getByRole('button', { name: `Jogar agora ${games[1].name}` }))
    await waitFor(() => expect(onOpenGame).toHaveBeenCalledWith(games[1].id))
  })

  it('handles one-game filters without duplicate slides or inactive navigation', () => {
    renderCarousel([games[0]])
    expect(screen.queryByRole('button', { name: 'Jogo anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo jogo' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Jogar agora / })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Mostrar todos os jogos' })).not.toBeInTheDocument()
  })
})
