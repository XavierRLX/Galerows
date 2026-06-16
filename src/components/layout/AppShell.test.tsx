import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hideBanner, showBanner } from '../../features/ads/ads.service'
import { AppShell } from './AppShell'

vi.mock('../../features/ads/ads.service', () => ({
  hideBanner: vi.fn(() => Promise.resolve()),
  showBanner: vi.fn(() => Promise.resolve()),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>Hub</div>} />
          <Route path="/games/:gameId" element={<div>Game home</div>} />
          <Route path="/games/:gameId/setup" element={<div>Setup</div>} />
          <Route path="/games/:gameId/play" element={<div>Play</div>} />
          <Route path="/games/:gameId/result" element={<div>Result</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell ads placement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a test banner on game home screens', async () => {
    renderAt('/games/taboo')
    await waitFor(() => expect(showBanner).toHaveBeenCalledWith('game-home'))
  })

  it('shows a test banner on setup screens', async () => {
    renderAt('/games/taboo/setup')
    await waitFor(() => expect(showBanner).toHaveBeenCalledWith('setup'))
  })

  it('hides ads during play and result screens', async () => {
    renderAt('/games/taboo/play')
    await waitFor(() => expect(hideBanner).toHaveBeenCalled())

    vi.clearAllMocks()
    renderAt('/games/taboo/result')
    await waitFor(() => expect(hideBanner).toHaveBeenCalled())
    expect(showBanner).not.toHaveBeenCalled()
  })
})
