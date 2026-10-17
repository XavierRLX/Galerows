import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Pencil, RotateCcw, Trophy, WifiOff } from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { PistaUnicaLanPrivate, PistaUnicaLanPublic } from '../../pistaUnicaLanGame'
import { AwardReceipt, CardDeck, ClueProgress, PaperCard, PistaWorkshop, SealedCard, WorkshopConfirm, WorkshopHeading } from '../../../pista-unica/PistaWorkshop'

type Props = {
  snapshot: RoomSnapshotV2
  playerId: string
  isHost: boolean
  busy: boolean
  connected: boolean
  onAction: (type: string, payload: unknown) => void | Promise<void>
  onEnd: () => void | Promise<void>
  onBack?: () => void | Promise<void>
  onReconnect?: () => void | Promise<void>
  onReplay?: () => void | Promise<void>
  onBackToLobby?: () => void | Promise<void>
  onLeave?: () => void | Promise<void>
  onClose?: () => void | Promise<void>
  error?: string
}

/** Remount across player, GameSession, round, phase and network boundaries. */
export function PistaUnicaLanRound(props: Props) {
  const game = props.snapshot.gamePublicState
  const publicData = game?.gameId === 'pista-unica' ? game.data as PistaUnicaLanPublic : null
  const key = `${props.playerId}:${props.snapshot.roomState.currentGameSessionId}:${publicData?.round}:${publicData?.step}:${props.connected}`
  return <PistaUnicaLanBody key={key} {...props} />
}

