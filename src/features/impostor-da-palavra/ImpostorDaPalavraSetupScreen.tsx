import { MessageCircleQuestion, Plus, Settings2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { useFakeAd } from '../ads/FakeAdProvider'
import { createGuestParticipant, normalizePlayerName, playerToParticipant } from '../players/players.model'
import { usePlayersStore } from '../players/players.store'
import type { GameParticipant } from '../players/players.types'
import { useImpostorDaPalavraStore } from './impostorDaPalavra.store'
import type { ConversationMode, ImpostorMode } from './impostorDaPalavra.types'
import { useImpostorDaPalavraInitialization } from './useImpostorDaPalavraInitialization'

const modes: ImpostorMode[] = ['no-word', 'hint', 'alternate-word']
const conversations: ConversationMode[] = ['one-word', 'guided-questions']

export function ImpostorDaPalavraSetupScreen() {
  const { t } = useTranslation('impostor-da-palavra')
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const { group, hydrated, load } = usePlayersStore()
  const start = useImpostorDaPalavraStore((state) => state.start)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guests, setGuests] = useState<GameParticipant[]>([])
  const [guestName, setGuestName] = useState('')
  const [impostorMode, setImpostorMode] = useState<ImpostorMode>('no-word')
  const [conversationMode, setConversationMode] = useState<ConversationMode>('one-word')
  const [error, setError] = useState('')
  useImpostorDaPalavraInitialization()
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const count = selectedPlayers.length + guests.length
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : count < 12 ? [...current, id] : current)
  const addGuest = () => {
    const name = normalizePlayerName(guestName)
    if (!name) { setError(t('errors.guestName')); return }
    const names = [...selectedPlayers.map((player) => player.name), ...guests.map((guest) => guest.name)].map((item) => item.toLocaleLowerCase())
    if (names.includes(name.toLocaleLowerCase())) { setError(t('errors.duplicateName')); return }
    if (count >= 12) { setError(t('errors.playerLimit')); return }
    setGuests((current) => [...current, createGuestParticipant(name)]); setGuestName(''); setError('')
  }
  const begin = async () => {
    if (count < 3 || count > 12) { setError(t('errors.playerCount')); return }
    await start([...selectedPlayers.map(playerToParticipant), ...guests], { impostorMode, conversationMode })
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/impostor-da-palavra/play')
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/impostor-da-palavra" title={t('setup.title')} /><section className="px-5 py-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">{t('setup.playersTitle')}</h1><p className="text-sm text-slate-400">{t('setup.selected', { count })}</p></div><Button variant="secondary" onClick={() => navigate('/players')}><Settings2 size={18} />{t('setup.manage')}</Button></div>
    <Card className="mt-5 overflow-hidden">{group?.players.length ? group.players.map((player) => { const selected = selectedIds.includes(player.id); return <button className={cn('flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 text-left last:border-0', selected && 'bg-violet-400/10 text-violet-300')} key={player.id} onClick={() => toggle(player.id)} type="button"><span className={cn('flex size-6 items-center justify-center rounded-full border', selected ? 'border-violet-400 bg-violet-400 text-slate-950' : 'border-white/20')}>{selected ? '✓' : ''}</span><span className="font-bold">{player.name}</span></button> }) : <div className="p-5 text-center"><Users className="mx-auto text-slate-500" /><p className="mt-2 text-sm text-slate-400">{t('setup.emptyGroup')}</p></div>}</Card>
    <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); addGuest() }}><input aria-label={t('setup.guestLabel')} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4" placeholder={t('setup.guestPlaceholder')} value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Button type="submit"><UserPlus size={18} /><Plus className="sr-only" />{t('setup.add')}</Button></form>
    {guests.map((guest) => <div className="mt-2 flex items-center justify-between rounded-2xl bg-violet-400/10 px-4 py-3" key={guest.id}><span className="font-bold">{guest.name} <small className="text-violet-300">{t('setup.guest')}</small></span><Button aria-label={`Remover ${guest.name}`} size="icon" variant="ghost" onClick={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}>×</Button></div>)}
    <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">{t('setup.modeTitle')}</h2><div className="mt-3 grid gap-3">{modes.map((mode) => <ChoiceCard active={impostorMode === mode} description={t(`modes.${mode}.description`)} key={mode} title={t(`modes.${mode}.name`)} onClick={() => setImpostorMode(mode)} />)}</div>
    <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">{t('setup.conversationTitle')}</h2><div className="mt-3 grid grid-cols-2 gap-3">{conversations.map((mode) => <ChoiceCard active={conversationMode === mode} description={t(`conversation.${mode}.description`)} icon={<MessageCircleQuestion size={20} />} key={mode} title={t(`conversation.${mode}.name`)} onClick={() => setConversationMode(mode)} />)}</div>
    <p className="mt-5 rounded-2xl bg-violet-400/10 p-4 text-sm text-violet-200">{t('setup.rounds', { count })}</p>
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={count < 3} size="lg" onClick={() => void begin()}>{t('setup.start')}</Button>
  </section></div>
}

function ChoiceCard({ active, title, description, icon, onClick }: { active: boolean; title: string; description: string; icon?: React.ReactNode; onClick: () => void }) {
  return <button className={cn('rounded-3xl border p-4 text-left transition', active ? 'border-violet-400 bg-violet-400/15 ring-1 ring-violet-400' : 'border-white/10 bg-white/[0.05]')} onClick={onClick} type="button"><div className="flex items-center gap-2 font-black text-violet-300">{icon}{title}</div><p className="mt-2 text-sm leading-5 text-slate-300">{description}</p></button>
}
