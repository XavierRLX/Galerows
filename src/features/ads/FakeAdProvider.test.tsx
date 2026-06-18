import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { usePremiumStore } from '../premium/premium.store'
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
  usePremiumStore.setState({ isPremium: false, snapshot: null })
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
    await vi.dynamicImportSettled()
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('FakeAdProvider', () => {
  it('skips the fake ad before navigating from the Hub game list while ads are temporarily disabled', async () => {
    vi.useRealTimers()
    renderAppAt('/')

    fireEvent.click(screen.getAllByRole('button', { name: /jogar agora/i })[0])
    await flushAsyncWork()

    expect(screen.queryByRole('dialog', { name: /espaço reservado para anúncio/i })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument())
  })

  it('skips the fake ad after setup validation while ads are temporarily disabled', async () => {
    vi.useRealTimers()
    renderAppAt('/games/quem-sou-eu/setup')
    await flushAsyncWork()

    fireEvent.change(screen.getByRole('textbox', { name: /palavra 1/i }), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar/i }))
    await flushAsyncWork()

    expect(screen.queryByRole('dialog', { name: /espaço reservado para anúncio/i })).not.toBeInTheDocument()
    expect(screen.getByText(/prepare a testa/i)).toBeInTheDocument()
  })

  it('does not show a fake ad automatically on play routes', () => {
    renderAppAt('/games/quem-sou-eu/play')

    expect(screen.queryByRole('dialog', { name: /espaço reservado para anúncio/i })).not.toBeInTheDocument()
  })

  it('skips fake ads for premium users', async () => {
    usePremiumStore.setState({ isPremium: true })
    renderAppAt('/')

    fireEvent.click(screen.getAllByRole('button', { name: /jogar agora/i })[0])
    await flushAsyncWork()

    expect(screen.queryByRole('dialog', { name: /espaço reservado para anúncio/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nem Ferrando', level: 1 })).toBeInTheDocument()
  })
})