function PistaUnicaLanBody({ snapshot, playerId, isHost, busy, connected, onAction, onEnd, onBack, onReconnect, onReplay, onBackToLobby, onLeave, onClose, error }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [clue, setClue] = useState('')
  const [answer, setAnswer] = useState('')
  const [sent, setSent] = useState(false)
  const [confirmation, setConfirmation] = useState<'end' | 'empty' | 'leave' | null>(null)
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    const conceal = () => setRevealed(false)
    const hideOnBackground = () => { if (document.visibilityState === 'hidden') conceal() }
    window.addEventListener('blur', conceal); document.addEventListener('visibilitychange', hideOnBackground)
    return () => { window.removeEventListener('blur', conceal); document.removeEventListener('visibilitychange', hideOnBackground) }
  }, [])

  const sessionId = snapshot.roomState.currentGameSessionId
  const publicState = snapshot.gamePublicState
  if (!sessionId || !publicState || publicState.gameSessionId !== sessionId || publicState.gameId !== 'pista-unica') return null
  const data = publicState.data as PistaUnicaLanPublic
  const privateState = snapshot.privateState
  const mine = connected && privateState?.gameSessionId === sessionId && privateState.gameId === 'pista-unica' ? privateState.data as PistaUnicaLanPrivate : null
  const people = snapshot.roomState.members
  const label = (id: string) => {
    const member = people.find(person => person.playerId === id)
    return member?.displayName || (id === snapshot.roomState.hostPlayerId ? 'Anfitrião' : `Jogador ${people.findIndex(person => person.playerId === id) + 1}`)
  }
  const isGuesser = data.guesserId === playerId
  const participating = people.some(person => person.playerId === playerId && person.participation === 'active')
  const blocked = !connected || busy || sent || !participating
  const review = !isGuesser && data.reviewerId === playerId && mine?.kind === 'writer' ? mine.reviewClues : undefined
  const ended = snapshot.roomState.phase === 'results'
  const submit = async (type: string, payload: unknown) => {
    if (blocked) return
    setSent(true); setActionError(''); setRevealed(false)
    try { await onAction(type, payload) } catch { setSent(false); setActionError('Não foi possível enviar. Tente novamente.') }
  }
  const stage = data.step === 'writing' ? 0 : data.step === 'review' ? 1 : data.step === 'guessing' ? 2 : 3
  let footer: ReactNode = null
  let content: ReactNode = null

  if (data.step === 'writing') {
    const submitted = mine?.submitted || sent
    content = <>
      <WorkshopHeading eyebrow={isGuesser ? 'O palco é seu' : `Carta de ${label(playerId)}`} title={isGuesser ? 'Você vai adivinhar!' : submitted ? 'Sua pista está na mesa.' : 'Uma pista. A sua.'}>
        {isGuesser ? 'Não olhe as telas dos outros. Em instantes, só as pistas válidas chegam até você.' : <><strong>{label(data.guesserId)}</strong> vai adivinhar.</>}
      </WorkshopHeading>
      {!isGuesser && mine?.kind === 'writer' && !submitted && revealed ? <>
        <PaperCard label="Palavra para dar a pista" tone="lime"><span data-testid="pista-lan-target">{mine.target}</span></PaperCard>
        <div className="pw-field"><label htmlFor="pl03-pista-text">Minha pista</label><input id="pl03-pista-text" autoComplete="off" value={clue} maxLength={48} onChange={event => setClue(event.target.value)} disabled={blocked} placeholder="Uma palavra ou expressão curta" /><small>Não escreva a resposta. Pistas iguais são todas anuladas.</small></div>
        <button className="pw-private-toggle" type="button" onClick={() => setRevealed(false)}><EyeOff size={15} />Ocultar desafio secreto</button>
      </> : <SealedCard name={isGuesser ? label(data.guesserId) : submitted ? 'Pista guardada' : 'Seu desafio secreto'}>{submitted ? 'Aguarde o restante da galera.' : 'Só os autores podem abrir.'}</SealedCard>}
      <ClueProgress count={data.submittedCount} total={data.requiredCount} />
    </>
    footer = isGuesser ? <p className="pw-footer-note">Cada jogador escreve no próprio celular.</p> : mine?.kind === 'writer' && !submitted ? <>
      {!revealed && <button className="pw-button" type="button" disabled={blocked} onClick={() => setRevealed(true)}><Eye size={18} />Ver desafio secreto</button>}
      <button className={revealed ? 'pw-button' : 'pw-button pw-button--secondary'} type="button" disabled={blocked || !revealed || !clue.trim()} onClick={() => void submit('SUBMIT_CLUE', { text: clue.trim() })}><Pencil size={18} />Enviar minha pista</button>
    </> : <p className="pw-footer-note" role="status">{submitted ? <><CheckCircle2 size={14} className="inline" /> Sua pista foi enviada. Aguarde o restante da galera.</> : 'Aguardando sua carta. A conexão precisa estar ativa.'}</p>
  }
  if (data.step === 'review') {
    content = <>
      <WorkshopHeading eyebrow={review ? 'Seleção da oficina' : 'As cartas estão sendo revisadas'} title="Revisão das pistas">
        {review ? 'Você é o revisor. Confira as pistas e libere o palpite.' : <>Aguardando <strong>{label(data.reviewerId)}</strong> revisar as pistas. A palavra e as pistas continuam privadas.</>}
      </WorkshopHeading>
      {review && revealed ? <div className="pw-review-deck" aria-label="Revisão privada das pistas"><CardDeck label="Revisão">{review.map(item => <div key={item.playerId}>
        <PaperCard label={`Pista de ${label(item.playerId)}`} tone={item.included ? 'cream' : 'muted'} stamp={item.reason === 'duplicate' ? 'Repetida — removida automaticamente' : item.reason === 'answer' ? 'Dica igual à palavra secreta — removida automaticamente' : item.reason === 'manual' ? 'Removida pelo revisor' : 'Pista válida'}>{item.text}</PaperCard>
        {item.reason !== 'duplicate' && item.reason !== 'answer' && <div className="pw-review-actions"><button type="button" className="pw-button pw-button--secondary" disabled={blocked} aria-label={item.included ? `Remover pista de ${label(item.playerId)}` : `Reincluir pista de ${label(item.playerId)}`} onClick={() => void onAction('SET_CLUE_INCLUDED', { playerId: item.playerId, included: !item.included })}>{item.included ? 'Remover pista' : 'Reincluir pista'}</button></div>}
      </div>)}</CardDeck></div> : <SealedCard name={review ? 'Revisão privada' : 'Mesa em revisão'}>{isGuesser ? 'A surpresa continua protegida.' : 'As pistas certas fazem a diferença.'}</SealedCard>}
      {review && revealed && <button className="pw-private-toggle" type="button" onClick={() => setRevealed(false)}><EyeOff size={15} />Ocultar revisão privada</button>}
    </>
    footer = review ? revealed ? <><button className="pw-button" type="button" disabled={blocked} onClick={() => review.some(item => item.included) ? void submit('CONFIRM_CLUES', null) : setConfirmation('empty')}>Confirmar pistas<ArrowRight size={18} /></button><p className="pw-footer-note">{review.filter(item => item.included).length} de {review.length} pistas aprovadas</p></> : <button className="pw-button" type="button" disabled={blocked} onClick={() => setRevealed(true)}><Eye size={18} />Abrir revisão privada</button> : <p className="pw-footer-note">{isHost && isGuesser ? 'Nesta rodada você adivinha. Outro autor faz a revisão.' : 'O revisor libera as cartas para toda a mesa.'}</p>
  }
  if (data.step === 'guessing') {
    content = <>
      <WorkshopHeading eyebrow={isGuesser ? 'O palco é seu' : 'Hora de conectar as pistas'} title={isGuesser ? 'Agora é sua vez de adivinhar!' : `${label(data.guesserId)} está pensando...`} />
      <div aria-label="Pistas válidas"><CardDeck label="Pistas">{data.clues.map((text, index) => <PaperCard key={index} label={`Pista ${String(index + 1).padStart(2, '0')}`} tone={index % 2 ? 'lavender' : 'cream'} stamp="ÚNICA · APROVADA">{text}</PaperCard>)}</CardDeck></div>
      <p className="pw-note">{data.clues.length} pistas na mesa{data.excludedCount > 0 ? ` · ${data.excludedCount} removidas na revisão` : ''}</p>
      {isGuesser && <div className="pw-field"><label htmlFor="pl03-pista-answer">Meu palpite</label><input id="pl03-pista-answer" value={answer} maxLength={80} autoComplete="off" onChange={event => setAnswer(event.target.value)} disabled={blocked} placeholder="Qual é a palavra?" /></div>}
    </>
    footer = isGuesser ? <button type="button" className="pw-button" onClick={() => void submit('SUBMIT_GUESS', { text: answer.trim() })} disabled={blocked || !answer.trim()}>{sent ? 'Palpite enviado' : 'Enviar palpite'}<ArrowRight size={18} /></button> : <p className="pw-footer-note">Aguarde o palpite de {label(data.guesserId)}.</p>
  }
  if (data.step === 'round-result' && data.lastResult) {
    const result = data.lastResult
    const awards = result.correct ? [{ id: result.guesserId, name: label(result.guesserId), points: 2, reason: 'Acertou o desafio' }, ...result.creditedPlayerIds.map(id => ({ id, name: label(id), points: 1, reason: 'Pista válida' }))] : []
    content = <>
      <WorkshopHeading eyebrow="A grande revelação" title={result.correct ? 'Acertou! +2 pontos' : 'Não foi dessa vez!'}>{result.guessedText ? <>Palpite de <strong>{label(result.guesserId)}</strong>: {result.guessedText}</> : 'Sem pistas válidas. Uma nova chance na próxima rodada.'}</WorkshopHeading>
      <PaperCard label="A resposta era" tone={result.correct ? 'lime' : 'lavender'} className="pw-result-card">{result.target}</PaperCard>
      <AwardReceipt awards={awards} />
      <p className="pw-footer-note">{result.clueCount} pistas válidas · {result.excludedCount} removidas</p>
    </>
    footer = isHost ? <button type="button" className="pw-button" disabled={blocked} onClick={() => void onAction('NEXT_ROUND', null)}>{data.round >= data.totalRounds ? 'Concluir partida' : 'Próxima rodada'}<ArrowRight size={18} /></button> : <p className="pw-footer-note">Aguardando o anfitrião continuar.</p>
  }
  if (data.step === 'summary') {
    const ranking = Object.entries(data.scores).sort((a, b) => b[1] - a[1] || label(a[0]).localeCompare(label(b[0])))
    content = <>
      <div className="pw-trophy"><Trophy size={38} /></div>
      <WorkshopHeading eyebrow="Toda pista conta" title="Resultado da Pista Única">{ended ? 'Pontos registrados. A mesma sala está pronta para continuar.' : 'Todos tiveram sua vez de adivinhar. Agora é hora de contar os pontos.'}</WorkshopHeading>
      <section className="pw-receipt" aria-label="Pontos desta partida"><h2>PONTOS DESTA PARTIDA</h2><CardDeck label="Classificação" pageSize={3}>{ranking.map(([id, value], index) => <div className="pw-ranking-row" key={id}><span className="pw-rank">{String(index + 1).padStart(2, '0')}</span><strong>{label(id)}</strong><b>{value} pt</b></div>)}</CardDeck></section>
    </>
    footer = ended ? <>{isHost && onReplay && <button className="pw-button" type="button" disabled={blocked} onClick={() => void onReplay()}><RotateCcw size={18} />Jogar novamente</button>}{isHost && onBackToLobby && <button className="pw-button pw-button--secondary" type="button" disabled={blocked} onClick={() => void onBackToLobby()}>Voltar à sala</button>}{!isHost && <p className="pw-footer-note">Aguardando o anfitrião preparar a próxima partida.</p>}</> : isHost ? <><button type="button" className="pw-button" disabled={blocked} onClick={() => setConfirmation('end')}>Finalizar partida e pontuar</button><p className="pw-footer-note">Os pontos serão somados ao placar da sala.</p></> : <p className="pw-footer-note">Aguardando o anfitrião encerrar. A mesma sala continua disponível.</p>
  }
  return <PistaWorkshop mode="Rede local" round={data.round} total={data.totalRounds} stage={data.step === 'summary' ? undefined : stage} onBack={onBack ? () => void onBack() : undefined} onExit={onLeave || onClose ? () => { setRevealed(false); setConfirmation('leave') } : undefined} footer={footer}>
    {!connected && <div className="pw-alert" role="status"><WifiOff size={17} />Conexão interrompida. Suas cartas ficam ocultas.{!isHost && onReconnect && <button type="button" disabled={busy} onClick={() => void onReconnect()}>Reconectar</button>}</div>}
    {(error || actionError) && <p className="pw-alert" role="alert">{error || actionError}</p>}
    {content}
    {confirmation && <WorkshopConfirm title={confirmation === 'end' ? 'Guardar os pontos?' : confirmation === 'empty' ? 'Nenhuma pista válida' : isHost ? 'Encerrar esta sala?' : 'Sair da sala?'} description={confirmation === 'end' ? 'A pontuação desta partida será somada ao placar. Vocês continuam na mesma sala.' : confirmation === 'empty' ? 'A rodada termina com zero pontos para todos.' : isHost ? 'A sala será encerrada para toda a galera.' : 'Você deixa a partida e precisará entrar novamente.'} confirm={confirmation === 'end' ? 'Confirmar encerramento' : confirmation === 'empty' ? 'Concluir rodada' : isHost ? 'Confirmar fim da sala' : 'Confirmar saída'} disabled={busy || (confirmation !== 'leave' && !connected)} onCancel={() => setConfirmation(null)} onConfirm={() => {
      const action = confirmation
      setConfirmation(null)
      if (action === 'end') void onEnd()
      else if (action === 'empty') void submit('CONFIRM_CLUES', null)
      else if (isHost) void onClose?.()
      else void onLeave?.()
    }} />}
  </PistaWorkshop>
}
