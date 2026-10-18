import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../../i18n'
import { LanHelpScreen } from './LanHelpScreen'

beforeAll(async () => { await initializeI18n() })
afterEach(cleanup)

describe('multiplayer help', () => {
  it('explains Wi-Fi, hotspot, discovery, QR, six-digit invites, recovery and safe exit', () => {
    render(<MemoryRouter><LanHelpScreen /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Ajuda do multiplayer' })).toBeInTheDocument()
    expect(screen.getByText(/Criar uma sala/)).toBeInTheDocument()
    expect(screen.getByText(/Entrar em uma sala/)).toBeInTheDocument()
    expect(screen.getByText(/QR Code.*6 dígitos/)).toBeInTheDocument()
    expect(screen.getByText(/hotspot.*sem internet/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sala não aparece/i })).toBeInTheDocument()
    expect(screen.getByText(/conexão caiu/i)).toBeInTheDocument()
    expect(screen.getByText(/sair com segurança/i)).toBeInTheDocument()
  })
})
