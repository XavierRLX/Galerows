import { ArrowRight, Check, Film, Lightbulb, Plus, Tv, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PistaWorkshop, WorkshopHeading } from './PistaWorkshop'
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
  const [step, setStep] = useState<'players' | 'categories'>('players')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  const selectedPlayers = useMemo(() => group?.players.filter((player) => selectedIds.includes(player.id)) ?? [], [group, selectedIds])
  const participantCount = selectedPlayers.length + guests.length
  const availableSlots = Math.max(0, 12 - guests.length)
  const eligiblePlayers = useMemo(() => {
    const names = new Set(guests.map(guest => guest.name.toLocaleLowerCase('pt-BR')))
    return (group?.players ?? []).filter(player => {
      const name = player.name.toLocaleLowerCase('pt-BR')
      if (names.has(name)) return false
      names.add(name)
      return true
    })
  }, [group, guests])
  const allSelected = availableSlots > 0 && eligiblePlayers.length > 0 && selectedPlayers.length === Math.min(eligiblePlayers.length, availableSlots)
  const togglePlayer = (id: string) => {
    if (selectedIds.includes(id)) { setSelectedIds(current => current.filter(item => item !== id)); setError(''); return }
    const player = group?.players.find(item => item.id === id)
    if (!player) return
    const normalized = player.name.toLocaleLowerCase('pt-BR')
    if (guests.some(guest => guest.name.toLocaleLowerCase('pt-BR') === normalized)
      || selectedPlayers.some(item => item.name.toLocaleLowerCase('pt-BR') === normalized)) {
      setError(t('setup.errors.duplicate')); return
    }
    if (participantCount >= 12) { setError(t('setup.errors.limit')); return }
    setSelectedIds(current => [...current, id]); setError('')
  }
  const toggleAllPlayers = () => {
    if (allSelected) { setSelectedIds([]); setError(''); return }
    const chosen = selectedPlayers.map(player => player.id)
    for (const player of eligiblePlayers) {
      if (chosen.length >= availableSlots) break
      if (!chosen.includes(player.id)) chosen.push(player.id)
    }
    setSelectedIds(chosen); setError('')
  }
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
    if (busy) return
    setBusy(true)
    try {
      await start([...selectedPlayers.map(playerToParticipant), ...guests], categories)
      navigate('/games/pista-unica/play')
    } catch { setError('Não foi possível preparar a partida. Tente novamente.'); setBusy(false) }
  }
  return <PistaWorkshop mode="1 celular" onBack={() => step === 'categories' ? setStep('players') : navigate('/games/pista-unica')} footer={<>
    {error && <p className="pw-alert" role="alert">{error}</p>}
    <button className="pw-button" type="button" disabled={participantCount < 3 || busy} onClick={() => step === 'players' ? setStep('categories') : void begin()}>{step === 'players' ? 'Escolher categorias' : busy ? 'Preparando...' : t('setup.start')}<ArrowRight size={18} /></button>
    <p className="pw-footer-note">{step === 'players' ? '3 a 12 pessoas · um celular passa de mão em mão' : 'Acerto: +2 · Cada autor de pista válida: +1'}</p>
  </>}>
    <WorkshopHeading eyebrow={step === 'players' ? '01 / Monte sua mesa' : '02 / Escolha seu baralho'} title={step === 'players' ? t('setup.players') : 'O que vamos adivinhar?'}>{step === 'players' ? 'Chame a galera. Cada pessoa será o adivinhador uma vez.' : 'Misture os temas ou escolha seu favorito.'}</WorkshopHeading>
    {step === 'players' ? <>
      <div className="pw-setup-meta"><span>{participantCount} / 12 selecionados</span><button type="button" onClick={() => navigate('/players')}>{t('setup.manage')}</button></div>
      <div className="pw-player-toolbar"><button type="button" disabled={!eligiblePlayers.length || availableSlots === 0} onClick={toggleAllPlayers}>{allSelected ? 'Desmarcar todos' : 'Selecionar todos'}</button></div>
      {(group?.players.length || guests.length) ? <div className="pw-player-list" role="region" aria-label="Jogadores da mesa" tabIndex={0}>
        {(group?.players ?? []).map(player => <div className="pw-person" key={player.id}><button type="button" aria-pressed={selectedIds.includes(player.id)} onClick={() => togglePlayer(player.id)}><span className="pw-person-check">{selectedIds.includes(player.id) && <Check size={14} />}</span><strong>{player.name}</strong></button></div>)}
        {guests.map(guest => <div className="pw-person" key={guest.id}><strong>{guest.name}<small>{t('setup.guest')}</small></strong><button className="pw-person-remove" type="button" aria-label={t('setup.remove', { name: guest.name })} onClick={() => { setGuests(current => current.filter(item => item.id !== guest.id)); setError('') }}><X size={16} /></button></div>)}
      </div> : <p className="pw-note">{t('setup.empty')}</p>}
      {(group?.players.length ?? 0) > availableSlots && <p className="pw-player-limit">Limite de 12 participantes. Os convidados ocupam vagas na mesa.</p>}
      <form className="pw-guest-form" onSubmit={event => { event.preventDefault(); addGuest() }}><input aria-label={t('setup.guestLabel')} maxLength={32} placeholder={t('setup.guestPlaceholder')} value={guestName} onChange={event => setGuestName(event.target.value)} /><button className="pw-button" type="submit" aria-label="Adicionar convidado" disabled={participantCount >= 12}><Plus size={20} /></button></form>
    </> : <div className="pw-categories">{PISTA_UNICA_CATEGORIES.map(category => {
      const Icon = categoryIcons[category]
      return <button className="pw-category" key={category} type="button" aria-pressed={categories.includes(category)} onClick={() => toggleCategory(category)}><Icon size={27} /><span><strong>{t(`categories.${category}.name`)}</strong><small>{t(`categories.${category}.description`)}</small></span>{categories.includes(category) && <Check size={17} />}</button>
    })}</div>}
  </PistaWorkshop>
}
