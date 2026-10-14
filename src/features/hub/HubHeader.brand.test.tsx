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
  it('uses the landing lettering and subtitle in the heading, with the lime-G mark in the background', () => {
    const { container } = renderHeader()
    expect(screen.getByRole('heading', { level: 1, name: 'Galerows — Jogos da Galera' })).toBeInTheDocument()
    const mark = container.querySelector('.hub-header-panel > img[aria-hidden="true"]')
    expect(mark).toHaveAttribute('src', '/assets/brand/galerows-mark.svg')
    expect(mark).toHaveAttribute('alt', '')
    const headingWordmark = screen.getByRole('heading', { name: 'Galerows — Jogos da Galera' }).querySelector('img')
    expect(headingWordmark).toHaveAttribute('src', '/assets/brand/galerows-wordmark.svg')
    expect(headingWordmark).toHaveAttribute('alt', '')
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

  it('uses existing Galerows brand accents for the group, trophy and settings actions', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: 'Minha Galera' })).toHaveClass('text-[#B8A0FF]')
    expect(screen.getByRole('button', { name: 'Ranking da Galera' })).toHaveClass('text-[#D2F86A]')
    expect(screen.getByRole('button', { name: 'Abrir configurações' })).toHaveClass('text-[#FFA9B9]')
  })
  it('places three shortcuts outside and below the brand banner, with players left and ranking/settings right', () => {
    const { container } = renderHeader()
    const banner = container.querySelector('.hub-header-panel')
    const nav = screen.getByRole('navigation', { name: 'Atalhos do Galerows' })
    expect(banner).not.toContainElement(nav)
    expect(nav).toHaveClass('justify-between')
    expect(nav.querySelectorAll('button')).toHaveLength(3)
    const [players, rightSide] = Array.from(nav.children)
    expect(players?.querySelector('button')).toHaveAttribute('aria-label', 'Minha Galera')
    expect(Array.from(rightSide?.querySelectorAll('button') ?? []).map((button) => button.getAttribute('aria-label')))
      .toEqual(['Ranking da Galera', 'Abrir configurações'])
    expect(banner).not.toBeNull()
    expect(((banner?.compareDocumentPosition(nav) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
  })

  it('uses solid-color icons with transparent, borderless touch targets', () => {
    renderHeader()
    for (const label of ['Minha Galera', 'Ranking da Galera', 'Abrir configurações']) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toHaveClass('border-0', 'bg-transparent', 'shadow-none')
      expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    }
  })

})
