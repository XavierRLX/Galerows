import { Plus, Settings2, Trash2, UserPlus, Users } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { createId } from '../../lib/utils/createId'
import { createGuestParticipant, normalizePlayerName } from './players.model'
import type { GameParticipant, Player } from './players.types'

export type RosterTeam = {
  id: string
  name: string
  memberIds: string[]
}

type TeamRosterFieldsProps<TTeam extends RosterTeam> = {
  players: Player[]
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  guests: GameParticipant[]
  setGuests: Dispatch<SetStateAction<GameParticipant[]>>
  guestName: string
  setGuestName: Dispatch<SetStateAction<string>>
  teamName: string
  setTeamName: Dispatch<SetStateAction<string>>
  teams: TTeam[]
  setTeams: Dispatch<SetStateAction<TTeam[]>>
  teamIdPrefix: string
  teamLabel: string
  teamLabelPlural: string
  selectedClassName?: string
  activeButtonClassName?: string
  onManagePlayers: () => void
  setError: (message: string) => void
}

export function TeamRosterFields<TTeam extends RosterTeam>({
  players,
  selectedIds,
  setSelectedIds,
  guests,
  setGuests,
  guestName,
  setGuestName,
  teamName,
  setTeamName,
  teams,
  setTeams,
  teamIdPrefix,
  teamLabel,
  teamLabelPlural,
  selectedClassName,
  activeButtonClassName,
  onManagePlayers,
  setError,
}: TeamRosterFieldsProps<TTeam>) {
  const selectedPlayers = players.filter((player) => selectedIds.includes(player.id))
  const participants = [...selectedPlayers.map((player) => ({ id: player.id, name: player.name })), ...guests]
  const count = selectedPlayers.length + guests.length

  const togglePlayer = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        setTeams((currentTeams) => currentTeams.map((team) => ({ ...team, memberIds: team.memberIds.filter((memberId) => memberId !== id) })))
        return current.filter((item) => item !== id)
      }
      return count < 12 ? [...current, id] : current
    })
  }

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

  const removeGuest = (guestId: string) => {
    setGuests((current) => current.filter((guest) => guest.id !== guestId))
    setTeams((current) => current.map((team) => ({ ...team, memberIds: team.memberIds.filter((memberId) => memberId !== guestId) })))
  }

  const addTeam = () => {
    const name = normalizePlayerName(teamName)
    if (!name) { setError(`Informe o nome do ${teamLabel}.`); return }
    if (teams.some((team) => team.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { setError(`${capitalize(teamLabelPlural)} precisam ter nomes diferentes.`); return }
    setTeams((current) => [...current, { id: createId(teamIdPrefix), name, memberIds: [] as string[] } as unknown as TTeam])
    setTeamName('')
    setError('')
  }

  const assignToTeam = (participantId: string, teamId: string) => {
    setTeams((current) => current.map((team) => ({
      ...team,
      memberIds: team.id === teamId
        ? [...team.memberIds.filter((memberId) => memberId !== participantId), participantId]
        : team.memberIds.filter((memberId) => memberId !== participantId),
    })))
  }

  const removeTeam = (teamId: string) => {
    setTeams((current) => current.filter((team) => team.id !== teamId))
  }

  return <section className="mt-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black">Jogadores e {teamLabelPlural}</h1>
        <p className="text-sm text-slate-400">{count}/12 selecionados</p>
      </div>
      <Button variant="secondary" onClick={onManagePlayers}><Settings2 size={18} />Minha Galera</Button>
    </div>

    <Card className="mt-5 overflow-hidden">{players.length ? players.map((player) => {
      const selected = selectedIds.includes(player.id)
      return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && selectedClassName)} key={player.id} onClick={() => togglePlayer(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-white/60 bg-white text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button>
    }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>

    <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}>
      <input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
      <Button className={activeButtonClassName} type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button>
    </form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-slate-400">convidado</small></span><Button size="icon" variant="ghost" onClick={() => removeGuest(guest.id)}>×</Button></div>)}

    <h2 className="mt-7 text-xl font-black">{capitalize(teamLabelPlural)}</h2>
    <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); addTeam() }}>
      <input aria-label={`Nome do ${teamLabel}`} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder={`Nome do ${teamLabel}`} value={teamName} onChange={(event) => setTeamName(event.target.value)} />
      <Button className={activeButtonClassName} type="submit"><Plus size={18} />Adicionar</Button>
    </form>

    <div className="mt-4 grid gap-4">
      {teams.length ? teams.map((team, index) => <Card className="p-4" key={team.id}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black"><span className="mr-3 text-slate-500">{index + 1}</span>{team.name}</h3>
          <Button aria-label={`Excluir ${team.name}`} size="icon" variant="ghost" onClick={() => removeTeam(team.id)}><Trash2 size={17} /></Button>
        </div>
        <div className="mt-4 grid gap-2">
          {participants.length ? participants.map((participant) => {
            const assignedHere = team.memberIds.includes(participant.id)
            return <Button className={cn('justify-start', assignedHere && activeButtonClassName)} key={participant.id} variant={assignedHere ? 'primary' : 'secondary'} onClick={() => assignToTeam(participant.id, team.id)}>{participant.name}</Button>
          }) : <p className="rounded-2xl bg-white/5 p-4 text-sm text-slate-400">Selecione jogadores para montar este {teamLabel}.</p>}
        </div>
      </Card>) : <Card className="p-5 text-center text-sm text-slate-400">Adicione pelo menos 2 {teamLabelPlural}.</Card>}
    </div>
  </section>
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1)
}
