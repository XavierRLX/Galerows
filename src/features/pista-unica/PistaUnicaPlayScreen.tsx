import { ArrowRight, Check, Eye, EyeOff, Pencil, SkipForward } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppHaptics } from '../../lib/capacitor/haptics'
import { getPistaUnicaTarget } from './pistaUnica.content'
import { getVisiblePistaUnicaClues, normalizeClue } from './pistaUnica.session'
import { usePistaUnicaStore } from './pistaUnica.store'
import type { PistaUnicaClue, PistaUnicaSession } from './pistaUnica.types'
import { usePistaUnicaInitialization } from './usePistaUnicaInitialization'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'
import { AwardReceipt, CardDeck, ClueProgress, PaperCard, PistaWorkshop, SealedCard, WorkshopConfirm, WorkshopHeading } from './PistaWorkshop'

export function PistaUnicaPlayScreen() {
  const navigate = useNavigate()
  const { session, initialized } = usePistaUnicaStore()
  usePistaUnicaInitialization()
  usePistaUnicaTheme()
  useEffect(() => {
    if (initialized && !session) navigate('/games/pista-unica', { replace: true })
    if (session?.phase === 'finished') navigate('/games/pista-unica/result', { replace: true })
  }, [initialized, navigate, session])
  if (!session) return <PistaWorkshop mode="1 celular"><p role="status">Preparando a mesa...</p></PistaWorkshop>
  return <LocalRound key={`${session.id}:${session.phase}:${session.round}:${session.clueIndex}`} session={session} />
}

function LocalTable({ session, children, footer }: { session: PistaUnicaSession; children: ReactNode; footer: ReactNode }) {
  const navigate = useNavigate()
  const stage = session.phase === 'review' ? 1 : session.phase === 'guess' ? 2 : session.phase === 'round-result' ? 3 : 0
  return <PistaWorkshop mode="1 celular" round={session.round} total={session.participants.length} stage={stage} onBack={() => navigate('/games/pista-unica')} footer={footer}>{children}</PistaWorkshop>
}

function LocalRound({ session }: { session: PistaUnicaSession }) {
  const { t } = useTranslation('pista-unica')
  const { openClue, continueRound } = usePistaUnicaStore()
  const target = getPistaUnicaTarget(session.currentTargetId)
  const guesser = session.participants[session.currentGuesserIndex]
  if (!target || !guesser) return null
  const contributor = session.participants.find(person => person.id === session.clueOrder[session.clueIndex])
  if (session.phase === 'pass-clue' && contributor) return <LocalTable session={session} footer={<><button className="pw-button" type="button" onClick={() => void openClue()}><Eye size={18} />{t('play.showTarget')}</button><p className="pw-footer-note">Só {contributor.name} deve olhar a próxima carta.</p></>}>
    <WorkshopHeading eyebrow="De mão em mão" title={t('play.passTo', { name: contributor.name })}><strong>{guesser.name}</strong> vai adivinhar. Mantenha a carta em segredo.</WorkshopHeading>
    <SealedCard name={contributor.name}>Uma boa pista muda o jogo.</SealedCard>
    <ClueProgress count={session.clues.length} total={session.clueOrder.length} />
  </LocalTable>
  if (session.phase === 'write-clue' && contributor) return <WriteClue session={session} contributorId={contributor.id} contributorName={contributor.name} target={target.title} />
  if (session.phase === 'review') return <ReviewClues session={session} target={target.title} />
  if (session.phase === 'guess') return <GuessScreen session={session} clues={getVisiblePistaUnicaClues(session.clues, target.title)} guesserName={guesser.name} />
  if (session.phase === 'round-result') {
    const result = session.lastRoundResult
    if (!result) return null
    const awards = result.correct ? [{ id: guesser.id, name: guesser.name, points: 2, reason: 'Acertou o desafio' }, ...(result.creditedPlayerIds ?? []).map(id => ({ id, name: session.participants.find(p => p.id === id)?.name ?? 'Autor', points: 1, reason: 'Pista válida' }))] : []
    return <LocalTable session={session} footer={<button className="pw-button" type="button" onClick={() => void continueRound()}>{session.round >= session.participants.length ? t('result.seeRanking') : t('result.nextRound')}<ArrowRight size={18} /></button>}>
      <WorkshopHeading eyebrow="A grande revelação" title={result.correct ? t('result.correctTitle') : t('result.skipTitle')}>{result.correct ? `${guesser.name} conectou as pistas.` : result.clueCount === 0 ? 'Nenhuma pista sobreviveu. A próxima rodada é uma nova chance.' : `${guesser.name} não pontuou nesta rodada.`}</WorkshopHeading>
      <PaperCard label={t('result.answer')} tone={result.correct ? 'lime' : 'lavender'} className="pw-result-card">{target.title}</PaperCard>
      <AwardReceipt awards={awards} note={result.correct && !result.creditedPlayerIds ? 'Créditos das pistas indisponíveis nesta partida antiga.' : undefined} />
    </LocalTable>
  }
  return null
}

