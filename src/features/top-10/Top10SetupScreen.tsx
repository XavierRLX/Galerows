import { Crown, ListChecks, Plus, Settings2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { useFakeAd } from '../ads/useFakeAd'
import { TeamRosterFields } from '../players/TeamRosterFields'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import { useTop10Store } from './top10.store'
import type { Top10Mode, Top10RoundsPerEntity, Top10Team } from './top10.types'
import { useTop10Initialization } from './useTop10Initialization'
import { useTop10Theme } from './useTop10Theme'

const roundOptions: Top10RoundsPerEntity[] = [1, 2, 3]

export function Top10SetupScreen() {
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const { group, hydrated, load } = usePlayersStore()
  const { deck, start } = useTop10Store()
  const [mode, setMode] = useState<Top10Mode>('individual')
  const [roundsPerEntity, setRoundsPerEntity] = useState<Top10RoundsPerEntity>(1)
  const [firstMediatorId, setFirstMediatorId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<Top10Team[]>([])
  const [error, setError] = useState('')
  useTop10Initialization()
  useTop10Theme()
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const participants = useMemo(() => [...selectedPlayers.map(playerToParticipant), ...guests], [guests, selectedPlayers])
  const mediatorOptions = mode === 'individual' ? participants : teams
  const effectiveFirstMediatorId = mediatorOptions.some((entity) => entity.id === firstMediatorId) ? firstMediatorId : ''
  const count = selectedPlayers.length + guests.length
  const assignedTeamMemberIds = useMemo(() => teams.flatMap((team) => team.memberIds), [teams])
  const teamsReady = teams.length >= 2 && participants.length >= 2
    && teams.every((team) => team.memberIds.length > 0)
    && assignedTeamMemberIds.length === participants.length
    && new Set(assignedTeamMemberIds).size === participants.length
  const toggle = (id: string) => setSelectedIds((current) => {
    if (current.includes(id)) return current.filter((item) => item !== id)
    return count < 12 ? [...current, id] : current
  })
  const addGuest = () => {
    const name = normalizePlayerName(guestName)
    if (!name) { setError('Informe o nome do convidado.'); return }
    const names = [...selectedPlayers.map((player) => player.name), ...guests.map((guest) => guest.name)].map((item) => item.toLocaleLowerCase('pt-BR'))
    if (names.includes(name.toLocaleLowerCase('pt-BR'))) { setError('Os jogadores precisam ter nomes diferentes.'); return }
    if (count >= 12) { setError('O limite é de 12 jogadores.'); return }
    setGuests((current) => [...current, createGuestParticipant(name)])
    setGuestName('')
    setError('')
  }
  const begin = async () => {
    if (mode === 'individual' && (participants.length < 2 || participants.length > 12)) { setError('Selecione entre 2 e 12 jogadores.'); return }
    if (mode === 'teams' && !teamsReady) { setError('Monte pelo menos 2 equipes e coloque cada jogador em uma delas.'); return }
    if (!effectiveFirstMediatorId) { setError('Selecione quem começa mediando.'); return }
    await start(participants, teams, { mode, roundsPerEntity, firstMediatorId: effectiveFirstMediatorId })
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/top-10/play')
  }
  const canStart = (mode === 'individual' ? count >= 2 : teamsReady) && Boolean(effectiveFirstMediatorId)
  return <div className="min-h-dvh pb-10"><Header backTo="/games/top-10" title="Configurar partida" /><section className="px-5 py-6">
    <Card className="p-5"><h2 className="text-lg font-black">Modo de jogo</h2><div className="mt-4 grid grid-cols-2 gap-3"><Button className={mode === 'individual' ? 'bg-[#991b1b] text-white hover:bg-[#b91c1c]' : ''} size="lg" variant={mode === 'individual' ? 'primary' : 'secondary'} onClick={() => setMode('individual')}>Individual</Button><Button className={mode === 'teams' ? 'bg-[#991b1b] text-white hover:bg-[#b91c1c]' : ''} size="lg" variant={mode === 'teams' ? 'primary' : 'secondary'} onClick={() => setMode('teams')}>Equipes</Button></div></Card>
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Rodadas por {mode === 'individual' ? 'jogador' : 'equipe'}</h2><p className="mt-1 text-sm text-slate-400">Cada {mode === 'individual' ? 'jogador' : 'equipe'} será mediador essa quantidade de vezes.</p><div className="mt-4 grid grid-cols-3 gap-2">{roundOptions.map((item) => <Button className={cn(item === roundsPerEntity && 'ring-2 ring-red-300 bg-[#991b1b] text-white hover:bg-[#b91c1c]')} key={item} variant={item === roundsPerEntity ? 'primary' : 'secondary'} onClick={() => setRoundsPerEntity(item)}><ListChecks size={16} />{item}</Button>)}</div>{deck ? <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{deck.cards.length} cartas disponíveis · cartas podem repetir se faltar baralho</p> : null}</Card>
    {mode === 'individual' ? <section className="mt-5"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Jogadores</h1><p className="text-sm text-slate-400">{count}/12 selecionados</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />Minha Galera</Button></div>
      <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-red-900/20 text-red-200')} key={player.id} onClick={() => toggle(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-red-300 bg-red-700 text-white' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>
      <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button className="bg-[#991b1b] text-white hover:bg-[#b91c1c]" type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button></form>
      {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-red-950/30 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-red-300">convidado</small></span><Button size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    </section> : <TeamRosterFields activeButtonClassName="bg-[#991b1b] text-white hover:bg-[#b91c1c]" guestName={guestName} guests={guests} players={group?.players ?? []} selectedClassName="bg-red-900/20 text-red-200" selectedIds={selectedIds} setError={setError} setGuestName={setGuestName} setGuests={setGuests} setSelectedIds={setSelectedIds} setTeamName={setTeamName} setTeams={setTeams} teamIdPrefix="top-10-team" teamLabel="time" teamLabelPlural="times" teamName={teamName} teams={teams} onManagePlayers={() => navigate('/players')} />}
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Quem começa mediando?</h2><p className="mt-1 text-sm text-slate-400">O mediador confere o gabarito e não pontua nessa rodada.</p>{mediatorOptions.length ? <div className="mt-4 grid gap-2">{mediatorOptions.map((entity) => <Button className={cn('justify-start', effectiveFirstMediatorId === entity.id && 'ring-2 ring-red-300 bg-[#991b1b] text-white hover:bg-[#b91c1c]')} key={entity.id} variant={effectiveFirstMediatorId === entity.id ? 'primary' : 'secondary'} onClick={() => { setFirstMediatorId(entity.id); setError('') }}><Crown size={18} />{entity.name}</Button>)}</div> : <p className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-slate-400">Adicione participantes para escolher o primeiro mediador.</p>}</Card>
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full bg-[#991b1b] text-white hover:bg-[#b91c1c]" disabled={!canStart} size="lg" onClick={() => void begin()}>Iniciar jogo</Button>
  </section></div>
}
