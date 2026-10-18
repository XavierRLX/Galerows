import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeI18n } from '../i18n'
import { AsyncErrorNotice, GlobalErrorBoundary } from './AppErrorBoundary'

vi.mock('../lib/capacitor/app', () => ({
  getInstalledAppDetails: vi.fn().mockResolvedValue({ version: '1.0.6', build: '11', platform: 'android' }),
}))

beforeAll(async () => { await initializeI18n() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Crash({ fail }: { fail: boolean }) {
  if (fail) throw new Error('private secret must not render')
  return <p>Jogo recuperado</p>
}

describe('safe global recovery', () => {
  it('recovers a render failure with repeated retries and no session deletion', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failure = { active: true }
    function FragileGame() { return <Crash fail={failure.active} /> }
    const { rerender } = render(
      <MemoryRouter initialEntries={['/games/pista-unica/play']}>
        <GlobalErrorBoundary><FragileGame /></GlobalErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/private secret/)).not.toBeInTheDocument()
    failure.active = false
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByText('Jogo recuperado')).toBeInTheDocument()
    failure.active = true
    rerender(<MemoryRouter initialEntries={['/games/pista-unica/play']}><GlobalErrorBoundary><FragileGame /></GlobalErrorBoundary></MemoryRouter>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('never offers retry that might auto-create a second LAN room', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<MemoryRouter initialEntries={['/__lan-lobby-v2/criar']}><GlobalErrorBoundary><Crash fail /></GlobalErrorBoundary></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Relatar problema/ })).toBeInTheDocument()
  })

  it('reports async failures non-destructively and can dismiss the notice', async () => {
    render(<MemoryRouter initialEntries={['/']}><AsyncErrorNotice /></MemoryRouter>)
    fireEvent(window, new Event('unhandledrejection', { cancelable: true }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dispensar aviso' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
