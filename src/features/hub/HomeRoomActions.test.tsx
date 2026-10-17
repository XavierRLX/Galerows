import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeRoomActions } from './HomeRoomActions'

afterEach(() => cleanup())

function Destination() {
  const location = useLocation()
  return <p>Destino: {location.pathname}</p>
}

describe('experimental LAN entry actions', () => {
  it('navigates directly to discovery', async () => {
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

  it('navigates directly to the create route', async () => {
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
    expect(screen.getByRole('heading', { name: 'Sala multiplayer' })).toBeInTheDocument()
    expect(screen.getByText(/cada pessoa joga no próprio celular/i)).toBeInTheDocument()
  })
})

it('lets the host choose hotspot before the direct create action', async () => {
  const { RoomSessionContext } = await import('../multiplayer/lan/lobby/RoomSessionContext')
  const setPreferHotspot = vi.fn()
  const session = { mode: 'entry', preferHotspot: false, setPreferHotspot } as unknown as import('../multiplayer/lan/lobby/RoomSessionProvider').RoomSession
  render(<MemoryRouter><RoomSessionContext.Provider value={session}><HomeRoomActions /></RoomSessionContext.Provider></MemoryRouter>)
  await userEvent.click(screen.getByText('Opções de rede'))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Usar hotspot deste celular' }))
  expect(setPreferHotspot).toHaveBeenCalledWith(true)
})
