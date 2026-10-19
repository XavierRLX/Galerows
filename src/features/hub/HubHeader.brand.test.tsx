import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeI18n } from '../../i18n'
import { HubHeader } from './HubHeader'

const nativeLanAvailable = vi.hoisted(() => vi.fn(() => false))
vi.mock('../multiplayer/lan/lanPlatform', () => ({ lanNativeMvpAvailable: nativeLanAvailable }))

beforeAll(async () => { await initializeI18n() })
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  nativeLanAvailable.mockReturnValue(false)
})

const renderHeader = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HubHeader />} />
      <Route path="/players" element={<p>Grupo aberto</p>} />
      <Route path="/settings" element={<p>Configurações abertas</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('Hub header — game launcher', () => {
  it('keeps the official brand in a compact header with no marketing hero', () => {
    const { container } = renderHeader()
    const heading = screen.getByRole('heading', { level: 1, name: 'Galerows — Jogos da Galera' })
    expect(heading.querySelector('img')).toHaveAttribute('src', '/assets/brand/galerows-wordmark.svg')
    expect(heading.querySelector('img')).toHaveAttribute('alt', '')
    expect(container.querySelector('.hub-welcome')).not.toBeInTheDocument()
    expect(container.querySelector('.hub-mode-guide')).not.toBeInTheDocument()
  })

  it('shows an actionable Minha Galera banner explaining rooms and lobby', () => {
    const { container } = renderHeader()
    const shortcuts = screen.getByRole('navigation', { name: 'Atalhos do Galerows' })
    const groupButton = screen.getByRole('button', { name: 'Minha Galera' })
    expect(shortcuts.querySelectorAll('button')).toHaveLength(1)
    expect(groupButton).toHaveClass('hub-group-card')
    expect(groupButton).toHaveAttribute('aria-describedby', 'hub-group-hint')
    expect(screen.getByText('Jogadores • Salas em breve')).toBeInTheDocument()
    expect(screen.queryByText('Criar sala • Entrar em sala')).not.toBeInTheDocument()
    expect(container.querySelector('.hub-group-card')).toBe(groupButton)
  })

  it('shows create/join only on a native Android build with the lobby flags active', () => {
    vi.stubEnv('VITE_GAMES_FIRST_LAN_ENTRY', '1')
    vi.stubEnv('VITE_LAN_PERSISTENT_LOBBY_UI', '1')
    nativeLanAvailable.mockReturnValue(true)
    renderHeader()
    expect(screen.getByText('Criar sala • Entrar em sala')).toBeInTheDocument()
    expect(screen.queryByText('Jogadores • Salas em breve')).not.toBeInTheDocument()
  })

  it.each([
    ['Minha Galera', 'Grupo aberto'],
    ['Abrir configurações', 'Configurações abertas'],
  ])('preserves the %s navigation destination', async (label, destination) => {
    renderHeader()
    await userEvent.setup().click(screen.getByRole('button', { name: label }))
    expect(screen.getByText(destination)).toBeInTheDocument()
  })

  it('does not add disconnected room or ranking shortcuts', () => {
    renderHeader()
    expect(screen.queryByRole('button', { name: 'Criar sala' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar em sala' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ranking da Galera' })).not.toBeInTheDocument()
  })
})
