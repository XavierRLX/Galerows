import { useEffect, useState } from 'react'
import { Eye, EyeOff, HelpCircle, LockKeyhole, MessageCircle, Search, ShieldQuestion, Trophy } from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { ImpostorLanPrivate, ImpostorLanPublic } from '../../impostorLanGame'

type Props = {
  snapshot: RoomSnapshotV2; playerId: string; isHost: boolean; busy: boolean; connected: boolean
  onAction: (type: string, payload: unknown) => void
  onEnd: () => void
}
const phaseLabels: Record<ImpostorLanPublic['step'], string> = {
  reveal: 'Cartas secretas', voting: 'Votação individual', clues: 'Rodada de pistas', discussion: 'Conversem e desconfiem',
  accusation: 'Quem é o impostor?', 'final-guess': 'Última chance de roubar a palavra', summary: 'Resultado da rodada',
}

/**
 * Remount per authoritative GameSession, phase and connection state.
 * This resets revealed secrets synchronously on transition, including after a
 * resumed socket, without a setState-in-effect or a flash of stale private data.
 */
export function ImpostorLanRound(props: Props) {
  const current = props.snapshot.gamePublicState
  const step = current?.gameId === 'impostor-da-palavra'
    ? (current.data as ImpostorLanPublic).step : 'unavailable'
  const key = `${props.snapshot.roomState.currentGameSessionId ?? 'none'}:${step}:${props.connected ? 'connected' : 'disconnected'}`
  return <ImpostorLanRoundBody key={key} {...props} />
}

