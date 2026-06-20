import { Moon, Plus, Settings2, ShieldCheck, Skull, Stethoscope, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import type { DoctorSelfProtectLimit, GameSettings } from './cidadeDorme.types'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

const doctorSelfProtectLimits: DoctorSelfProtectLimit[] = [1, 2, 3, 'unlimited']

export function CidadeDormeSetupScreen() {
  const { t } = useTranslation('cidade-dorme')
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
    if (!name) { setError(t('setup.errors.guestName')); return }
    const names = participants.map((player) => player.name.toLocaleLowerCase('pt-BR'))
    if (names.includes(name.toLocaleLowerCase('pt-BR'))) { setError(t('setup.errors.duplicate')); return }
    if (count >= CIDADE_DORME_MAX_PLAYERS) { setError(t('setup.errors.limit')); return }
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
    if (!canStart) { setError(startErrors[0] ?? t('setup.errors.review')); return }
    await start(participants, settings)
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/cidade-dorme/play')
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/cidade-dorme" title={t('setup.title')} /><section className="px-5 py-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-black">{t('setup.playersHeading')}</h1><p className="text-sm text-slate-400">{t('setup.selected', { count, max: CIDADE_DORME_MAX_PLAYERS })}</p></div><Button className="w-full sm:w-auto" variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />{t('setup.myGroup')}</Button></div>
    <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-blue-300/10 text-blue-200')} key={player.id} onClick={() => togglePlayer(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-blue-300 bg-blue-300 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">{t('setup.emptyGroup')}</p></div>}</Card>
    <form className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label={t('setup.guestNameLabel')} className="min-h-12 min-w-0 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder={t('setup.guestPlaceholder')} value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button className="bg-blue-300 text-slate-950 hover:bg-blue-200" type="submit"><UserPlus size={18} /><Plus className="sr-only" />{t('setup.add')}</Button></form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-blue-300/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-blue-200">{t('common.guest')}</small></span><Button aria-label={t('common.remove', { name: guest.name })} size="icon" variant="ghost" onClick={() => removeGuest(guest.id)}>×</Button></div>)}

    <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('setup.rolesTitle')}</h2><Card className="mt-3 p-5"><div className="flex items-center gap-3"><Skull className="text-rose-300" size={22} /><div><h3 className="font-black">{t('setup.killers')}</h3><p className="text-sm text-slate-400">{t('setup.killersHint')}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2">{[1, 2, 3].map((amount) => <Button className={cn(settings.killersCount === amount && 'bg-rose-300 text-slate-950 hover:bg-rose-200')} disabled={amount >= Math.max(settings.playerCount, 1)} key={amount} variant={settings.killersCount === amount ? 'primary' : 'secondary'} onClick={() => updateSettings({ killersCount: amount })}>{amount}</Button>)}</div></Card>
      <div className="mt-3 grid gap-3"><ToggleRow active={settings.enableDoctor} description={t('setup.doctorHint')} icon={<Stethoscope size={20} />} label={t('setup.doctor')} onToggle={() => updateSettings({ enableDoctor: !settings.enableDoctor })} /><ToggleRow active={settings.enableDetective} description={t('setup.detectiveHint')} icon={<ShieldCheck size={20} />} label={t('setup.detective')} onToggle={() => updateSettings({ enableDetective: !settings.enableDetective })} /><ToggleRow active={settings.enableJester} description={t('setup.jesterHint')} icon={<Moon size={20} />} label={t('setup.jester')} onToggle={() => updateSettings({ enableJester: !settings.enableJester })} /></div>
      <p className="mt-3 rounded-2xl bg-blue-300/10 p-4 text-sm leading-6 text-blue-100">{t('setup.composition', roleCounts)}</p></section>

    <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('setup.rulesTitle')}</h2><div className="mt-3 grid gap-3"><ToggleRow active={settings.revealRoleOnDeath} description={t('setup.revealRoleOnDeathHint')} label={t('setup.revealRoleOnDeath')} onToggle={() => updateSettings({ revealRoleOnDeath: !settings.revealRoleOnDeath })} /><ToggleRow active={settings.doctorCanSelfProtect} description={t('setup.doctorCanSelfProtectHint')} label={t('setup.doctorCanSelfProtect')} onToggle={() => updateSettings({ doctorCanSelfProtect: !settings.doctorCanSelfProtect })} />{settings.doctorCanSelfProtect ? <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><h3 className="text-sm font-bold text-slate-300">{t('setup.doctorSelfProtectLimitTitle')}</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{doctorSelfProtectLimits.map((limit) => <Button className={cn(settings.doctorSelfProtectLimit === limit && 'bg-blue-300 text-slate-950 hover:bg-blue-200')} key={limit} variant={settings.doctorSelfProtectLimit === limit ? 'primary' : 'secondary'} onClick={() => updateSettings({ doctorSelfProtectLimit: limit })}>{t(`setup.doctorSelfProtectLimits.${limit}`)}</Button>)}</div></div> : null}<ToggleRow active={settings.doctorCanRepeatProtection} description={t('setup.doctorCanRepeatProtectionHint')} label={t('setup.doctorCanRepeatProtection')} onToggle={() => updateSettings({ doctorCanRepeatProtection: !settings.doctorCanRepeatProtection })} /></div></section>

    {warnings.map((warning) => <p className="mt-3 rounded-2xl bg-amber-300/10 p-4 text-sm text-amber-100" key={warning}>{warning}</p>)}
    {error || startErrors[0] ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error || startErrors[0]}</p> : null}
    <Button className="mt-6 w-full bg-blue-300 text-slate-950 hover:bg-blue-200" disabled={!canStart} size="lg" onClick={() => void begin()}>{t('setup.start')}</Button>
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
    doctorCanSelfProtect: current.doctorCanSelfProtect,
    doctorSelfProtectLimit: current.doctorSelfProtectLimit,
    doctorCanRepeatProtection: current.doctorCanRepeatProtection,
  }
}
