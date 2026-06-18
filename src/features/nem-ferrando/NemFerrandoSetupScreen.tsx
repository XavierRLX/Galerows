import { Plus, Settings2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { useFakeAd } from '../ads/useFakeAd'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import type { IronLimit } from './nemFerrando.types'
import { useNemFerrandoStore } from './nemFerrando.store'
import { useNemFerrandoInitialization } from './useNemFerrandoInitialization'

const limits: IronLimit[] = [10, 15, 20]
export function NemFerrandoSetupScreen() {
  const navigate = useNavigate(); const { group, hydrated, load } = usePlayersStore(); const start = useNemFerrandoStore((state) => state.start)
  const { showFakeAd } = useFakeAd()
  const [selectedIds, setSelectedIds] = useState<string[]>([]); const [guests, setGuests] = useState<GameParticipant[]>([]); const [guestName, setGuestName] = useState(''); const [limit, setLimit] = useState<IronLimit>(10); const [error, setError] = useState('')
  useNemFerrandoInitialization()
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const count = selectedPlayers.length + guests.length
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : count < 12 ? [...current, id] : current)
  const addGuest = () => {
    const name = normalizePlayerName(guestName)
    if (!name) { setError('Informe o nome do convidado.'); return }
    const names = [...selectedPlayers.map((player) => player.name), ...guests.map((guest) => guest.name)].map((item) => item.toLocaleLowerCase('pt-BR'))
    if (names.includes(name.toLocaleLowerCase('pt-BR'))) { setError('Os jogadores precisam ter nomes diferentes.'); return }
    if (count >= 12) { setError('O limite é de 12 jogadores.'); return }
    setGuests((current) => [...current, createGuestParticipant(name)]); setGuestName(''); setError('')
  }
  const begin = async () => {
    if (count < 2 || count > 12) { setError('Selecione entre 2 e 12 jogadores.'); return }
    const participants = [...selectedPlayers.map(playerToParticipant), ...guests]
    await start(participants, limit); await showFakeAd({ placement: 'start-match' }); navigate('/games/nem-ferrando/play')
  }
  return <div className="min-h-dvh pb-10"><Header backTo="/games/nem-ferrando" title="Configurar partida" /><section className="px-5 py-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Quem vai jogar?</h1><p className="text-sm text-slate-400">{count}/12 selecionados</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />Minha Galera</Button></div>
    <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-lime-400/10 text-lime-300')} key={player.id} onClick={() => toggle(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-lime-400 bg-lime-400 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>
    <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button></form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-violet-400/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-violet-300">convidado</small></span><Button size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">Limite de Ferros</h2><div className="mt-3 grid grid-cols-3 gap-2">{limits.map((item) => <Button className={cn(item === limit && 'ring-2 ring-orange-400')} key={item} variant={item === limit ? 'primary' : 'secondary'} onClick={() => setLimit(item)}>{item}</Button>)}</div>
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full" disabled={count < 2} size="lg" onClick={() => void begin()}>Iniciar partida</Button>
  </section></div>
}
