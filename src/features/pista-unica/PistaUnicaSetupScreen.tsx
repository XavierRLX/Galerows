import { Check, Film, Lightbulb, Plus, Settings2, Tv, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import { PISTA_UNICA_CATEGORIES, type PistaUnicaCategory } from './pistaUnica.types'
import { usePistaUnicaStore } from './pistaUnica.store'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'

const categoryIcons = { words: Lightbulb, movies: Film, series: Tv } as const

export function PistaUnicaSetupScreen() {
  usePistaUnicaTheme()
  const { t } = useTranslation('pista-unica')
  const navigate = useNavigate()
  const { group, hydrated, load } = usePlayersStore()
  const start = usePistaUnicaStore((state) => state.start)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [categories, setCategories] = useState<PistaUnicaCategory[]>([...PISTA_UNICA_CATEGORIES])
  const [error, setError] = useState('')
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const participantCount = selectedPlayers.length + guests.length
  const togglePlayer = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : participantCount < 12 ? [...current, id] : current)
  const toggleCategory = (category: PistaUnicaCategory) => setCategories((current) => current.includes(category) ? current.length === 1 ? current : current.filter((item) => item !== category) : [...current, category])
  const addGuest = () => {
    const name = normalizePlayerName(guestName)
    const taken = [...selectedPlayers.map((player) => player.name), ...guests.map((guest) => guest.name)].some((item) => item.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))
    if (!name) { setError(t('setup.errors.guest')); return }
    if (taken) { setError(t('setup.errors.duplicate')); return }
    if (participantCount >= 12) { setError(t('setup.errors.limit')); return }
    setGuests((current) => [...current, createGuestParticipant(name)]); setGuestName(''); setError('')
  }
  const begin = async () => {
    if (participantCount < 3) { setError(t('setup.errors.players')); return }
    await start([...selectedPlayers.map(playerToParticipant), ...guests], categories)
    navigate('/games/pista-unica/play')
  }
  return <div className="min-h-dvh pb-10"><Header backTo="/games/pista-unica" title={t('setup.title')} /><section className="px-5 py-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">{t('setup.players')}</h1><p className="text-sm text-slate-400">{t('setup.selected', { count: participantCount })}</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />{t('setup.manage')}</Button></div>
    <Card className="mt-5 overflow-hidden border-emerald-500/15">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-emerald-400/10 text-emerald-200')} key={player.id} type="button" onClick={() => togglePlayer(player.id)}><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-emerald-400 bg-emerald-400 text-emerald-950' : 'border-white/20')}>{selected ? <Check size={16} /> : null}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">{t('setup.empty')}</p></div>}</Card>
    <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label={t('setup.guestLabel')} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-emerald-300" placeholder={t('setup.guestPlaceholder')} value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button className="bg-emerald-600 text-white hover:bg-emerald-500" type="submit"><UserPlus size={18} /><Plus className="sr-only" />{t('setup.add')}</Button></form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-emerald-400/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-emerald-300">{t('setup.guest')}</small></span><Button aria-label={t('setup.remove', { name: guest.name })} size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    <h2 className="mt-7 text-xl font-black">{t('setup.categories')}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{t('setup.categoriesDescription')}</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{PISTA_UNICA_CATEGORIES.map((category) => { const Icon = categoryIcons[category]; const active = categories.includes(category); return <button className={cn('rounded-3xl border p-4 text-left transition', active ? 'border-emerald-400 bg-emerald-400/15 ring-1 ring-emerald-400' : 'border-white/10 bg-white/[0.05]')} key={category} type="button" onClick={() => toggleCategory(category)}><Icon className="text-emerald-300" size={23} /><p className="mt-3 font-black">{t(`categories.${category}.name`)}</p><p className="mt-1 text-sm leading-5 text-slate-300">{t(`categories.${category}.description`)}</p></button> })}</div>
    {error ? <p className="mt-5 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-7 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={participantCount < 3} size="lg" onClick={() => void begin()}>{t('setup.start')}</Button>
  </section></div>
}
