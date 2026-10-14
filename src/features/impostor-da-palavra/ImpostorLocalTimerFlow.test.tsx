import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { initializeI18n } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { STORAGE_KEYS } from '../../lib/storage/storage.keys'
import { usePlayersStore } from '../players/players.store'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'

beforeAll(async () => { await initializeI18n() })
beforeEach(async () => {
  for (const key of [STORAGE_KEYS.playerGroup, STORAGE_KEYS.impostorDaPalavraSession,
    STORAGE_KEYS.impostorDaPalavraOpeningHistory]) await LocalPreferences.remove(key)
  usePlayersStore.setState({ group: null, hydrated: false, error: null })
  useImpostorDaPalavraStore.setState({ deck: null, session: null, initialized: false, loading: false, resumeError: null })
})

describe('Impostor one-phone timer UX', () => {
  it('offers optional LAN-equivalent timer presets without changing the in-person accusation', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/impostor-da-palavra/setup']}><AppRoutes /></MemoryRouter>)
    const guest = await screen.findByRole('textbox', { name: /nome do convidado/i })
    for (const name of ['Ana', 'Bia', 'Caio']) {
      await user.type(guest, name)
      await user.click(screen.getByRole('button', { name: /adicionar/i }))
    }
    await user.click(screen.getByRole('button', { name: '3 minutos' }))
    await user.click(screen.getByRole('button', { name: /iniciar partida/i }))
    expect(useImpostorDaPalavraStore.getState().session?.config.timerSeconds).toBe(180)
    expect(useImpostorDaPalavraStore.getState().session?.timerStartedAt).toBeNull()

    for (let n = 0; n < 3; n++) {
      await user.click(await screen.findByRole('button', { name: /mostrar minha informação/i }))
      await user.click(screen.getByRole('button', { name: /esconder e passar/i }))
    }
    await user.click(await screen.findByRole('button', { name: /começar as pistas/i }))
    expect(await screen.findByRole('timer')).toBeInTheDocument()
    expect(screen.getByText(/tempo das pistas/i)).toBeInTheDocument()
    expect(useImpostorDaPalavraStore.getState().session?.timerStartedAt).toEqual(expect.any(Number))
  })
  it('conceals a local private identity after exactly five seconds and permits reopening it',async()=>{
    const user=userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/impostor-da-palavra/setup']}><AppRoutes /></MemoryRouter>)
    const input=await screen.findByRole('textbox',{name:/nome do convidado/i})
    for(const name of ['Lia','Caio','Nina']){
      await user.type(input,name)
      await user.click(screen.getByRole('button',{name:/adicionar/i}))
    }
    await user.click(screen.getByRole('button',{name:/iniciar partida/i}))
    const reveal=await screen.findByRole('button',{name:/mostrar minha informação/i})
    vi.useFakeTimers()
    try{
      fireEvent.click(reveal)
      expect(screen.getByRole('button',{name:/esconder e passar/i})).toBeInTheDocument()
      act(()=>vi.advanceTimersByTime(4999))
      expect(screen.getByRole('button',{name:/esconder e passar/i})).toBeInTheDocument()
      act(()=>vi.advanceTimersByTime(1))
      expect(screen.getByRole('button',{name:/mostrar minha informação/i})).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button',{name:/mostrar minha informação/i}))
      expect(screen.getByRole('button',{name:/esconder e passar/i})).toBeInTheDocument()
    }finally{vi.useRealTimers()}
  })

})
