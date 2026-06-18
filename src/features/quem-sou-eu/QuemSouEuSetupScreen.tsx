import { Eye, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils/cn'
import { shuffle } from '../../lib/utils/shuffle'
import { useFakeAd } from '../ads/useFakeAd'
import { normalizeQuemSouEuWords } from './quemSouEu.session'
import { useQuemSouEuStore } from './quemSouEu.store'

type SuggestionGroup = {
  title: string
  items: string[]
}

export function QuemSouEuSetupScreen() {
  const { t } = useTranslation('quem-sou-eu')
  const navigate = useNavigate()
  const { showFakeAd } = useFakeAd()
  const start = useQuemSouEuStore((state) => state.start)
  const [words, setWords] = useState([''])
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionRefresh, setSuggestionRefresh] = useState(0)
  const cleanWords = normalizeQuemSouEuWords(words)
  const suggestionGroups = useMemo(() => t('suggestions.groups', { returnObjects: true }) as SuggestionGroup[], [t])
  const visibleSuggestionGroups = useMemo(() => {
    void suggestionRefresh
    return suggestionGroups.map((group) => ({
      ...group,
      items: shuffle(group.items).slice(0, 5),
    }))
  }, [suggestionGroups, suggestionRefresh])

  const updateWord = (index: number, value: string) => setWords((current) => current.map((word, itemIndex) => itemIndex === index ? value : word))
  const removeWord = (index: number) => setWords((current) => current.length === 1 ? [''] : current.filter((_, itemIndex) => itemIndex !== index))
  const addField = () => setWords((current) => current.length >= 5 ? current : [...current, ''])
  const addSuggestion = (word: string) => {
    setWords((current) => {
      const normalized = normalizeQuemSouEuWords(current)
      if (normalized.length >= 5 || normalized.some((item) => item.toLocaleLowerCase() === word.toLocaleLowerCase())) return current
      return [...normalized, word]
    })
    setError('')
  }
  const refreshSuggestions = () => {
    setShowSuggestions(true)
    setSuggestionRefresh((current) => current + 1)
  }
  const begin = async () => {
    const normalized = normalizeQuemSouEuWords(words)
    if (!normalized.length) { setError(t('setup.errors.empty')); return }
    await start(normalized)
    await showFakeAd({ placement: 'start-match' })
    navigate('/games/quem-sou-eu/play')
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/quem-sou-eu" title={t('setup.title')} /><section className="px-5 py-6">
    <Card className="border-sky-400/30 bg-sky-500/10 p-5"><p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">{t('setup.eyebrow')}</p><h1 className="mt-2 text-2xl font-black">{t('setup.heading')}</h1><p className="mt-2 text-sm leading-6 text-slate-300">{t('setup.description')}</p></Card>
    <div className="mt-6 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">{t('setup.wordsTitle')}</h2><p className="text-sm text-slate-400">{t('setup.wordCount', { count: cleanWords.length })}</p></div><Button disabled={words.length >= 5} variant="secondary" onClick={addField}><Plus size={18} />{t('setup.addField')}</Button></div>
    <div className="mt-4 grid gap-3">{words.map((word, index) => <div className="flex gap-2" key={index}><input aria-label={t('setup.wordLabel', { number: index + 1 })} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 text-base outline-none transition focus:border-sky-300" maxLength={40} placeholder={t('setup.wordPlaceholder')} value={word} onChange={(event) => updateWord(index, event.target.value)} /><Button aria-label={t('setup.removeWord', { number: index + 1 })} className="shrink-0" size="icon" variant="ghost" onClick={() => removeWord(index)}><Trash2 size={18} /></Button></div>)}</div>
    <Card className="mt-6 p-5"><div className="flex items-center gap-2"><Sparkles className="text-cyan-200" size={20} /><h2 className="text-lg font-black">{t('suggestions.title')}</h2></div><p className="mt-2 text-sm leading-6 text-slate-400">{showSuggestions ? t('suggestions.description') : t('suggestions.hiddenDescription')}</p><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => setShowSuggestions(true)}><Eye size={18} />{t('suggestions.show')}</Button><Button variant="secondary" onClick={refreshSuggestions}><RefreshCw size={18} />{t('suggestions.refresh')}</Button></div>{showSuggestions ? <div className="mt-5 grid gap-5">{visibleSuggestionGroups.map((group) => <div key={group.title}><p className="text-xs font-black uppercase tracking-wider text-slate-400">{group.title}</p><div className="mt-2 flex flex-wrap gap-2">{group.items.map((item) => {
      const selected = cleanWords.some((word) => word.toLocaleLowerCase() === item.toLocaleLowerCase())
      return <button className={cn('rounded-full border px-3 py-2 text-sm font-bold transition', selected ? 'border-sky-300 bg-sky-300 text-slate-950' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10')} disabled={!selected && cleanWords.length >= 5} key={item} onClick={() => addSuggestion(item)} type="button">{item}</button>
    })}</div></div>)}</div> : null}</Card>
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}<Button className="mt-6 w-full bg-sky-400 text-slate-950 hover:bg-sky-300" disabled={!cleanWords.length} size="lg" onClick={() => void begin()}>{t('setup.start')}</Button>
  </section></div>
}
