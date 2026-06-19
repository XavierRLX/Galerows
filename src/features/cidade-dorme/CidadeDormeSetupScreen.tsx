import { Moon, Plus, Settings2, ShieldCheck, Skull, Stethoscope, UserPlus, Users } from 'lucide-react'
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
import { getStartGameErrors } from './cidadeDorme.rules'
import { CIDADE_DORME_MAX_PLAYERS, CIDADE_DORME_MIN_PLAYERS, createDefaultCidadeDormeSettings, getCidadeDormeRoleCounts, getCidadeDormeSetupWarnings, isSupportedCidadeDormePlayerCount } from './cidadeDorme.setup'
import { useCidadeDormeStore } from './cidadeDorme.store'
import type { GameSettings, JesterWinMode, TieRule } from './cidadeDorme.types'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

const tieRules: { value: TieRule; label: string }[] = [
  { value: 'noElimination', label: 'Sem eliminação' },
  { value: 'revoteTied', label: 'Nova votação' },
  { value: 'mediatorDecision', label: 'Mediador decide' },
]

export function CidadeDormeSetupScreen() {
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const { group, hydrated, load } = usePlayersStore()
  const start = useCidadeDormeStore((state) => state.start)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [settings, setSettings] = useState<GameSettings>(() => createDefaultCidadeDormeSettings(CIDADE_DORME_MIN_PLAYERS))
  const [error, setError] = useState('')
  useCidadeDormeInitialization()
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])

  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const count = selectedPlayers.length + guests.length
  const participants = useMemo(() => [...selectedPlayers.map(playerToParticipant), ...guests], [guests, selectedPlayers])
  const startErrors = getStartGameErrors(participants, settings)
  const warnings = getCidadeDormeSetupWarnings(settings)
  const canStart = startErrors.length === 0
  const roleCounts = getCidadeDormeRoleCounts(settings)

  const syncSettingsForCount = (nextCount: number) => {
    setSettings((current) => settingsForPlayerCount(nextCount, current))
  }
  const togglePlayer = (id: string) => {
    const nextIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : count < CIDADE_DORME_MAX_PLAYERS ? [...selectedIds, id] : selectedIds
    setSelectedIds(nextIds)
    syncSettingsForCount(nextIds.length + guests.length)
  }
  const updateSettings = (partial: Partial<GameSettings>) => setSettings((current) => ({ ...current, ...partial }))
  const addGuest = () => {
    const name = normalizePlayerName(guestName)
    if (!name) { setError('Informe o nome do convidado.'); return }
    const names = participants.map((player) => player.name.toLocaleLowerCase('pt-BR'))
    if (names.includes(name.toLocaleLowerCase('pt-BR'))) { setError('Os jogadores precisam ter nomes diferentes.'); return }
    if (count >= CIDADE_DORME_MAX_PLAYERS) { setError('O limite é de 12 jogadores.'); return }
    setGuests((current) => [...current, createGuestParticipant(name)])
    syncSettingsForCount(count + 1)
    setGuestName('')
    setError('')
  }
  const removeGuest = (guestId: string) => {
    const nextGuests = guests.filter((guest) => guest.id !== guestId)
    setGuests(nextGuests)
    syncSettingsForCount(selectedIds.length + nextGuests.length)
  }
  const begin = async () => {
    if (!canStart) { setError(startErrors[0] ?? 'Revise a configuração da partida.'); return }
    await start(participants, settings)
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/cidade-dorme/play')
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/cidade-dorme" title="Configurar partida" /><section className="px-5 py-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Quem está na cidade?</h1><p className="text-sm text-slate-400">{count}/{CIDADE_DORME_MAX_PLAYERS} selecionados</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />Minha Galera</Button></div>
    <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-blue-300/10 text-blue-200')} key={player.id} onClick={() => togglePlayer(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-blue-300 bg-blue-300 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">Sua galera ainda está vazia. Você pode adicionar convidados abaixo.</p></div>}</Card>
    <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label="Nome do convidado" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder="Convidado temporário" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" type="submit"><UserPlus size={18} /><Plus className="sr-only" />Adicionar</Button></form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-blue-300/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-blue-200">convidado</small></span><Button aria-label={`Remover ${guest.name}`} size="icon" variant="ghost" onClick={() => removeGuest(guest.id)}>×</Button></div>)}

    <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Papéis</h2><Card className="mt-3 p-5"><div className="flex items-center gap-3"><Skull className="text-rose-300" size={22} /><div><h3 className="font-black">Assassinos</h3><p className="text-sm text-slate-400">Recomendado automaticamente pelo tamanho do grupo.</p></div></div><div className="mt-4 grid grid-cols-3 gap-2">{[1, 2, 3].map((amount) => <Button className={cn(settings.killersCount === amount && 'bg-rose-300 text-slate-950 hover:bg-rose-200')} disabled={amount >= Math.max(settings.playerCount, 1)} key={amount} variant={settings.killersCount === amount ? 'primary' : 'secondary'} onClick={() => updateSettings({ killersCount: amount })}>{amount}</Button>)}</div></Card>
      <div className="mt-3 grid gap-3"><ToggleRow active={settings.enableDoctor} description="Protege uma pessoa durante a noite." icon={<Stethoscope size={20} />} label="Médico" onToggle={() => updateSettings({ enableDoctor: !settings.enableDoctor })} /><ToggleRow active={settings.enableDetective} description="Investiga se alguém é suspeito." icon={<ShieldCheck size={20} />} label="Detetive" onToggle={() => updateSettings({ enableDetective: !settings.enableDetective })} /><ToggleRow active={settings.enableJester} description="Vence se for eliminado por votação." icon={<Moon size={20} />} label="Coringa" onToggle={() => updateSettings({ enableJester: !settings.enableJester })} /></div>
      <p className="mt-3 rounded-2xl bg-blue-300/10 p-4 text-sm leading-6 text-blue-100">Composição: {roleCounts.killer} assassino(s), {roleCounts.doctor} médico, {roleCounts.detective} detetive, {roleCounts.jester} coringa e {roleCounts.citizen} cidadão(s).</p></section>

    <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Regras</h2><div className="mt-3 grid gap-3"><ToggleRow active={settings.revealRoleOnDeath} description="Ajuda grupos iniciantes a entenderem a partida." label="Revelar função ao morrer" onToggle={() => updateSettings({ revealRoleOnDeath: !settings.revealRoleOnDeath })} /><ToggleRow active={settings.allowSkipVote} description="Permite a cidade não eliminar ninguém." label="Permitir pular votação" onToggle={() => updateSettings({ allowSkipVote: !settings.allowSkipVote })} /><ToggleRow active={settings.doctorCanSelfProtect} description="Se desligado, o Médico precisa escolher outra pessoa." label="Médico pode se proteger" onToggle={() => updateSettings({ doctorCanSelfProtect: !settings.doctorCanSelfProtect })} /><ToggleRow active={settings.doctorCanRepeatProtection} description="Se desligado, não pode proteger a mesma pessoa em noites seguidas." label="Médico pode repetir proteção" onToggle={() => updateSettings({ doctorCanRepeatProtection: !settings.doctorCanRepeatProtection })} /></div>
      <h3 className="mt-5 text-sm font-bold text-slate-300">Empate na votação</h3><div className="mt-2 grid gap-2 sm:grid-cols-3">{tieRules.map((rule) => <Button className={cn(settings.tieRule === rule.value && 'bg-blue-300 text-slate-950 hover:bg-blue-200')} key={rule.value} variant={settings.tieRule === rule.value ? 'primary' : 'secondary'} onClick={() => updateSettings({ tieRule: rule.value })}>{rule.label}</Button>)}</div>
      <h3 className="mt-5 text-sm font-bold text-slate-300">Vitória do Coringa</h3><div className="mt-2 grid grid-cols-2 gap-2">{(['instant', 'parallel'] as JesterWinMode[]).map((mode) => <Button className={cn(settings.jesterWinMode === mode && 'bg-blue-300 text-slate-950 hover:bg-blue-200')} disabled={!settings.enableJester} key={mode} variant={settings.jesterWinMode === mode ? 'primary' : 'secondary'} onClick={() => updateSettings({ jesterWinMode: mode })}>{mode === 'instant' ? 'Encerra' : 'Paralela'}</Button>)}</div></section>

    {warnings.map((warning) => <p className="mt-3 rounded-2xl bg-amber-300/10 p-4 text-sm text-amber-100" key={warning}>{warning}</p>)}
    {error || startErrors[0] ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error || startErrors[0]}</p> : null}
    <Button className="mt-6 w-full bg-blue-300 text-slate-950 hover:bg-blue-200" disabled={!canStart} size="lg" onClick={() => void begin()}>Sortear papéis</Button>
  </section></div>
}

