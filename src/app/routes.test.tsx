import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../i18n'
import { AppRoutes } from './routes'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())
async function playGameFromHub(user: ReturnType<typeof userEvent.setup>, name: string) {
  // The complete quick-access grid is always visible; no expansion is required.
  await user.click(screen.getByRole('button', { name: `Selecionar ${name}` }))
  const play = await screen.findByRole('button', { name: `Jogar agora ${name}` })
  await waitFor(() => {
    expect(Number(play.closest<HTMLElement>('.hub-coverflow-item')?.style.getPropertyValue('--card-focus'))).toBeGreaterThan(.95)
  }, { timeout: 2000 })
  await user.click(play)
}
describe('app navigation', () => {
  it('keeps privacy information permanently accessible from settings', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/settings']}><AppRoutes /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /privacidade e dados/i }))
    expect(await screen.findByRole('heading', { name: /seus dados ficam com você/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /política de privacidade completa/i })).toHaveAttribute(
      'href',
      'https://xavierrlx.github.io/Galerows/privacy.html',
    )
    expect(screen.getByRole('button', { name: /apagar todos os dados/i })).toBeInTheDocument()
  })

  it('keeps premium entry points hidden while ads are temporarily disabled', async () => {
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /premium/i })).not.toBeInTheDocument()

    cleanup()
    render(<MemoryRouter initialEntries={['/premium']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /jogos da galera/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /jogue sem anúncios/i })).not.toBeInTheDocument()
  })

  it('opens Nem Ferrando internally and returns to the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Nem Ferrando')
    expect(await screen.findByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /voltar/i }))
    expect(screen.getByRole('heading', { name: /jogos da galera/i })).toBeInTheDocument()
  })

  it('opens Impostor da Palavra internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Impostor da Palavra')
    expect(await screen.findByRole('heading', { name: 'Impostor da Palavra', level: 1 })).toBeInTheDocument()
  })

  it('opens Quem Sou Eu internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Quem Sou Eu')
    expect(await screen.findByRole('heading', { name: 'Quem Sou Eu', level: 1 })).toBeInTheDocument()
  })

  it('opens Adedonha internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Adedonha')
    expect(await screen.findByRole('heading', { name: 'Adedonha', level: 1 })).toBeInTheDocument()
  })

  it('opens Mímica internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Mímica')
    expect(await screen.findByRole('heading', { name: 'Mímica', level: 1 })).toBeInTheDocument()
  })

  it('opens Cidade Dorme from the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Cidade Dorme')
    expect(await screen.findByRole('heading', { name: 'Cidade Dorme', level: 1 })).toBeInTheDocument()
  })

  it('opens Última Pista from the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await playGameFromHub(user, 'Última Pista')
    expect(await screen.findByRole('heading', { name: 'Última Pista', level: 1 })).toBeInTheDocument()
  })
})
