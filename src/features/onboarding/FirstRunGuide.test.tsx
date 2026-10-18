import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeI18n } from '../../i18n'
import { FirstRunGuide } from './FirstRunGuide'
import { hasCompletedGuide, markGuideComplete } from './guide.service'

vi.mock('../privacy/privacy.service', () => ({
  hasSeenCurrentPrivacyNotice: vi.fn().mockResolvedValue(true),
}))
vi.mock('./guide.service', () => ({
  hasCompletedGuide: vi.fn().mockResolvedValue(false),
  markGuideComplete: vi.fn().mockResolvedValue(undefined),
}))

beforeAll(async () => { await initializeI18n() })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('first-use guide', () => {
  it('explains three modes and can be skipped without navigating away from games', async () => {
    vi.mocked(hasCompletedGuide).mockResolvedValue(false)
    render(<MemoryRouter initialEntries={['/']}><FirstRunGuide /></MemoryRouter>)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1 celular')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer local')).toBeInTheDocument()
    expect(screen.getByText('Minha Galera')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pular' }))
    expect(markGuideComplete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not interrupt a game or a returning user', () => {
    vi.mocked(hasCompletedGuide).mockResolvedValue(true)
    render(<MemoryRouter initialEntries={['/games/cidade-dorme/play']}><FirstRunGuide /></MemoryRouter>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
