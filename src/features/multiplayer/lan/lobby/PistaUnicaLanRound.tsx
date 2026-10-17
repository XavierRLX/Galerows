import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Lightbulb, LockKeyhole, Pencil, Trophy, Users, WifiOff, XCircle } from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { PistaUnicaLanPrivate, PistaUnicaLanPublic } from '../../pistaUnicaLanGame'

type Props = {
  snapshot: RoomSnapshotV2
  playerId: string
  isHost: boolean
  busy: boolean
  connected: boolean
  onAction: (type: string, payload: unknown) => void | Promise<void>
  onEnd: () => void | Promise<void>
}

/** Remount on GameSession, round, phase, or network transitions to conceal old private targets. */
export function PistaUnicaLanRound(props: Props) {
  const game = props.snapshot.gamePublicState
  const publicData = game?.gameId === 'pista-unica' ? game.data as PistaUnicaLanPublic : null
  const key = `${props.snapshot.roomState.currentGameSessionId}:${publicData?.round}:${publicData?.step}:${props.connected}`
  return <PistaUnicaLanBody key={key} {...props} />
}

function PistaUnicaLanBody({ snapshot, playerId, isHost, busy, connected, onAction, onEnd }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [clue, setClue] = useState('')
  const [answer, setAnswer] = useState('')
  const [sent, setSent] = useState(false)
  useEffect(() => {
    const conceal = () => setRevealed(false)
    const hideOnBackground = () => { if (document.visibilityState === 'hidden') conceal() }
    window.addEventListener('blur', conceal)
    document.addEventListener('visibilitychange', hideOnBackground)
    return () => { window.removeEventListener('blur', conceal)
      document.removeEventListener('visibilitychange', hideOnBackground) }
  }, [])

  const sessionId = snapshot.roomState.currentGameSessionId
  const publicState = snapshot.gamePublicState
  if (!sessionId || !publicState || publicState.gameSessionId !== sessionId
    || publicState.gameId !== 'pista-unica') return null
  const data = publicState.data as PistaUnicaLanPublic
  const privateState = snapshot.privateState
  const mine = connected && privateState?.gameSessionId === sessionId
    && privateState.gameId === 'pista-unica' ? privateState.data as PistaUnicaLanPrivate : null
  const people = snapshot.roomState.members
  const label = (id: string) => {
    const member = people.find(person => person.playerId === id)
    return member?.displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : `Jogador ${people.findIndex(person => person.playerId === id) + 1}`)
  }
  const isGuesser = data.guesserId === playerId
  const blocked = !connected || busy || sent
  const onSubmitClue = () => {
    if (!mine || mine.kind !== 'writer' || !revealed || !clue.trim() || blocked) return
    setRevealed(false); setSent(true)
    void onAction('SUBMIT_CLUE', { text: clue.trim() })
  }
  const onSubmitGuess = () => {
    if (!isGuesser || data.step !== 'guessing' || !answer.trim() || blocked) return
    setSent(true)
    void onAction('SUBMIT_GUESS', { text: answer.trim() })
  }
  return <section aria-label="Pista Única multiplayer" className="pl03-pista-round">
    <div className="pl03-impostor-head">
      <span className="pl03-eyebrow">PISTA ÚNICA / MULTIPLAYER LOCAL</span>
      <h3>Uma pista de cada vez.</h3>
      <p>Rodada {data.round} de {data.totalRounds}. Adivinhador: <strong>{label(data.guesserId)}</strong>.</p>
    </div>
    {!connected && <p className="pl03-pista-alert" role="status"><WifiOff size={17} /> Conexão interrompida. O jogo continua quando você reconectar.</p>}

    {data.step === 'writing' && <div className="pl03-impostor-step">
      <Users size={28} aria-hidden="true" />
      <strong>{isGuesser ? 'Você vai adivinhar!' : 'Envie uma pista para ajudar.'}</strong>
      <p>{data.submittedCount} de {data.requiredCount} pistas recebidas. Cada jogador escreve no seu celular.</p>
      {isGuesser
        ? <p className="pl03-configured">Não olhe as telas dos outros. Você verá somente as pistas válidas quando todos enviarem.</p>
        : mine?.kind === 'writer' && !mine.submitted
          ? <div className="pl03-pista-writer">
            <div className="pl03-impostor-help"><LockKeyhole size={18} /> O desafio é privado. Não mostre sua tela ao adivinhador.</div>
            {revealed && <div className="pl03-impostor-private" data-testid="pista-lan-target">
              <small>PALAVRA PARA DAR A PISTA</small>
              <strong>{mine.target}</strong>
            </div>}
            <button type="button" className="pl03-secondary-btn" disabled={blocked}
              onClick={() => setRevealed(value => !value)}>
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
              {revealed ? 'Ocultar desafio secreto' : 'Ver desafio secreto'}
            </button>
            {revealed && <label htmlFor="pl03-pista-text">Minha pista</label>}
            {revealed && <input id="pl03-pista-text" autoComplete="off" value={clue} maxLength={48}
              onChange={event => setClue(event.target.value)} disabled={blocked}
              placeholder="Escreva uma dica sem entregar a resposta" />}
            <button type="button" className="pl03-primary-btn" onClick={onSubmitClue}
              disabled={blocked || !revealed || !clue.trim()}>
              <Pencil size={18} /> Enviar minha pista
            </button>
          </div>
          : <p className="pl03-configured"><CheckCircle2 size={17} /> Sua pista foi enviada. Aguarde o restante da galera.</p>}
    </div>}

    {data.step === 'review' && <div className="pl03-impostor-step">
      <LockKeyhole size={28} aria-hidden="true" />
      <strong>Revisão das pistas</strong>
      {mine?.reviewClues && data.reviewerId === playerId ? <>
        <p>Você é o revisor desta rodada. Elimine pistas inadequadas antes de liberar o palpite.</p>
        <div className="pl03-pista-writer" aria-label="Revisão privada das pistas">
          {mine.reviewClues.map(item => <div key={item.playerId} className="pl03-pista-review-item">
            <span><strong>{label(item.playerId)}</strong>: <span>{item.text}</span></span>
            {item.reason === 'duplicate' ? <small>Repetida — removida automaticamente</small>
              : item.reason === 'answer' ? <small>Dica igual à palavra secreta — removida automaticamente</small>
              : item.reason === 'manual' ? <small>Removida pelo revisor</small>
              : <small>Pista válida</small>}
            {item.reason !== 'duplicate' && item.reason !== 'answer' &&
              <button type="button" className="pl03-secondary-btn" disabled={!connected || busy}
                aria-label={item.included ? `Remover pista de ${label(item.playerId)}` : `Reincluir pista de ${label(item.playerId)}`}
                onClick={() => void onAction('SET_CLUE_INCLUDED',{playerId:item.playerId,included:!item.included})}>
                {item.included ? <XCircle size={17} /> : <CheckCircle2 size={17} />}
                {item.included ? 'Remover pista' : 'Reincluir pista'}
              </button>}
          </div>)}
        </div>
        <button className="pl03-primary-btn" type="button" disabled={!connected || busy}
          onClick={() => void onAction('CONFIRM_CLUES',null)}>Confirmar pistas</button>
      </> : <p className="pl03-configured">Aguardando {label(data.reviewerId)} revisar as pistas. A palavra e as pistas continuam privadas.</p>}
    </div>}

    {data.step === 'guessing' && <div className="pl03-impostor-step">
      <Lightbulb size={30} aria-hidden="true" />
      <strong>{isGuesser ? 'Agora é sua vez de adivinhar!' : `${label(data.guesserId)} está pensando...`}</strong>
      <p>As pistas repetidas foram retiradas automaticamente.</p>
      <div className="pl03-pista-clues" aria-label="Pistas válidas">
        {data.clues.map((text, index) => <span key={index}>{text}</span>)}
      </div>
      {data.excludedCount > 0 && <p>{data.excludedCount} {data.excludedCount === 1 ? 'pista removida' : 'pistas removidas'} por repetição.</p>}
      {isGuesser && <div className="pl03-pista-writer">
        <label htmlFor="pl03-pista-answer">Meu palpite</label>
        <input id="pl03-pista-answer" value={answer} maxLength={80} autoComplete="off"
          onChange={event => setAnswer(event.target.value)} disabled={blocked}
          placeholder="Qual é a palavra?" />
        <button type="button" className="pl03-primary-btn" onClick={onSubmitGuess}
          disabled={blocked || !answer.trim()}>Enviar palpite</button>
      </div>}
    </div>}

    {data.step === 'round-result' && data.lastResult && <div className="pl03-impostor-step">
      <Trophy size={30} aria-hidden="true" />
      <strong>{data.lastResult.correct ? 'Acertou! +2 pontos' : 'Não foi dessa vez!'}</strong>
      <p>A resposta era: <b>{data.lastResult.target}</b></p>
      <p>Palpite de {label(data.lastResult.guesserId)}: {data.lastResult.guessedText || 'Sem pistas válidas'}</p>
      <p>{data.lastResult.clueCount} pistas válidas · {data.lastResult.excludedCount} removidas</p>
      {data.lastResult.correct && <div aria-label="Pontuação da rodada">
        <p>{label(data.lastResult.guesserId)}: +2 pontos</p>
        {(data.lastResult.creditedPlayerIds ?? []).map(id => <p key={id}>{label(id)}: +1 ponto pela pista válida</p>)}
      </div>}
      {isHost && <button type="button" className="pl03-primary-btn"
        disabled={blocked} onClick={() => void onAction('NEXT_ROUND', null)}>
        {data.round >= data.totalRounds ? 'Concluir partida' : 'Próxima rodada'}
      </button>}
      {!isHost && <p className="pl03-configured">Aguardando o anfitrião continuar.</p>}
    </div>}

    {data.step === 'summary' && <div className="pl03-impostor-step">
      <Trophy size={33} aria-hidden="true" />
      <strong>Resultado da Pista Única</strong>
      <p>Todos tiveram sua vez de adivinhar. Os acertos serão somados ao placar da sala.</p>
      <div className="pl03-impostor-results">
        <h4>Pontos desta partida</h4>
        {Object.entries(data.scores).map(([id, value]) => <p key={id}>{label(id)}: +{value}</p>)}
      </div>
      {isHost ? <button type="button" className="pl03-primary-btn" onClick={() => void onEnd()} disabled={blocked}>
        Finalizar partida e pontuar</button>
        : <p>Aguardando o anfitrião encerrar. A mesma sala continua disponível.</p>}
    </div>}
  </section>
}