/** Unmount private contents on focus loss. Drafts are owned above this boundary. */
function PrivateSurface({ session, name, review = false, children, footer }: { session: PistaUnicaSession; name: string; review?: boolean; children: ReactNode; footer: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const hide = () => setRevealed(false)
    const visibility = () => { if (document.visibilityState === 'hidden') hide() }
    window.addEventListener('blur', hide); document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return <LocalTable session={session} footer={revealed ? footer : <button className="pw-button" type="button" onClick={() => setRevealed(true)}><Eye size={18} />{review ? 'Abrir revisão privada' : 'Ver desafio secreto'}</button>}>
    {revealed ? <>{children}<button className="pw-private-toggle" type="button" onClick={() => setRevealed(false)}><EyeOff size={14} />Ocultar informações privadas</button></> : <>
      <WorkshopHeading eyebrow={review ? 'Só os autores podem ver' : 'Sua vez de criar'} title={review ? 'Revisão a portas fechadas.' : `${name}, sua carta chegou.`}>{review ? 'O adivinhador não pode olhar. Abram a revisão com o restante da galera.' : 'Veja o desafio e escreva uma pista que ninguém mais pensaria.'}</WorkshopHeading>
      <SealedCard name={review ? 'Revisão privada' : name}>A carta fecha ao sair desta tela.</SealedCard>
      {!review && <ClueProgress count={session.clues.length} total={session.clueOrder.length} />}
    </>}
  </LocalTable>
}

function WriteClue({ session, contributorId, contributorName, target }: { session: PistaUnicaSession; contributorId: string; contributorName: string; target: string }) {
  const { t } = useTranslation('pista-unica')
  const addClue = usePistaUnicaStore(state => state.addClue)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (busy || !text.trim()) return
    setBusy(true); setError('')
    try { await addClue(contributorId, text); void AppHaptics.light() } catch { setError('Não foi possível salvar. Tente novamente.'); setBusy(false) }
  }
  return <PrivateSurface session={session} name={contributorName} footer={<button className="pw-button" type="button" disabled={busy || !text.trim()} onClick={() => void save()}>{busy ? 'Guardando sua pista...' : t('play.saveClue')}<ArrowRight size={18} /></button>}>
    <WorkshopHeading eyebrow={`Carta de ${contributorName}`} title="Uma pista. A sua." />
    <PaperCard label={t('play.secretTarget')} tone="lime">{target}</PaperCard>
    <div className="pw-field"><label htmlFor="pista">{t('play.clueLabel')}</label><input id="pista" autoComplete="off" maxLength={48} placeholder={t('play.cluePlaceholder')} value={text} onChange={event => setText(event.target.value)} disabled={busy} /><small>{t('play.clueHint')}</small></div>
    {error && <p className="pw-alert" role="alert">{error}</p>}
  </PrivateSurface>
}

