import { Clock3, Eye, Plus, Save, Settings2, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { createId } from '../../lib/utils/createId'
import { cn } from '../../lib/utils/cn'
import { useFakeAd } from '../ads/useFakeAd'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import { useMimicaStore } from './mimica.store'
import type { MimicaChallengeSource, MimicaConfig, MimicaMode, MimicaPreparedChallenge, MimicaTeam } from './mimica.types'
import { useMimicaInitialization } from './useMimicaInitialization'

const durations: MimicaConfig['turnDurationSeconds'][] = [30, 60, 90, 120]
const roundOptions = [1, 2, 3, 4, 5]
const maxChallengeLength = 80

export function MimicaSetupScreen() {
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const { group, hydrated, load } = usePlayersStore()
  const start = useMimicaStore((state) => state.start)
  const [mode, setMode] = useState<MimicaMode>('individual')
  const [useTimer, setUseTimer] = useState(false)
  const [duration, setDuration] = useState<MimicaConfig['turnDurationSeconds']>(60)
  const [rounds, setRounds] = useState(3)
  const [challengeSource, setChallengeSource] = useState<MimicaChallengeSource>('deck')
  const [challengeDrafts, setChallengeDrafts] = useState<Record<string, string[]>>({})
  const [preparationStepIndex, setPreparationStepIndex] = useState(0)
  const [preparationMode, setPreparationMode] = useState<'handoff' | 'editing'>('handoff')
  const [savedPreparationKeys, setSavedPreparationKeys] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<MimicaTeam[]>([])
  const [error, setError] = useState('')
  useMimicaInitialization()
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const count = selectedPlayers.length + guests.length
  const preparationSteps = teams.length >= 2 ? teams.map((team, teamIndex) => ({ author: teams[(teamIndex + teams.length - 1) % teams.length]!, target: team, key: team.id })) : []
  useEffect(() => {
    if (preparationStepIndex >= preparationSteps.length) setPreparationStepIndex(Math.max(0, preparationSteps.length - 1))
  }, [preparationStepIndex, preparationSteps.length])
  const currentPreparationStep = preparationSteps[preparationStepIndex] ?? preparationSteps[0] ?? null
  const preparedChallengeDrafts = preparationSteps.flatMap((step) => {
    return Array.from({ length: rounds }).map((_, roundIndex) => ({
      author: step.author,
      round: roundIndex + 1,
      target: step.target,
      text: (challengeDrafts[step.target.id]?.[roundIndex] ?? '').trim().replace(/\s+/g, ' '),
    }))
  })
  const isPreparationStepComplete = (step: { target: MimicaTeam }) => Array.from({ length: rounds }).every((_, roundIndex) => {
    const text = (challengeDrafts[step.target.id]?.[roundIndex] ?? '').trim().replace(/\s+/g, ' ')
    return text.length > 0 && text.length <= maxChallengeLength
  })
  const savedPreparationCount = preparationSteps.filter((step) => savedPreparationKeys.includes(step.key) && isPreparationStepComplete(step)).length
  const preparedChallengesReady = challengeSource === 'deck' || (preparationSteps.length > 0 && savedPreparationCount === preparationSteps.length)
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : count < 12 ? [...current, id] : current)
  const updateChallengeDraft = (teamId: string, roundIndex: number, value: string) => {
    setChallengeDrafts((current) => {
      const values = [...(current[teamId] ?? [])]
      values[roundIndex] = value
      return { ...current, [teamId]: values }
    })
  }
  const saveCurrentPreparationStep = () => {
    if (!currentPreparationStep) return
    if (!isPreparationStepComplete(currentPreparationStep)) { setError(`Preencha todas as mímicas com até ${maxChallengeLength} caracteres.`); return }
    setSavedPreparationKeys((current) => current.includes(currentPreparationStep.key) ? current : [...current, currentPreparationStep.key])
    const nextIndex = Math.min(preparationStepIndex + 1, Math.max(preparationSteps.length - 1, 0))
    setPreparationStepIndex(nextIndex)
    setPreparationMode('handoff')
    setError('')
  }
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
    setTeams((current) => [...current, { id: createId('mimica-team'), name }]); setTeamName(''); setError('')
  }
  const begin = async () => {
    const participants = [...selectedPlayers.map(playerToParticipant), ...guests]
    if (mode === 'individual' && (participants.length < 2 || participants.length > 12)) { setError('Selecione entre 2 e 12 jogadores.'); return }
    if (mode === 'teams' && teams.length < 2) { setError('Crie pelo menos 2 times.'); return }
    if (mode === 'teams' && challengeSource === 'opponent-prepared' && !preparedChallengesReady) { setError(`Preencha todas as mímicas com até ${maxChallengeLength} caracteres.`); return }
    const preparedChallenges: MimicaPreparedChallenge[] = mode === 'teams' && challengeSource === 'opponent-prepared'
      ? preparedChallengeDrafts.map((draft) => ({
        id: createId('mimica-challenge'),
        targetTeamId: draft.target.id,
        authorTeamId: draft.author.id,
        round: draft.round,
        text: draft.text,
        points: 1,
      }))
      : []
    await start(participants, teams, { mode, useTimer, turnDurationSeconds: duration, roundsPerEntity: rounds }, mode === 'teams' ? challengeSource : 'deck', preparedChallenges)
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/mimica/play')
  }
  const canStart = mode === 'individual' ? count >= 2 : teams.length >= 2 && preparedChallengesReady
  return <div className="min-h-dvh pb-10"><Header backTo="/games/mimica" title="Configurar partida" /><section className="px-5 py-6">
    <Card className="p-5"><h2 className="text-lg font-black">Modo de jogo</h2><div className="mt-4 grid grid-cols-2 gap-3"><Button className={mode === 'individual' ? 'bg-violet-400 text-slate-950 hover:bg-violet-300' : ''} size="lg" variant={mode === 'individual' ? 'primary' : 'secondary'} onClick={() => setMode('individual')}>Individual</Button><Button className={mode === 'teams' ? 'bg-violet-400 text-slate-950 hover:bg-violet-300' : ''} size="lg" variant={mode === 'teams' ? 'primary' : 'secondary'} onClick={() => setMode('teams')}>Equipes</Button></div></Card>
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Rodadas</h2><p className="mt-1 text-sm text-slate-400">Cada jogador ou equipe faz uma mímica por rodada.</p><div className="mt-4 grid grid-cols-5 gap-2">{roundOptions.map((item) => <Button className={cn(item === rounds && 'ring-2 ring-fuchsia-300 bg-violet-400 text-slate-950 hover:bg-violet-300')} key={item} variant={item === rounds ? 'primary' : 'secondary'} onClick={() => setRounds(item)}>{item}</Button>)}</div></Card>
    <Card className="mt-5 p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-black">Tempo por turno</h2><p className="mt-1 text-sm text-slate-400">Opcional. Deixe desligado para jogar sem pressão.</p></div><button aria-pressed={useTimer} className={cn('h-7 w-12 rounded-full p-1 transition', useTimer ? 'bg-violet-500' : 'bg-white/15')} onClick={() => setUseTimer((current) => !current)} type="button"><span className={cn('block size-5 rounded-full bg-white transition', useTimer && 'translate-x-5')} /></button></div><div className="mt-4 grid grid-cols-4 gap-2">{durations.map((item) => <Button className={cn(item === duration && useTimer && 'ring-2 ring-fuchsia-300 bg-violet-400 text-slate-950 hover:bg-violet-300')} disabled={!useTimer} key={item} variant={item === duration ? 'primary' : 'secondary'} onClick={() => setDuration(item)}><Clock3 size={16} />{item}s</Button>)}</div></Card>
    {mode === 'individual' ? <section className="mt-5"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Jogadores</h1><p className="text-sm text-slate-400">{count}/12 selecionados</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />Minha Galera</Button></div>
      <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-violet-400/10 text-violet-300')} key={player.id} onClick={() => toggle(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-violet-400 bg-violet-400 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>
      <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button></form>
      {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-violet-400/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-violet-300">convidado</small></span><Button size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    </section> : <section className="mt-5"><h1 className="text-2xl font-black">Equipes</h1><p className="mt-1 text-sm text-slate-400">Não precisa cadastrar jogadores, só o nome do grupo.</p><form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addTeam() }}><input aria-label="Nome do time" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Nome da equipe" value={teamName} onChange={(event) => setTeamName(event.target.value)} /><Button className="bg-violet-400 text-slate-950 hover:bg-violet-300" type="submit"><Plus size={18} />Adicionar</Button></form><Card className="mt-4 overflow-hidden">{teams.length ? teams.map((team, index) => <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 last:border-0" key={team.id}><span className="font-bold"><span className="mr-3 text-slate-500">{index + 1}</span>{team.name}</span><Button size="icon" variant="ghost" onClick={() => setTeams((current) => current.filter((item) => item.id !== team.id))}><Trash2 size={17} /></Button></div>) : <div className="p-5 text-center text-sm text-slate-400">Adicione pelo menos 2 equipes.</div>}</Card>
      <Card className="mt-5 p-5"><h2 className="text-lg font-black">Fonte das mímicas</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Button className={cn(challengeSource === 'deck' && 'bg-violet-400 text-slate-950 hover:bg-violet-300')} size="lg" variant={challengeSource === 'deck' ? 'primary' : 'secondary'} onClick={() => setChallengeSource('deck')}>Baralho do app</Button><Button className={cn(challengeSource === 'opponent-prepared' && 'bg-violet-400 text-slate-950 hover:bg-violet-300')} size="lg" variant={challengeSource === 'opponent-prepared' ? 'primary' : 'secondary'} onClick={() => setChallengeSource('opponent-prepared')}>Criadas pela adversária</Button></div></Card>
      {challengeSource === 'opponent-prepared' && teams.length >= 2 ? <section className="mt-5"><h2 className="text-xl font-black">Preparar mímicas</h2><p className="mt-1 text-sm text-slate-400">{savedPreparationCount}/{preparationSteps.length} equipes prepararam.</p>{preparedChallengesReady ? <Card className="mt-4 p-5 text-center"><p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">Tudo pronto</p><h3 className="mt-2 text-2xl font-black">Mímicas escondidas</h3><p className="mt-3 text-sm leading-6 text-slate-300">Todas as equipes prepararam seus desafios. Agora já pode iniciar o jogo.</p></Card> : currentPreparationStep ? <Card className="mt-4 p-5">{preparationMode === 'handoff' ? <div className="text-center"><p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">Tela escondida</p><h3 className="mt-2 text-2xl font-black">Passe o celular para {currentPreparationStep.author.name}</h3><p className="mt-3 text-sm leading-6 text-slate-300">Essa equipe vai criar {rounds} mímica{rounds === 1 ? '' : 's'} para {currentPreparationStep.target.name}. A equipe desafiada não deve ver esta etapa.</p><Button className="mt-5 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={() => { setPreparationMode('editing'); setError('') }}><Eye size={19} />Estou com o celular</Button></div> : <div><p className="text-sm font-bold text-slate-400">{currentPreparationStep.author.name} cria para</p><h3 className="mt-1 text-2xl font-black text-violet-200">{currentPreparationStep.target.name}</h3><div className="mt-4 grid gap-3">{Array.from({ length: rounds }).map((_, roundIndex) => { const value = challengeDrafts[currentPreparationStep.target.id]?.[roundIndex] ?? ''; return <label className="block" key={`${currentPreparationStep.target.id}-${roundIndex}`}><span className="text-sm font-bold text-slate-300">Rodada {roundIndex + 1}</span><textarea aria-label={`Mímica rodada ${roundIndex + 1} para ${currentPreparationStep.target.name}`} className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" maxLength={maxChallengeLength} placeholder="Ex.: fazer um gol de bicicleta" value={value} onChange={(event) => updateChallengeDraft(currentPreparationStep.target.id, roundIndex, event.target.value)} /><span className="mt-1 block text-right text-xs text-slate-500">{value.trim().length}/{maxChallengeLength}</span></label> })}</div><Button className="mt-5 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" size="lg" onClick={saveCurrentPreparationStep}><Save size={19} />Salvar e esconder</Button></div>}</Card> : null}</section> : null}</section>}
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={!canStart} size="lg" onClick={() => void begin()}>Iniciar jogo</Button>
  </section></div>
}
