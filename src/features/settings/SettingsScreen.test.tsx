import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeI18n } from '../../i18n'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../../lib/capacitor/app', () => ({
  getInstalledAppDetails: vi.fn().mockResolvedValue({ version: '1.0.6', build: '11', platform: 'android' }),
}))
vi.mock('../../lib/capacitor/playStore', () => ({
  canUseNativeAndroidPlayStore: () => true,
  PlayStore: { openPlayStoreListing: vi.fn() },
}))
vi.mock('./settings.store', () => ({
  useSettingsStore: () => ({ locale: 'pt-BR', setLocale: vi.fn() }),
}))
vi.mock('../content/contentAdmin', () => ({ contentAdminEnabled: false }))

beforeAll(async () => { await initializeI18n() })
afterEach(cleanup)

describe('Settings — Sobre e suporte', () => {
  it('shows installed Android version/build and opens a safe prefilled support email', async () => {
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>)

    expect(await screen.findByText('1.0.6')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('Android')).toBeInTheDocument()
    expect(screen.getByText(/mesma rede Wi-Fi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avaliar na Play Store' })).toBeInTheDocument()
    const feedback = screen.getByRole('link', { name: 'Enviar feedback ou relatar problema' })
    expect(feedback).toHaveAttribute('href', expect.stringContaining('mailto:galerowsjdg@gmail.com?'))
    expect(decodeURIComponent(feedback.getAttribute('href')!)).toContain('1.0.6')
    expect(decodeURIComponent(feedback.getAttribute('href')!)).toContain('11')
  })
})
