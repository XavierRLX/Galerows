import { FileJson, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { supportedLocales, type SupportedLocale } from '../../i18n'
import { LocalPreferences } from '../../lib/capacitor/preferences'
import { contentOverrideKey } from '../../lib/storage/storage.keys'
import type { ImpostorDaPalavraDeck } from '../impostor-da-palavra/content/impostorDaPalavraContent.types'
import { validateImpostorDaPalavraDeck } from '../impostor-da-palavra/content/impostorDaPalavraContent.validator'
import type { NemFerrandoDeck } from '../nem-ferrando/content/nemFerrandoContent.types'
import { validateNemFerrandoDeck } from '../nem-ferrando/content/nemFerrandoContent.validator'
import type { TabooDeck } from '../taboo/content/tabooContent.types'
import { validateTabooDeck } from '../taboo/content/tabooContent.validator'

type AdminGameId = 'nem-ferrando' | 'impostor-da-palavra' | 'taboo'
type AdminDeck = NemFerrandoDeck | ImpostorDaPalavraDeck | TabooDeck

const adminGames: { id: AdminGameId; name: string }[] = [
  { id: 'nem-ferrando', name: 'Nem Ferrando' },
  { id: 'impostor-da-palavra', name: 'Impostor da Palavra' },
  { id: 'taboo', name: 'Dica Proibida' },
]

export function ContentAdminScreen() {
  const { i18n } = useTranslation()
  const currentLocale = supportedLocales.includes(i18n.resolvedLanguage as SupportedLocale) ? i18n.resolvedLanguage as SupportedLocale : 'pt-BR'
  const [gameId, setGameId] = useState<AdminGameId>('nem-ferrando')
  const [text, setText] = useState('')
  const [deck, setDeck] = useState<AdminDeck | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')

  const validate = () => {
    try {
      const parsed: unknown = JSON.parse(text)
      const result = gameId === 'nem-ferrando' ? validateNemFerrandoDeck(parsed, currentLocale) : gameId === 'impostor-da-palavra' ? validateImpostorDaPalavraDeck(parsed, currentLocale) : validateTabooDeck(parsed, currentLocale)
      setErrors(result.errors)
      setDeck(result.valid ? parsed as AdminDeck : null)
      setMessage(result.valid ? 'JSON válido e pronto para teste.' : '')
    } catch {
      setDeck(null); setErrors(['$ contém JSON inválido.']); setMessage('')
    }
  }
  const activate = async () => {
    if (!deck) return
    await LocalPreferences.setJson(contentOverrideKey(gameId, currentLocale), deck)
    setMessage('Override local ativado neste aparelho.')
  }
  const remove = async () => {
    await LocalPreferences.remove(contentOverrideKey(gameId, currentLocale))
    setMessage('Override removido. O baralho empacotado será usado.')
  }

  return (
    <div className="min-h-dvh pb-10"><Header backTo="/settings" title="Administração de conteúdo" />
      <section className="px-5 py-7">
        <Card className="p-5"><div className="flex items-center gap-3"><FileJson className="text-lime-300" /><div><h1 className="text-xl font-black">Conteúdo dos jogos</h1><p className="text-sm text-slate-400">Validação para {currentLocale}. O override permanece apenas neste aparelho.</p></div></div>
          <div className="mt-5 grid grid-cols-2 gap-2">{adminGames.map((game) => <Button key={game.id} variant={gameId === game.id ? 'primary' : 'secondary'} onClick={() => { setGameId(game.id); setDeck(null); setErrors([]); setMessage('') }}>{game.name}</Button>)}</div>
          <label className="mt-5 block text-sm font-bold" htmlFor="deck-json">JSON do baralho</label>
          <textarea id="deck-json" className="mt-2 min-h-64 w-full rounded-2xl border border-white/15 bg-slate-950 p-4 font-mono text-xs leading-5 outline-none focus:border-lime-400" placeholder="Cole o manifesto JSON aqui" value={text} onChange={(event) => setText(event.target.value)} />
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-violet-300"><Upload size={17} />Importar arquivo<input accept="application/json,.json" className="sr-only" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setText) }} /></label>
          <div className="mt-4 flex flex-wrap gap-2"><Button onClick={validate}>Validar e visualizar</Button><Button disabled={!deck} variant="secondary" onClick={() => void activate()}>Ativar override</Button><Button variant="ghost" onClick={() => void remove()}><Trash2 size={17} />Remover override</Button></div>
          {message ? <p className="mt-4 text-sm font-bold text-lime-300" role="status">{message}</p> : null}
          {errors.length ? <div className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        </Card>
        {deck ? <Card className="mt-5 p-5"><p className="text-sm font-bold uppercase tracking-wider text-slate-400">Pré-visualização</p>{deck.gameId === 'nem-ferrando' ? <NemFerrandoPreview deck={deck as NemFerrandoDeck} /> : deck.gameId === 'impostor-da-palavra' ? <ImpostorPreview deck={deck as ImpostorDaPalavraDeck} /> : <TabooPreview deck={deck as TabooDeck} />}</Card> : null}
      </section>
    </div>
  )
}

function NemFerrandoPreview({ deck }: { deck: NemFerrandoDeck }) {
  return <div className="mt-3 rounded-3xl border border-orange-400/40 bg-orange-500/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-orange-200">Carta #{String(deck.cards[0].number).padStart(2, '0')}</p><div className="mt-1 flex justify-between gap-3"><h2 className="text-2xl font-black text-orange-300">{deck.cards[0].theme}</h2><span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-black">{deck.cards[0].irons} Ferros</span></div>{deck.cards[0].curiosities.map((item, index) => <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm" key={item.id}>{index + 1}. {item.question}</div>)}</div>
}

function ImpostorPreview({ deck }: { deck: ImpostorDaPalavraDeck }) {
  const card = deck.cards[0]
  return <div className="mt-3 rounded-3xl border border-violet-400/40 bg-violet-500/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-violet-200">{card.category}</p><h2 className="mt-1 text-3xl font-black text-violet-200">{card.word}</h2><div className="mt-4 grid gap-2 text-sm"><p><strong>Dica:</strong> {card.impostorHint}</p><p><strong>Palavra alternativa:</strong> {card.alternateWord}</p><p><strong>Perguntas:</strong> {card.questionIds.length}</p></div></div>
}

function TabooPreview({ deck }: { deck: TabooDeck }) {
  const card = deck.cards[0]
  return <div className="mt-3 rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-200">{card.category}</p><h2 className="mt-1 text-3xl font-black text-emerald-100">{card.word}</h2><div className="mt-4 flex flex-wrap gap-2">{card.forbiddenWords.map((word) => <span className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-200" key={word}>{word}</span>)}</div></div>
}
