import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { HomeRoomActions } from './HomeRoomActions'

afterEach(() => cleanup())

function Destination() {
  const location = useLocation()
  return <p>Destino: {location.pathname}</p>
}

describe('experimental LAN entry actions', () => {
  it('opens the existing secure joining flow instead of pretending to discover rooms', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeRoomActions />} />
        <Route path="/__lan-lobby-v2/entrar" element={<Destination />} />
      </Routes>
    </MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Entrar em sala' }))
    expect(screen.getByText('Destino: /__lan-lobby-v2/entrar')).toBeInTheDocument()
  })

  it('opens the existing secure host setup instead of starting WSS automatically', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeRoomActions />} />
        <Route path="/__lan-lobby-v2/criar" element={<Destination />} />
      </Routes>
    </MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Criar sala' }))
    expect(screen.getByText('Destino: /__lan-lobby-v2/criar')).toBeInTheDocument()
  })

  it('does not advertise an active Room before a persistent owner exists', () => {
    render(<MemoryRouter><HomeRoomActions /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Voltar à sala/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jogar em rede local' })).toBeInTheDocument()
    expect(screen.getByText(/cada pessoa no seu celular/i)).toBeInTheDocument()
  })
})
