import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../i18n'
import { AppRoutes } from './routes'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())
describe('app navigation', () => {
  it('opens Nem Ferrando internally and returns to the Hub', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(within(screen.getByRole('heading', { name: 'Nem Ferrando' }).closest('div')!).getByRole('button', { name: /jogar agora/i }))
    expect(await screen.findByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /voltar/i }))
    expect(screen.getByRole('heading', { name: /jogos da galera/i })).toBeInTheDocument()
  })

  it('opens Impostor da Palavra internally', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    await user.click(within(screen.getByRole('heading', { name: 'Impostor da Palavra' }).closest('div')!).getByRole('button', { name: /jogar agora/i }))
    expect(await screen.findByRole('heading', { name: 'Impostor da Palavra', level: 1 })).toBeInTheDocument()
  })
})
