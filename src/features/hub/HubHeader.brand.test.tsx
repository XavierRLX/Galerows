import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { HubHeader } from './HubHeader'

beforeAll(async () => { await initializeI18n() })
afterEach(cleanup)

const renderHeader = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HubHeader />} />
      <Route path="/players" element={<p>Grupo aberto</p>} />
      <Route path="/players/ranking" element={<p>Ranking aberto</p>} />
      <Route path="/settings" element={<p>Configurações abertas</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('Hub header — landing-page brand identity', () => {
  it('preserves the existing wordmark and explains in-person play', () => {
    renderHeader()
    const heading = screen.getByRole('heading', { level: 1, name: 'Galerows — Jogos da Galera' })
    expect(heading.querySelector('img')).toHaveAttribute('src', '/assets/brand/galerows-wordmark.svg')
    expect(heading.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.getByText('Jogos presenciais com amigos')).toBeInTheDocument()
  })

  it.each([
    ['Minha Galera', 'Grupo aberto'],
    ['Ranking da Galera', 'Ranking aberto'],
    ['Abrir configurações', 'Configurações abertas'],
  ])('keeps the accessible %s navigation action', async (label, destination) => {
    renderHeader()
    await userEvent.setup().click(screen.getByRole('button', { name: label }))
    expect(screen.getByText(destination)).toBeInTheDocument()
  })

  it('reveals the difference between a shared phone, personal sheets and local multiplayer', async () => {
    const { container } = renderHeader()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    await userEvent.setup().click(screen.getByText('Como vocês vão jogar?'))
    expect(container.querySelector('details')).toHaveAttribute('open')
    expect(screen.getByText(/Um celular guia a partida/)).toBeVisible()
    expect(screen.getByText(/Na Adedonha, cada pessoa usa sua folha digital/)).toBeVisible()
    expect(screen.getByText(/Joguem Impostor da Palavra, Cidade Dorme ou Pista Única/)).toBeVisible()
  })
})
