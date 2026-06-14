import { Plus, Settings2, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { createId } from '../../lib/utils/createId'
import { cn } from '../../lib/utils/cn'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import { useTabooStore } from './taboo.store'
import type { TabooConfig, TabooMode, TabooSkipLimit, TabooTeam } from './taboo.types'
import { useTabooInitialization } from './useTabooInitialization'

const durations: TabooConfig['turnDurationSeconds'][] = [30, 60, 90, 120]
const skipLimits: TabooSkipLimit[] = ['unlimited', 1, 3, 5]
const roundOptions = [1, 2, 3, 4, 5]

export function TabooSetupScreen() {
  const navigate = useNavigate()
  const { group, hydrated, load } = usePlayersStore()
  const start = useTabooStore((state) => state.start)
  const [mode, setMode] = useState<TabooMode>('individual')
  const [duration, setDuration] = useState<TabooConfig['turnDurationSeconds']>(60)
  const [rounds, setRounds] = useState(3)
  const [allowSkips, setAllowSkips] = useState(true)
  const [skipLimit, setSkipLimit] = useState<TabooSkipLimit>(3)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<TabooTeam[]>([])
  const [error, setError] = useState('')
  useTabooInitialization()
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
  const addTeam = () => {
    const name = normalizePlayerName(teamName)
    if (!name) { setError('Informe o nome do time.'); return }
    if (teams.some((team) => team.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { setError('Os times precisam ter nomes diferentes.'); return }
    setTeams((current) => [...current, { id: createId('taboo-team'), name }]); setTeamName(''); setError('')
  }
  const begin = async () => {
    const participants = [...selectedPlayers.map(playerToParticipant), ...guests]
    if (mode === 'individual' && (participants.length < 2 || participants.length > 12)) { setError('Selecione entre 2 e 12 jogadores.'); return }
    if (mode === 'teams' && teams.length < 2) { setError('Crie pelo menos 2 times.'); return }
    await start(participants, teams, { mode, turnDurationSeconds: duration, allowSkips, skipLimit, roundsPerEntity: rounds })
    navigate('/games/taboo/play')
  }
  const canStart = mode === 'individual' ? count >= 2 : teams.length >= 2
  return <div className="min-h-dvh pb-10"><Header backTo="/games/taboo" title="Configurar partida" /><section className="px-5 py-6">
    <Card className="p-5"><h2 className="text-lg font-black">Modo de jogo</h2><div className="mt-4 grid grid-cols-2 gap-3"><Button size="lg" variant={mode === 'individual' ? 'primary' : 'secondary'} onClick={() => setMode('individual')}>Individual</Button><Button size="lg" variant={mode === 'teams' ? 'primary' : 'secondary'} onClick={() => setMode('teams')}>Times</Button></div></Card>
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Rodadas</h2><p className="mt-1 text-sm text-slate-400">Cada jogador será o adivinhador uma vez por rodada.</p><div className="mt-4 grid grid-cols-5 gap-2">{roundOptions.map((item) => <Button className={cn(item === rounds && 'ring-2 ring-amber-300')} key={item} variant={item === rounds ? 'primary' : 'secondary'} onClick={() => setRounds(item)}>{item}</Button>)}</div></Card>
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Tempo por turno</h2><div className="mt-4 grid grid-cols-4 gap-2">{durations.map((item) => <Button className={cn(item === duration && 'ring-2 ring-amber-300')} key={item} variant={item === duration ? 'primary' : 'secondary'} onClick={() => setDuration(item)}>{item}s</Button>)}</div></Card>
    <Card className="mt-5 p-5"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-black">Permitir pulos</h2><button aria-pressed={allowSkips} className={cn('h-7 w-12 rounded-full p-1 transition', allowSkips ? 'bg-emerald-500' : 'bg-white/15')} onClick={() => setAllowSkips((current) => !current)} type="button"><span className={cn('block size-5 rounded-full bg-white transition', allowSkips && 'translate-x-5')} /></button></div><div className="mt-4 grid grid-cols-4 gap-2">{skipLimits.map((item) => <Button disabled={!allowSkips} key={String(item)} variant={item === skipLimit ? 'primary' : 'secondary'} onClick={() => setSkipLimit(item)}>{item === 'unlimited' ? 'Ilimitado' : item}</Button>)}</div></Card>
    {mode === 'individual' ? <section className="mt-5"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Jogadores</h1><p className="text-sm text-slate-400">{count}/12 selecionados</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />Minha Galera</Button></div>
      <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-emerald-400/10 text-emerald-300')} key={player.id} onClick={() => toggle(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>
      <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button></form>
      {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-emerald-400/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-emerald-300">convidado</small></span><Button size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    </section> : <section className="mt-5"><h1 className="text-2xl font-black">Times</h1><form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addTeam() }}><input aria-label="Nome do time" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Nome do time" value={teamName} onChange={(event) => setTeamName(event.target.value)} /><Button type="submit"><Plus size={18} />Adicionar</Button></form><Card className="mt-4 overflow-hidden">{teams.length ? teams.map((team, index) => <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 last:border-0" key={team.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}</span>{team.name}</span><Button size="icon" variant="ghost" onClick={() => setTeams((current) => current.filter((item) => item.id !== team.id))}><Trash2 size={17} /></Button></div>) : <div className="p-5 text-center text-sm text-slate-400">Adicione pelo menos 2 times.</div>}</Card></section>}
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full" disabled={!canStart} size="lg" onClick={() => void begin()}>Iniciar jogo</Button>
  </section></div>
}
