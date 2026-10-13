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
  it('explains the available mode without claiming that LAN is playable', () => {
    render(<MemoryRouter><GameCard game={getGameById('impostor-da-palavra')!} /></MemoryRouter>)
    expect(screen.getByText('Jogar neste celular')).toBeInTheDocument()
    expect(screen.getByText('LAN em preparação')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cada um no seu celular/i })).not.toBeInTheDocument()
  })

  it('labels Adedonha as a personal sheet, not a shared-device LAN session', () => {
    render(<MemoryRouter><GameCard game={getGameById('adedonha')!} /></MemoryRouter>)
    expect(screen.getByText('Minha folha no celular')).toBeInTheDocument()
    expect(screen.getByText('LAN em preparação')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Conhecer Impostor da Palavra' }))
    expect(screen.getByRole('heading', { name: 'Informações do Impostor' })).toBeInTheDocument()
  })

  it('keeps unimplemented games unplayable', () => {
    render(<MemoryRouter><GameCard game={getGameById('damas')!} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Conhecer Damas/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Em breve Damas/i })).toBeDisabled()
  })
})
