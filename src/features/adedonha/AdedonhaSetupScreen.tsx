import QRCode from 'qrcode'
import { Camera, Copy, Plus, QrCode, RotateCcw, Share2, Shuffle, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/utils/cn'
import { shuffle } from '../../lib/utils/shuffle'
import { decodeAdedonhaShare, defaultAdedonhaCategories, drawAdedonhaLetter, encodeAdedonhaShare, funAdedonhaCategories, normalizeAdedonhaCategories } from './adedonha.session'
import { useAdedonhaStore } from './adedonha.store'
import { AdedonhaQrScanner } from './AdedonhaQrScanner'

export function AdedonhaSetupScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const start = useAdedonhaStore((state) => state.start)
  const initialCode = searchParams.get('code') ?? ''
  const initialPayload = useMemo(() => decodeAdedonhaShare(initialCode), [initialCode])
  const [categories, setCategories] = useState(() => initialPayload?.c ?? defaultAdedonhaCategories)
  const [customCategory, setCustomCategory] = useState('')
  const [shareCode, setShareCode] = useState(initialCode)
  const [error, setError] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [shareLetter, setShareLetter] = useState(() => initialPayload?.l ?? drawAdedonhaLetter())
  const [suggestionRefresh, setSuggestionRefresh] = useState(0)
  const cleanCategories = normalizeAdedonhaCategories(categories)
  const setupShareCode = useMemo(() => encodeAdedonhaShare(cleanCategories.map((title) => ({ id: title, title })), shareLetter), [cleanCategories, shareLetter])
  const setupShareUrl = useMemo(() => `${window.location.origin}/games/adedonha/setup?code=${encodeURIComponent(setupShareCode)}`, [setupShareCode])
  const suggestions = useMemo(() => {
    void suggestionRefresh
    return shuffle(funAdedonhaCategories).slice(0, 8)
  }, [suggestionRefresh])

  const addCategory = (category: string) => {
    const normalized = normalizeAdedonhaCategories([...categories, category])
    if (normalized.length === categories.length && category.trim()) setError('Esse tema já está na lista ou o limite de 16 temas foi atingido.')
    else setError('')
    setCategories(normalized.length ? normalized : [''])
    setCustomCategory('')
  }
  const importSharedValue = useCallback((value: string) => {
    const code = extractAdedonhaCode(value)
    const payload = decodeAdedonhaShare(code)
    if (!payload) { setError('Não consegui ler esse código. Confira se ele foi copiado inteiro.'); return }
    setCategories(payload.c)
    setShareCode(code)
    setShareLetter(payload.l)
    setError('')
    setScannerOpen(false)
  }, [])
  const importCode = () => importSharedValue(shareCode)
  useEffect(() => {
    if (!shareOpen) return
    QRCode.toDataURL(setupShareUrl, { margin: 1, width: 280 }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [shareOpen, setupShareUrl])
  const begin = async () => {
    if (!cleanCategories.length) { setError('Adicione pelo menos um tema.'); return }
    const imported = decodeAdedonhaShare(shareCode)
    await start(cleanCategories, imported?.l)
    navigate('/games/adedonha/play')
  }

  return <div className="min-h-dvh pb-10"><Header backTo="/games/adedonha" title="Preparar Adedonha" /><section className="px-5 py-6">
    <Card className="border-yellow-300/30 bg-yellow-400/10 p-5"><p className="text-sm font-black uppercase tracking-[0.18em] text-yellow-200">Temas da rodada</p><h1 className="mt-2 text-2xl font-black">Monte a folha da galera</h1><p className="mt-2 text-sm leading-6 text-slate-300">Use os temas clássicos, adicione categorias diferentes ou importe a lista que alguém compartilhou.</p></Card>
    <Card className="mt-5 p-5"><h2 className="text-lg font-black">Importar temas</h2><p className="mt-1 text-sm leading-6 text-slate-400">Escaneie o QR da galera ou cole o código compartilhado.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button className="bg-yellow-400 text-slate-950 hover:bg-yellow-300" onClick={() => setScannerOpen(true)}><Camera size={18} />Escanear QR</Button><Button variant="secondary" onClick={importCode}><QrCode size={18} />Importar código</Button></div><textarea aria-label="Código compartilhado" className="mt-3 min-h-24 w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-sm outline-none focus:border-yellow-300" placeholder="Cole o código ou o link do QR Code" value={shareCode} onChange={(event) => setShareCode(event.target.value)} /></Card>
    <div className="mt-6 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Temas</h2><p className="text-sm text-slate-400">{cleanCategories.length}/16 selecionados</p></div><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setShareOpen(true)}><Share2 size={18} />Compartilhar</Button><Button variant="secondary" onClick={() => { setCategories(['']); setError('') }}><RotateCcw size={18} />Limpar</Button><Button variant="secondary" onClick={() => setCategories(defaultAdedonhaCategories)}>Padrões</Button></div></div>
    <Card className="mt-4 overflow-hidden">{cleanCategories.map((category, index) => <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 last:border-0" key={category}><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-black text-slate-950">{index + 1}</span><input aria-label={`Tema ${index + 1}`} className="min-h-10 min-w-0 flex-1 bg-transparent font-bold outline-none" value={category} onChange={(event) => setCategories((current) => current.map((item) => item === category ? event.target.value : item))} /><Button aria-label={`Remover ${category}`} size="icon" variant="ghost" onClick={() => setCategories((current) => current.filter((item) => item !== category))}><Trash2 size={17} /></Button></div>)}</Card>
    <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); addCategory(customCategory) }}><input aria-label="Novo tema" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-yellow-300" placeholder="Ex.: Minha sogra é..." value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} /><Button type="submit"><Plus size={18} />Adicionar</Button></form>
    <Card className="mt-5 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Sugestões diferentes</h2><p className="mt-1 text-sm text-slate-400">Toque para adicionar temas mais engraçados.</p></div><Button size="icon" variant="secondary" onClick={() => setSuggestionRefresh((current) => current + 1)}><Shuffle size={18} /></Button></div><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((suggestion) => {
      const selected = cleanCategories.some((category) => category.toLocaleLowerCase('pt-BR') === suggestion.toLocaleLowerCase('pt-BR'))
      return <button className={cn('rounded-full border px-3 py-2 text-sm font-bold transition', selected ? 'border-yellow-300 bg-yellow-300 text-slate-950' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10')} disabled={!selected && cleanCategories.length >= 16} key={suggestion} onClick={() => addCategory(suggestion)} type="button">{suggestion}</button>
    })}</div></Card>
    {error ? <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{error}</p> : null}
    <div className="mt-6 grid gap-3"><Button className="w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300" disabled={!cleanCategories.length} size="lg" onClick={() => void begin()}>Começar folha</Button><Button className="w-full" disabled={!cleanCategories.length} size="lg" variant="secondary" onClick={() => setShareOpen(true)}><QrCode size={18} />Compartilhar temas</Button></div>
  </section>{scannerOpen ? <AdedonhaQrScanner onClose={() => setScannerOpen(false)} onScan={importSharedValue} /> : null}
    <Modal open={shareOpen} title="Compartilhar temas" onClose={() => setShareOpen(false)}>
      <p className="text-sm leading-6 text-slate-300">Mostre o QR para a galera ou envie o código. Quem importar recebe os temas criados e a letra da rodada.</p>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-yellow-300/30 bg-yellow-400/10 px-4 py-3"><span className="text-sm font-bold text-slate-300">Letra compartilhada</span><button className="flex size-12 items-center justify-center rounded-2xl bg-yellow-400 text-2xl font-black text-slate-950" onClick={() => setShareLetter(drawAdedonhaLetter())} type="button">{shareLetter}</button></div>
      <div className="mt-4 rounded-2xl bg-white p-3">{qrDataUrl ? <img alt="QR Code dos temas de Adedonha" className="mx-auto size-64" src={qrDataUrl} /> : <div className="flex h-64 items-center justify-center text-slate-500">Gerando QR...</div>}</div>
      <textarea aria-label="Código para compartilhar" className="mt-4 h-28 w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-xs text-slate-200" readOnly value={setupShareCode} />
      <Button className="mt-3 w-full" variant="secondary" onClick={() => void navigator.clipboard?.writeText(setupShareCode)}><Copy size={18} />Copiar código</Button>
    </Modal>
  </div>
}

function extractAdedonhaCode(value: string) {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    return url.searchParams.get('code') ?? trimmed
  } catch {
    return trimmed
  }
}
