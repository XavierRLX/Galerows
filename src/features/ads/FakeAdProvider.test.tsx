import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { FakeAdProvider } from './FakeAdProvider'

vi.mock('../../lib/capacitor/haptics', () => ({
  AppHaptics: {
    light: vi.fn(() => Promise.resolve()),
    medium: vi.fn(() => Promise.resolve()),
    success: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve()),
  },
}))

beforeAll(async () => { await initializeI18n() })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FakeAdProvider>
        <AppRoutes />
      </FakeAdProvider>
    </MemoryRouter>,
  )
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('FakeAdProvider', () => {
  it('shows a fake ad before navigating from the Hub game list', async () => {
    renderAppAt('/')

    fireEvent.click(screen.getAllByRole('button', { name: /jogar agora/i })[0])
    await flushAsyncWork()

    expect(screen.getByRole('dialog', { name: /espaço reservado para anúncio/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nem Ferrando', level: 1 })).not.toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(5000) })
    await flushAsyncWork()

    expect(screen.getByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument()
  })

  it('shows a fake ad after setup validation before opening play', async () => {
    renderAppAt('/games/quem-sou-eu/setup')

    fireEvent.change(screen.getByRole('textbox', { name: /palavra 1/i }), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar/i }))
    await flushAsyncWork()

    expect(screen.getByRole('dialog', { name: /espaço reservado para anúncio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(5000) })
    await flushAsyncWork()

    expect(screen.getByText(/prepare a testa/i)).toBeInTheDocument()
  })

  it('does not show a fake ad automatically on play routes', () => {
    renderAppAt('/games/quem-sou-eu/play')

    expect(screen.queryByRole('dialog', { name: /espaço reservado para anúncio/i })).not.toBeInTheDocument()
  })
})
