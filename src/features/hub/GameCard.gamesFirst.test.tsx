import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { getGameById } from '../games/games.registry'
import { GameCard } from './GameCard'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())

describe('games-first poster card', () => {
  it.each(['impostor-da-palavra', 'cidade-dorme', 'pista-unica'])('shows shared-device and real multiplayer capability for %s', (id) => {
    render(<MemoryRouter><GameCard game={getGameById(id)!} /></MemoryRouter>)
    expect(screen.getByText('1 celular')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer')).toBeInTheDocument()
    expect(screen.queryByText('Multiplayer em breve')).not.toBeInTheDocument()
  })

  it('labels Adedonha as a personal sheet, not an available LAN session', () => {
    render(<MemoryRouter><GameCard game={getGameById('adedonha')!} /></MemoryRouter>)
    expect(screen.getByText('1 por pessoa')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer em breve')).toBeInTheDocument()
  })

  it('uses the entire illustrated poster as the only game-opening button', async () => {
    const user = userEvent.setup()
    const game = getGameById('impostor-da-palavra')!
    const { container } = render(<MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<GameCard game={game} />} />
        <Route path="/games/impostor-da-palavra" element={<h1>Informações do Impostor</h1>} />
      </Routes>
    </MemoryRouter>)
    const card = container.querySelector('.hub-game')
    expect(card?.querySelector('.hub-game-art img')).toHaveAttribute('src', game.coverImage)
    const hitArea = screen.getByRole('button', { name: 'Jogar agora Impostor da Palavra' })
    expect(hitArea).toHaveClass('hub-card-hit-area')
    expect(card?.querySelectorAll('button')).toHaveLength(1)
    await user.click(hitArea)
    expect(await screen.findByRole('heading', { name: 'Informações do Impostor' })).toBeInTheDocument()
  })

  it('keeps unimplemented games visible but unplayable', () => {
    render(<MemoryRouter><GameCard game={getGameById('damas')!} /></MemoryRouter>)
    const unavailable = screen.getByRole('button', { name: 'Em breve Damas' })
    expect(unavailable).toHaveClass('hub-card-hit-area')
    expect(unavailable).toBeDisabled()
  })
})