function ToggleRow({ active, label, description, icon, onToggle }: { active: boolean; label: string; description: string; icon?: React.ReactNode; onToggle: () => void }) {
  return <button aria-pressed={active} className={cn('flex min-h-20 items-center justify-between gap-4 rounded-2xl border p-4 text-left transition', active ? 'border-blue-300 bg-blue-300/10' : 'border-white/10 bg-white/[0.05]')} onClick={onToggle} type="button"><span className="flex min-w-0 items-start gap-3">{icon ? <span className="mt-0.5 text-blue-200">{icon}</span> : null}<span><span className="block font-black">{label}</span><span className="mt-1 block text-sm leading-5 text-slate-400">{description}</span></span></span><span className={cn('h-7 w-12 shrink-0 rounded-full p-1 transition', active ? 'bg-blue-300' : 'bg-white/15')}><span className={cn('block size-5 rounded-full bg-white transition', active && 'translate-x-5')} /></span></button>
}

function settingsForPlayerCount(playerCount: number, current: GameSettings): GameSettings {
  if (!isSupportedCidadeDormePlayerCount(playerCount)) return { ...current, playerCount }
  const preset = createDefaultCidadeDormeSettings(playerCount)
  return {
    ...preset,
    revealRoleOnDeath: current.revealRoleOnDeath,
    allowSkipVote: current.allowSkipVote,
    tieRule: current.tieRule,
    doctorCanSelfProtect: current.doctorCanSelfProtect,
    doctorCanRepeatProtection: current.doctorCanRepeatProtection,
    jesterWinMode: current.jesterWinMode,
  }
}