function ImpostorLanRoundBody({ snapshot, playerId, isHost, busy, connected, onAction, onEnd }: Props) {
  const sessionId = snapshot.roomState.currentGameSessionId
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [accusedId, setAccusedId] = useState('')
  const [guess, setGuess] = useState('')
  const publicData = snapshot.gamePublicState?.gameId === 'impostor-da-palavra'
    && snapshot.gamePublicState.gameSessionId === sessionId
    ? snapshot.gamePublicState.data as ImpostorLanPublic : null
  const privateData = connected && snapshot.privateState?.gameId === 'impostor-da-palavra'
    && snapshot.privateState.gameSessionId === sessionId
    ? snapshot.privateState.data as ImpostorLanPrivate : null
  const showSecret = Boolean(sessionId && privateData && revealedId === sessionId && connected)
  const members = snapshot.roomState.members
  const playerName = (id: string) => {
    const found = members.findIndex(member => member.playerId === id)
    if (found < 0) return 'Jogador'
    return members[found].displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : `Jogador ${String(found + 1).padStart(2, '0')}`)
  }
  const blocked = busy || !connected

  useEffect(() => {
    const hide = () => setRevealedId(null)
    const onVisibility = () => { if (document.visibilityState === 'hidden') hide() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', hide)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', hide) }
  }, [])

  if (!publicData) return <p role="status" className="pl03-hint">Aguardando dados atualizados da partida.</p>
  const publicRole = publicData.step === 'summary' ? publicData.result : null
  const modeDescription = publicData.mode === 'no-word'
    ? 'O impostor não recebe a palavra. Ele deve acompanhar a conversa e tentar se misturar.'
    : publicData.mode === 'hint'
      ? 'O impostor recebe uma dica, mas não a palavra completa.'
      : 'O impostor recebe outra palavra, sem ser avisado de que é diferente.'
  const myTurn = publicData.currentSpeaker === playerId
  const canGuess = publicData.step === 'final-guess' && publicData.accusedId === playerId

  return <section className="pl03-impostor-round" aria-label="Impostor da Palavra multiplayer">
    <div className="pl03-impostor-head">
      <span className="pl03-eyebrow">IMPOSTOR DA PALAVRA · RODADA LAN</span>
      <h3>{phaseLabels[publicData.step]}</h3>
      <p>{modeDescription}</p>
    </div>
    <div className="pl03-impostor-help">
      <ShieldQuestion size={18} aria-hidden="true" />
      <span>Descubram quem está enganando a galera. Se for acusado corretamente, o impostor ainda pode tentar adivinhar a palavra e roubar a vitória.</span>
    </div>

    {publicData.step !== 'summary' && privateData && <div className="pl03-secret">
      <div><LockKeyhole size={17} aria-hidden="true" /><strong>Sua informação — somente neste celular</strong></div>
      {showSecret && <div className="pl03-impostor-private" data-testid="impostor-lan-private">
        {privateData.kind === 'impostor'
          ? <><strong>VOCÊ É O IMPOSTOR</strong><p>Você não recebeu a palavra. Escute as pistas para tentar descobrir.</p></>
          : privateData.kind === 'impostor-hint'
            ? <><strong>VOCÊ É O IMPOSTOR</strong><p>Sua dica: {privateData.hint}</p></>
            : <><small>SUA PALAVRA</small><strong>{privateData.word}</strong><p>Não revele essa palavra para ninguém.</p></>}
      </div>}
      <button type="button" className="pl03-secondary-btn" onClick={() => setRevealedId(showSecret ? null : sessionId)}
        disabled={blocked} aria-label={showSecret ? 'Ocultar minha palavra' : 'Ver minha palavra'}>
        {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
        {showSecret ? 'Ocultar minha palavra' : 'Ver minha palavra'}
      </button>
      {publicData.step === 'reveal' && !privateData.wasSeen && <button className="pl03-primary-btn"
        type="button" disabled={blocked || !showSecret} onClick={() => { setRevealedId(null); onAction('ACK_BRIEFING', null) }}>
        Já vi minha informação e estou pronto
      </button>}
      {publicData.step === 'reveal' && privateData.wasSeen && <p className="pl03-configured">
        Sua informação foi confirmada. Aguarde os demais jogadores.
      </p>}
    </div>}

    {publicData.step === 'reveal' && <div className="pl03-impostor-step">
      <p>{publicData.seenCount} de {publicData.totalPlayers} jogadores viram suas informações.</p>
      {isHost ? <button type="button" className="pl03-primary-btn" disabled={blocked || publicData.seenCount !== publicData.totalPlayers}
        onClick={() => onAction('START_CLUES', null)}>Todos viram · Começar pistas</button>
        : <p>A conversa começa quando todo mundo tiver visto sua informação e o anfitrião liberar.</p>}
    </div>}

    {publicData.step === 'clues' && <div className="pl03-impostor-step">
      <MessageCircle size={30} aria-hidden="true" />
      <strong>Vez de {publicData.currentSpeaker ? playerName(publicData.currentSpeaker) : 'jogador'}</strong>
      <p>{publicData.conversationMode === 'one-word'
        ? 'Fale uma palavra relacionada ao que você recebeu, sem revelar diretamente a palavra.'
        : 'Responda à pergunta guiada da sua rodada sem dizer a palavra.'}</p>
      {myTurn && privateData?.question && <p className="pl03-hint"><HelpCircle size={16} /> Sua pergunta: {privateData.question}</p>}
      {myTurn && <p className="pl03-configured">Sua vez. Responda em voz alta para a galera.</p>}
      {isHost && <button type="button" className="pl03-primary-btn" disabled={blocked}
        onClick={() => onAction('NEXT_CLUE', null)}>Próxima pessoa</button>}
    </div>}

    {publicData.step === 'discussion' && <div className="pl03-impostor-step">
      <Search size={30} aria-hidden="true" />
      <strong>Quem está blefando?</strong>
      <p>Conversem pessoalmente. Cada um tenta descobrir quem recebeu uma informação diferente.</p>
      {isHost && <button className="pl03-primary-btn" type="button" disabled={blocked}
        onClick={() => onAction('START_ACCUSATION', null)}>Escolher o acusado</button>}
    </div>}

    {publicData.step === 'accusation' && <div className="pl03-impostor-step">
      <ShieldQuestion size={30} aria-hidden="true" />
      <strong>A galera decidiu?</strong>
      {isHost ? <><p>Escolha a pessoa que o grupo acredita ser o impostor.</p>
        <div className="pl03-impostor-accused">
          {members.filter(member => member.participation === 'active').map(member =>
            <button type="button" className={accusedId === member.playerId ? 'is-selected' : ''}
              key={member.playerId} disabled={blocked} onClick={() => setAccusedId(member.playerId)}>
              {playerName(member.playerId)}
            </button>)}
        </div>
        <button type="button" className="pl03-primary-btn" disabled={blocked || !accusedId}
          onClick={() => onAction('ACCUSE', { playerId: accusedId })}>Confirmar acusação</button>
      </> : <p>Aguardando o anfitrião registrar a escolha do grupo.</p>}
    </div>}

    {publicData.step === 'final-guess' && <div className="pl03-impostor-step">
      <HelpCircle size={30} aria-hidden="true" />
      <strong>{playerName(publicData.accusedId || '')} foi descoberto!</strong>
      <p>O impostor tem uma última chance: descobrir a palavra dos outros jogadores para roubar a vitória.</p>
      {canGuess ? <><label htmlFor="pl03-impostor-guess">Qual era a palavra verdadeira?</label>
        <input id="pl03-impostor-guess" type="text" value={guess} maxLength={80}
          onChange={event => setGuess(event.target.value)} disabled={blocked} autoComplete="off" />
        <button className="pl03-primary-btn" type="button" disabled={blocked || !guess.trim()}
          onClick={() => { setRevealedId(null); onAction('GUESS_WORD', { word: guess.trim() }) }}>Tentar roubar a palavra</button>
      </> : <p>Aguardando a tentativa do impostor no próprio celular.</p>}
      {isHost && <button type="button" className="pl03-secondary-btn" disabled={blocked}
        onClick={() => onAction('SKIP_GUESS', null)}>O impostor desistiu · Encerrar tentativa</button>}
    </div>}

    {publicData.step === 'summary' && <div className="pl03-impostor-step">
      <Trophy size={33} aria-hidden="true" />
      <strong>{publicData.winner === 'impostor' ? 'Vitória do impostor!' : 'Vitória da galera!'}</strong>
      <p>{publicData.reason === 'stolen-word' ? 'O impostor descobriu a palavra e roubou a vitória.'
        : publicData.reason === 'not-found' ? 'O grupo acusou outra pessoa, e o impostor passou despercebido.'
          : 'O impostor foi descoberto e não conseguiu roubar a palavra.'}</p>
      {publicRole && <div className="pl03-impostor-results">
        <p><b>Palavra:</b> {publicRole.word}</p>
        <p><b>Impostor:</b> {playerName(publicRole.impostorId)}</p>
        {publicRole.guessedWord && <p><b>Tentativa:</b> {publicRole.guessedWord}</p>}
        <h4>Pontos da rodada</h4>
        {Object.entries(publicRole.points).map(([id, value]) => <p key={id}>{playerName(id)}: +{value}</p>)}
      </div>}
      {isHost ? <button type="button" className="pl03-primary-btn" disabled={blocked} onClick={onEnd}>
        Finalizar rodada e ver resultados
      </button> : <p>O anfitrião finaliza a rodada. A mesma sala continua disponível para a próxima.</p>}
    </div>}
  </section>
}
