import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LanCoreProbeScreen } from './LanCoreProbeScreen'

it('exposes a debug-only host and guest core probe without game UI', () => {
  render(<LanCoreProbeScreen />)
  expect(screen.getByRole('heading', { name: 'LAN Core Debug' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start core host' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Connect core guest' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send valid command' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Force gap and resync' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Drop guest socket' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Resume guest' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop core host' })).toBeInTheDocument()
})
