import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initializeI18n } from '../../i18n'
import { usePlayersStore } from '../players/players.store'
import { PistaUnicaSetupScreen } from './PistaUnicaSetupScreen'

beforeAll(async () => { await initializeI18n() })
afterEach(() => {
  cleanup()
  usePlayersStore.setState({ group: null, hydrated: false, error: null })
})
const playerName = (index: number) => `Jogador ${String(index).padStart(2, '0')}`
function showSetup(playerCount: number) {
  usePlayersStore.setState({
    hydrated: true, error: null,
    group: {
      schemaVersion: 1, id: 'group', name: 'Minha Galera', updatedAt: '2026-10-18T00:00:00Z',
      players: Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: playerName(i + 1) })),
    },
  })
  return render(<MemoryRouter initialEntries={['/setup']}><Routes>
    <Route path="/setup" element={<PistaUnicaSetupScreen />} />
    <Route path="/players" element={<p>Gerenciamento de jogadores</p>} />
  </Routes></MemoryRouter>)
}
function addGuest(name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome do convidado' }), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar convidado' }))
}

describe('Pista Única — seleção vertical de jogadores', () => {
  it('shows five players without pagination and updates individual selection, count and minimum', () => {
    showSetup(5)
    const list = screen.getByRole('region', { name: 'Jogadores da mesa' })
    for (let i = 1; i <= 5; i++) expect(within(list).getByRole('button', { name: playerName(i) })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Jogadores' })).not.toBeInTheDocument()
    expect(screen.getByText('0 / 12 selecionados')).toBeInTheDocument()
    const advance = screen.getByRole('button', { name: 'Escolher categorias' })
    expect(advance).toBeDisabled()
    for (let i = 1; i <= 3; i++) fireEvent.click(within(list).getByRole('button', { name: playerName(i) }))
    expect(screen.getByText('3 / 12 selecionados')).toBeInTheDocument()
    expect(advance).toBeEnabled()
    fireEvent.click(within(list).getByRole('button', { name: playerName(2) }))
    expect(screen.getByText('2 / 12 selecionados')).toBeInTheDocument()
    expect(advance).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    expect(screen.getByText('Gerenciamento de jogadores')).toBeInTheDocument()
  })

  it('selects every registered player and toggles back to none without changing guest data', () => {
    showSetup(5)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('5 / 12 selecionados')).toBeInTheDocument()
    for (let i = 1; i <= 5; i++) expect(screen.getByRole('button', { name: playerName(i) })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }))
    expect(screen.getByText('0 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher categorias' })).toBeDisabled()
  })

  it('caps a fully registered 12-player group and keeps the primary action accessible', () => {
    showSetup(12)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar convidado' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Escolher categorias' })).toBeEnabled()
    expect(screen.getByRole('region', { name: 'Jogadores da mesa' })).toBeInTheDocument()
  })

  it('bulk-selects the first available 12 of 15 registered players, then respects an existing individual choice', () => {
    showSetup(15)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    for (let i = 1; i <= 12; i++) expect(screen.getByRole('button', { name: playerName(i) })).toHaveAttribute('aria-pressed', 'true')
    for (let i = 13; i <= 15; i++) expect(screen.getByRole('button', { name: playerName(i) })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/limite de 12 participantes/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }))
    fireEvent.click(screen.getByRole('button', { name: playerName(15) }))
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: playerName(15) })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: playerName(12) })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reserves guest slots and does not clear guests when unselecting registered players', () => {
    showSetup(10)
    addGuest('Convidado A'); addGuest('Convidado B'); addGuest('Convidado C')
    expect(screen.getByText('3 / 12 selecionados')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: playerName(9) })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: playerName(10) })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }))
    expect(screen.getByText('3 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByText('Convidado A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remover Convidado A' }))
    expect(screen.getByText('2 / 12 selecionados')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: playerName(10) })).toHaveAttribute('aria-pressed', 'true')
  })

  it('prevents duplicate names between a guest and registered players in both bulk and individual selection', () => {
    showSetup(5)
    addGuest(playerName(1))
    fireEvent.click(screen.getByRole('button', { name: playerName(1) }))
    expect(screen.getByRole('button', { name: playerName(1) })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('alert')).toHaveTextContent('Este nome já está na partida.')
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('5 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: playerName(1) })).toHaveAttribute('aria-pressed', 'false')
    for (let i = 2; i <= 5; i++) expect(screen.getByRole('button', { name: playerName(i) })).toHaveAttribute('aria-pressed', 'true')
    addGuest(playerName(1))
    expect(screen.getByRole('alert')).toHaveTextContent('Este nome já está na partida.')
  })

  it('allows twelve guests with no bulk slots and prevents a thirteenth', () => {
    showSetup(1)
    for (let i = 1; i <= 12; i++) addGuest(`Convidado ${i}`)
    expect(screen.getByText('12 / 12 selecionados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar todos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar convidado' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Escolher categorias' })).toBeEnabled()
  })
})
