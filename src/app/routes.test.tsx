import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../i18n'
import { AppRoutes } from './routes'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())
describe('app navigation', () => {
  it('keeps premium entry points hidden while ads are temporarily disabled', async () => {
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /premium/i })).not.toBeInTheDocument()

    cleanup()
    render(<MemoryRouter initialEntries={['/premium']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /galerows/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /jogue sem anúncios/i })).not.toBeInTheDocument()
  })

  it('opens Nem Ferrando internally and returns to the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora nem ferrando/i }))
    expect(await screen.findByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /voltar/i }))
    expect(screen.getByRole('heading', { name: /galerows/i })).toBeInTheDocument()
  })

  it('opens Impostor da Palavra internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora impostor da palavra/i }))
    expect(await screen.findByRole('heading', { name: 'Impostor da Palavra', level: 1 })).toBeInTheDocument()
  })

  it('opens Quem Sou Eu internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora quem sou eu/i }))
    expect(await screen.findByRole('heading', { name: 'Quem Sou Eu', level: 1 })).toBeInTheDocument()
  })

  it('opens Adedonha internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora adedonha/i }))
    expect(await screen.findByRole('heading', { name: 'Adedonha', level: 1 })).toBeInTheDocument()
  })

  it('opens Mímica internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora mímica/i }))
    expect(await screen.findByRole('heading', { name: 'Mímica', level: 1 })).toBeInTheDocument()
  })

  it('opens Cidade Dorme from the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora cidade dorme/i }))
    expect(await screen.findByRole('heading', { name: 'Cidade Dorme', level: 1 })).toBeInTheDocument()
  })

  it('opens Última Pista from the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /jogar agora última pista/i }))
    expect(await screen.findByRole('heading', { name: 'Última Pista', level: 1 })).toBeInTheDocument()
  })
})
