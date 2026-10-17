import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { getGameById } from '../games/games.registry'
import { GameCard } from './GameCard'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())

describe('games-first card navigation', () => {
  it.each(['impostor-da-palavra', 'cidade-dorme', 'pista-unica'])('shows both shared-device and local multiplayer for %s', (id) => {
    render(<MemoryRouter><GameCard game={getGameById(id)!} /></MemoryRouter>)
    expect(screen.getByText('1 celular')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer local')).toBeInTheDocument()
    expect(screen.queryByText('Multiplayer em breve')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cada um no seu celular/i })).not.toBeInTheDocument()
  })

  it('labels Adedonha as a personal sheet, not a shared-device LAN session', () => {
    render(<MemoryRouter><GameCard game={getGameById('adedonha')!} /></MemoryRouter>)
    expect(screen.getByText('1 por pessoa')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer em breve')).toBeInTheDocument()
  })

  it('lets newcomers open the existing game information screen', async () => {
    const user = userEvent.setup()
    const game = getGameById('impostor-da-palavra')!
    render(<MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<GameCard game={game} />} />
        <Route path="/games/impostor-da-palavra" element={<h1>Informações do Impostor</h1>} />
      </Routes>
    </MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Jogar agora Impostor da Palavra' }))
    expect(await screen.findByRole('heading', { name: 'Informações do Impostor' })).toBeInTheDocument()
  })

  it('keeps unimplemented games unplayable', () => {
    render(<MemoryRouter><GameCard game={getGameById('damas')!} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Conhecer Damas/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Em breve Damas/i })).toBeDisabled()
  })
})