function ReviewClues({ session, target }: { session: PistaUnicaSession; target: string }) {
  const { t } = useTranslation('pista-unica')
  const { updateClue, toggleClue, beginGuess } = usePistaUnicaStore()
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(session.clues.map(clue => [clue.id, clue.text])))
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const edited = session.clues.map(clue => ({ ...clue, text: drafts[clue.id]?.trim() ? drafts[clue.id]! : clue.text }))
  const visible = getVisiblePistaUnicaClues(edited, target)
  const saveAllAndBegin = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      for (const clue of edited) if (clue.text !== session.clues.find(item => item.id === clue.id)?.text) await updateClue(clue.id, clue.text)
      await beginGuess(); void AppHaptics.medium()
    } catch { setError('Não foi possível salvar a revisão. Tente novamente.'); setBusy(false) }
  }
  return <PrivateSurface session={session} name="Revisão" review footer={<><button className="pw-button" type="button" disabled={busy} onClick={() => visible.length ? void saveAllAndBegin() : setConfirmEmpty(true)}><EyeOff size={18} />{visible.length ? t('review.showGuesser') : 'Concluir sem pistas válidas'}</button><p className="pw-footer-note">{visible.length} de {session.clues.length} pistas prontas · desafio: {target}</p></>}>
    <WorkshopHeading eyebrow="Seleção da oficina" title={t('review.title')} />
    <CardDeck label="Revisão">{edited.map(clue => {
      const name = session.participants.find(person => person.id === clue.participantId)?.name ?? 'Autor'
      const answer = normalizeClue(clue.text) === normalizeClue(target)
      const duplicate = edited.filter(item => normalizeClue(item.text) === normalizeClue(clue.text)).length > 1
      const automatic = answer || duplicate
      const active = visible.some(item => item.id === clue.id)
      const status = answer ? 'Igual à resposta — anulada' : duplicate ? 'Repetida — anulada' : !clue.included ? 'Removida manualmente' : 'Pista válida'
      return <div key={clue.id}><PaperCard label={`Pista de ${name}`} tone={active ? 'cream' : 'muted'} stamp={status}><input className="pw-review-input" aria-label={`Editar pista de ${name}`} maxLength={48} value={drafts[clue.id] ?? clue.text} disabled={busy} onChange={event => setDrafts(current => ({ ...current, [clue.id]: event.target.value }))} /></PaperCard>
        <div className="pw-review-actions"><button className="pw-button pw-button--secondary" type="button" disabled={busy || automatic} onClick={() => void toggleClue(clue.id)}>{automatic ? <><Pencil size={15} />Edite a pista para recuperar</> : clue.included ? t('review.exclude') : t('review.include')}</button></div>
      </div>
    })}</CardDeck>
    {error && <p className="pw-alert" role="alert">{error}</p>}
    {confirmEmpty && <WorkshopConfirm title="Nenhuma pista válida" description="A rodada termina com zero pontos para todos." confirm="Concluir rodada" onCancel={() => setConfirmEmpty(false)} onConfirm={() => void saveAllAndBegin()} disabled={busy} />}
  </PrivateSurface>
}

function GuessScreen({ session, guesserName, clues }: { session: PistaUnicaSession; guesserName: string; clues: PistaUnicaClue[] }) {
  const { t } = useTranslation('pista-unica')
  const finishRound = usePistaUnicaStore(state => state.finishRound)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = async (correct: boolean) => {
    if (busy) return
    setBusy(true)
    try { await finishRound(correct); void AppHaptics.medium() } catch { setBusy(false); setError('Não foi possível salvar. Tente novamente.') }
  }
  return <LocalTable session={session} footer={<><button className="pw-button" type="button" disabled={busy} onClick={() => void finish(true)}><Check size={19} />{t('guess.correct')}</button><button className="pw-button pw-button--secondary" type="button" disabled={busy} onClick={() => void finish(false)}><SkipForward size={18} />{t('guess.skip')}</button></>}>
    <WorkshopHeading eyebrow={`${guesserName}, o palco é seu`} title={t('guess.instruction')}>Leia as cartas e diga seu palpite em voz alta.</WorkshopHeading>
    <CardDeck label="Pistas">{clues.map((clue, i) => <PaperCard key={clue.id} label={`Pista ${String(i + 1).padStart(2, '0')}`} tone={i % 2 ? 'lavender' : 'cream'} stamp="ÚNICA · APROVADA">{clue.text}</PaperCard>)}</CardDeck>
    <p className="pw-note">{clues.length === 1 ? '1 pista sobreviveu à revisão.' : `${clues.length} pistas sobreviveram à revisão.`}<br />Acertou? +2 para você e +1 para cada autor válido.</p>
    {error && <p className="pw-alert" role="alert">{error}</p>}
  </LocalTable>
}
