import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

vi.mock('./landing.config', () => ({ storeLinks: { apple: undefined, google: undefined } }))
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('landing visitor experience', () => {
  it('keeps branding, catalog images and privacy within the Pages subpath', () => {
    vi.stubEnv('BASE_URL', '/Galerows/')
    const { container } = render(<LandingPage />)
    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('src')).toMatch(/^\/Galerows\/assets\//)
    }
    expect(screen.getByRole('link', { name: /política de privacidade/i })).toHaveAttribute('href', '/Galerows/privacy.html')
  })

  it('does not send visitors to unpublished stores or browser games', () => {
    render(<LandingPage />)
    for (const store of ['App Store', 'Google Play']) {
      for (const button of screen.getAllByRole('button', { name: `${store}: download em breve` })) {
        expect(button).toBeDisabled()
      }
    }
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href')?.startsWith('/games/'))).toBe(false)
    expect(screen.getByRole('link', { name: /política de privacidade/i })).toHaveAttribute('href', '/privacy.html')
  })

  it('lets visitors filter the real catalog and return to all games', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)
    await user.click(screen.getByRole('button', { name: 'Dedução & mistério' }))
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Impostor da Palavra', 'Última Pista', 'Cidade Dorme'])
    expect(screen.getByRole('status')).toHaveTextContent('3 jogos para descobrir')
    await user.click(screen.getByRole('button', { name: 'Todos os jogos' }))
    expect(screen.getAllByRole('article')).toHaveLength(10)
  })

  it('closes the mobile menu when a destination is chosen', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Os jogos' }))
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})
