import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImpostorPrototype from './ImpostorPrototype'

beforeEach(() => { window.scrollTo = vi.fn() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function mount(entry = '/__prototype/impostor-game') {
  return render(<MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/__prototype/impostor-room" element={<ImpostorPrototype screen="room"/>}/>
      <Route path="/__prototype/impostor-game" element={<ImpostorPrototype screen="game"/>}/>
      <Route path="/__prototype/impostor-result" element={<ImpostorPrototype screen="result"/>}/>
    </Routes>
  </MemoryRouter>)
}
function openLab() { fireEvent.click(screen.getByText('Explorar protótipo')) }
function simulateAllSeen() { openLab(); fireEvent.click(screen.getByText('Simular todos visualizaram')) }

describe('Operação Infiltrado prototype UX v2', () => {
  it('has no game logo or large name header and allows secret reread after everyone has seen', () => {
    const { container } = mount()
    expect(container.querySelector('.ip-header')).not.toBeInTheDocument()
    expect(screen.queryByText('Operação Infiltrado.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Ocultar informação'}))
    expect(screen.queryByText('Abacaxi')).not.toBeInTheDocument()
    simulateAllSeen()
    expect(screen.getByText('Todos visualizaram!')).toBeInTheDocument()
    expect(screen.getByText(/cada pessoa fala uma dica ou uma palavra/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/Ir para votação/})).toBeInTheDocument()
  })

  it('displays host-controlled voting while guests can still check their own identity', () => {
    mount()
    simulateAllSeen()
    fireEvent.click(screen.getByRole('button',{name:'Convidado'}))
    expect(screen.queryByRole('button',{name:/Ir para votação/})).not.toBeInTheDocument()
    expect(screen.getByText(/O anfitrião abre a votação/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Abacaxi')).toBeInTheDocument()
  })

  it('accepts a personal vote only once and waits for all votes before showing mocked result', () => {
    mount()
    simulateAllSeen()
    fireEvent.click(screen.getByRole('button',{name:/Ir para votação/}))
    const confirm = screen.getByRole('button',{name:/Escolha um suspeito/})
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Léo'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar voto em Léo'}))
    expect(screen.getByText('Voto confirmado.')).toBeInTheDocument()
    expect(screen.getByText('1 de 6 votos confirmados')).toBeInTheDocument()
    expect(screen.queryByRole('heading',{name:/Vitória da galera!/})).not.toBeInTheDocument()
    const waitPanel = screen.getByRole('status', {name:''})
    // The simulated remainder is deliberately available only in the prototype lab.
    expect(waitPanel).toHaveTextContent('1 de 6 votos confirmados')
    fireEvent.click(within(waitPanel).getByText('Explorar protótipo'))
    fireEvent.click(screen.getByText('Simular os demais votos e mostrar resultado'))
    expect(screen.getByRole('heading',{name:/Vitória da galera!/})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Voltar ao lobby/}))
    expect(screen.getByRole('heading',{name:'A galera tá na sala.'})).toBeInTheDocument()
  })

  it('preserves the alternate word disguise without identifying the impostor', () => {
    mount('/__prototype/impostor-game?mode=alternate-word')
    openLab()
    fireEvent.click(screen.getByRole('button',{name:'Impostor · Renan'}))
    fireEvent.click(screen.getByRole('button',{name:'Revelar minha informação'}))
    expect(screen.getByText('Manga')).toBeInTheDocument()
    expect(screen.queryByText('VOCÊ É O IMPOSTOR')).not.toBeInTheDocument()
  })
})
