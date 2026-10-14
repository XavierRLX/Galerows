import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CidadeDormePrototype from './CidadeDormePrototype'

afterEach(() => { cleanup(); vi.useRealTimers() })

function createReadyRoom() {
  render(<CidadeDormePrototype />)
  fireEvent.click(screen.getByRole('button', { name: /criar sala de demonstração/i }))
  fireEvent.click(screen.getByRole('button', { name: /adicionar 3 jogadores simulados/i }))
  fireEvent.click(screen.getByRole('button', { name: /escolher cidade dorme/i }))
  fireEvent.click(screen.getByRole('button', { name: /salvar regras/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Estou pronto' }))
  fireEvent.click(screen.getByRole('button', { name: /simular prontos dos demais/i }))
}

describe('Cidade Dorme thematic prototype', () => {
  it('requires saved settings and every player ready; host may stop and restart the countdown', () => {
    vi.useFakeTimers()
    createReadyRoom()
    expect(screen.getByRole('timer')).toHaveTextContent('5')
    fireEvent.click(screen.getByRole('button', { name: /parar contagem/i }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /a cidade se reúne/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reiniciar contagem/i }))
    act(() => { vi.advanceTimersByTime(6_200) })
    expect(screen.getByRole('heading', { name: /descubra seu papel/i })).toBeInTheDocument()
  })

  it('keeps the secret covered until reveal and hides it when perspective changes', () => {
    vi.useFakeTimers()
    createReadyRoom()
    act(() => { vi.advanceTimersByTime(6_200) })
    expect(screen.queryByTestId('preview-role-name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /revelar meu papel/i }))
    expect(screen.getByTestId('preview-role-name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver como ana/i }))
    expect(screen.queryByTestId('preview-role-name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver como anfitrião/i }))
    expect(screen.queryByTestId('preview-role-name')).not.toBeInTheDocument()
  })
})
