import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { initializeI18n } from '../../i18n'
import { usePremiumStore } from './premium.store'
import { PremiumScreen } from './PremiumScreen'

beforeAll(async () => { await initializeI18n() })
afterEach(() => cleanup())

describe('PremiumScreen', () => {
  beforeEach(() => {
    usePremiumStore.setState({
      availability: 'unavailable',
      error: null,
      isPremium: false,
      loading: false,
      offering: { monthlyPackage: null, priceLabel: 'R$ 4,99' },
      purchasing: false,
      restoring: false,
      snapshot: null,
    })
  })

  it('shows the monthly subscription offer for free users', () => {
    render(<MemoryRouter><PremiumScreen /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /jogue sem anúncios/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /assinar por R\$ 4,99\/mês/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /restaurar compras/i })).toBeInTheDocument()
  })

  it('shows active status for premium users', () => {
    usePremiumStore.setState({ isPremium: true, snapshot: { status: 'premium', expiresAt: null, checkedAt: new Date().toISOString(), managementUrl: null } })

    render(<MemoryRouter><PremiumScreen /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /premium ativo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /atualizar status/i })).toBeInTheDocument()
  })
})
