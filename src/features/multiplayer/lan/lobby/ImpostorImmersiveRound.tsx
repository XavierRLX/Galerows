import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, EyeOff,
  Fingerprint, LockKeyhole, MessageCircle, MoreHorizontal, Radio, RotateCcw,
  ShieldCheck, ShieldQuestion, Timer, Trophy, Users, WifiOff, X,
} from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { ImpostorLanPrivate, ImpostorLanPublic } from '../../impostorLanGame'
import './impostorImmersive.css'

type Props = {
  snapshot: RoomSnapshotV2; playerId: string; isHost: boolean; busy: boolean; connected: boolean
  onAction: (type: string, payload: unknown) => void
  onEnd: () => void; onBackToLobby: () => void; onReplay?: () => void; onReconnect: () => void
  onLeave: () => void; onClose: () => void; error?: string
}

function Button({ children, onClick, disabled, secondary = false }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean
}) {
  return <button type="button" className={`ig-button${secondary ? ' ig-secondary' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Emblem({ kind = 'secret' }: { kind?: 'secret' | 'talk' | 'win' | 'vote' }) {
  return <div className={`ig-emblem ig-emblem-${kind}`} aria-hidden="true"><span /><i />
    {kind === 'win' ? <Trophy /> : kind === 'talk' ? <MessageCircle /> : kind === 'vote' ? <ShieldQuestion /> : <Fingerprint />}
  </div>
}

function Pager({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  if (pages < 2) return null
  return <nav className="ig-pager" aria-label={label}>
    <button type="button" aria-label={`${label}: anteriores`} disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button>
    <span aria-live="polite">{page + 1} / {pages}</span>
    <button type="button" aria-label={`${label}: próximos`} disabled={page === pages - 1} onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button>
  </nav>
}

function GameDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    panel?.querySelector<HTMLButtonElement>('button')?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    panel?.addEventListener('keydown', trap)
    return () => { panel?.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus() }
  }, [])
  return <div className="ig-dialog-backdrop"><div ref={ref} className="ig-dialog" role="dialog" aria-modal="true" aria-labelledby="ig-dialog-title">
    <button type="button" className="ig-dialog-close" aria-label="Fechar menu" onClick={onClose}><X size={20} /></button>
    <h2 id="ig-dialog-title">{title}</h2>{children}
  </div></div>
}

export function ImpostorImmersiveRound(props: Props) {
  const pub = props.snapshot.gamePublicState?.data as ImpostorLanPublic | undefined
  // Never carry a secret, ballot or local scene across authority/session changes.
  const key = [props.playerId, props.snapshot.roomState.currentGameSessionId, pub?.step, pub?.voteRound, props.connected].join(':')
  return <ImpostorImmersiveBody key={key} {...props} />
}

function ImpostorImmersiveBody({ snapshot, playerId, isHost, busy, connected, onAction,
  onEnd, onBackToLobby, onReplay, onReconnect, onLeave, onClose, error }: Props) {
  const [now, setNow] = useState(Date.now)
  const [revealed, setRevealed] = useState(false)
  const [scene, setScene] = useState<'identity' | 'brief'>('identity')
  const [selected, setSelected] = useState<string | null>(null)
  const [guess, setGuess] = useState('')
  const [menu, setMenu] = useState<'exit' | 'tools' | null>(null)
  const [page, setPage] = useState(0)
  const [resultView, setResultView] = useState<'round' | 'points'>('round')
  const [pageSize, setPageSize] = useState(4)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const session = snapshot.roomState.currentGameSessionId
  const pub = snapshot.gamePublicState?.gameId === 'impostor-da-palavra'
    && snapshot.gamePublicState.gameSessionId === session
    ? snapshot.gamePublicState.data as ImpostorLanPublic : null
  const priv = connected && snapshot.privateState?.gameId === 'impostor-da-palavra'
    && snapshot.privateState.gameSessionId === session
    ? snapshot.privateState.data as ImpostorLanPrivate : null
  const members = snapshot.roomState.members.filter(m => m.participation === 'active')
  const participantIds = pub?.speakingOrder ?? []
  const nameOf = (id: string) => {
    const index = snapshot.roomState.members.findIndex(member => member.playerId === id)
    return snapshot.roomState.members[index]?.displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : index < 0 ? 'Jogador' : `Jogador ${String(index + 1).padStart(2, '0')}`)
  }
  const blocked = busy || !connected || !participantIds.includes(playerId)
  const showSecret = connected && !!priv && revealed && pub?.step === 'reveal' && scene === 'identity' && !menu
  const individual = pub?.flow === 'individual-vote'
  const count = Math.max(0, Math.ceil(((pub?.startedAt ?? 0) + 3000 - now) / 1000))
  const allSeen = !!pub && pub.seenCount === pub.totalPlayers
  const duration = pub?.timerSeconds ?? 0
  const timerStartedAt = pub?.timerStartedAt
  const remaining = Math.max(0, duration - (timerStartedAt ? Math.max(0, Math.floor((now - timerStartedAt) / 1000)) : 0))
  const counting = count > 0 && pub?.step === 'reveal' && connected
  const talking = pub?.step === 'reveal' && scene === 'brief'
  const title = !pub ? 'Retomando a missão…' : counting ? 'Prepare seu disfarce.'
    : talking ? 'Toda pista deixa um rastro.' : pub.step === 'reveal' ? 'Seu segredo fica com você.'
      : pub.step === 'clues' ? `Vez de ${nameOf(pub.currentSpeaker ?? '')}`
        : pub.step === 'discussion' ? 'Quem não convenceu?'
          : pub.step === 'voting' ? pub.voteRound === 2 ? 'Votação de desempate' : 'Quem é o impostor?'
            : pub.step === 'accusation' ? 'A galera decidiu?'
              : pub.step === 'final-guess' ? 'Uma última chance.'
                : pub.winner === 'group' ? 'Vitória da galera!' : 'Vitória do impostor!'
  const sceneKey = `${pub?.step}:${scene}:${pub?.voteRound}:${counting}`

  useEffect(() => {
    const resize = () => {
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      root.current?.style.setProperty('--ig-height', `${height}px`)
      root.current?.style.setProperty('--ig-top', `${viewport?.offsetTop ?? 0}px`)
      root.current?.classList.toggle('ig-short', height < 570)
      root.current?.classList.toggle('ig-keyboard', height < 430)
      setPageSize(height < 570 ? 2 : 4)
    }
    resize()
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', resize)
    return () => {
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('scroll', resize)
    }
  }, [])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [sceneKey])
  useEffect(() => {
    const hide = () => setRevealed(false)
    const visibility = () => { if (document.visibilityState === 'hidden') hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (!showSecret) return
    const timeout = window.setTimeout(() => setRevealed(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [showSecret])
  useEffect(() => {
    const back = (event: Event) => { event.preventDefault(); setRevealed(false); setMenu(menu ? null : 'exit') }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') back(event) }
    window.addEventListener('galerows:back', back)
    document.addEventListener('keydown', key)
    return () => { window.removeEventListener('galerows:back', back); document.removeEventListener('keydown', key) }
  }, [menu])
  useEffect(() => {
    if (!connected || (!counting && !(timerStartedAt && remaining > 0 && pub?.step === 'reveal'))) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [connected, counting, timerStartedAt, remaining, pub?.step])

  const send = (type: string, payload: unknown = null) => { if (!blocked) { setRevealed(false); onAction(type, payload) } }
  const canGuess = !!priv && (individual ? priv.canGuess : pub?.accusedId === playerId)
  const candidates = snapshot.roomState.members.map(member => member.playerId).filter(id => participantIds.includes(id)
    && (!pub?.runoffCandidates || pub.runoffCandidates.includes(id)))
  const scores = Object.entries(pub?.result?.points ?? {})
  const entries = pub?.step === 'summary' ? scores.length : candidates.length
  const pages = Math.max(1, Math.ceil(entries / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const offset = currentPage * pageSize
  const selectionValid = !!selected && candidates.includes(selected)
  const secretText = priv?.kind === 'word' ? priv.word : priv?.kind === 'impostor-hint' ? priv.hint : 'Sem palavra'
  const allPresent = participantIds.every(id => members.some(member => member.playerId === id && member.connected))
  const phaseIndex = pub?.step === 'summary' ? 4 : pub?.step === 'final-guess' ? 3
    : pub?.step === 'voting' || pub?.step === 'accusation' ? 2 : talking || pub?.step === 'clues' || pub?.step === 'discussion' ? 1 : 0

  return <div ref={root} className="ig-root" data-testid="impostor-immersive">
    <div className="ig-atmosphere" aria-hidden="true"><div className="ig-orbit" /><div className="ig-grid" /></div>
    <div className="ig-shell" inert={!!menu || !connected} aria-hidden={!!menu || !connected}>
      <header className="ig-header"><img src="/assets/brand/galerows-mark.svg" alt="Galerows" width="32" height="32" />
        <div><span>IMPOSTOR DA PALAVRA</span><small><Radio size={11} /> {connected ? `${participantIds.length} na missão` : 'Sem conexão'} · {isHost ? 'Você é o anfitrião' : nameOf(playerId)}</small></div>
        <button type="button" className="ig-icon-button" aria-label={isHost ? 'Encerrar sala' : 'Sair da sala'} onClick={() => { setRevealed(false); setMenu('exit') }}><MoreHorizontal size={22} /></button>
      </header>
      <nav className="ig-phases" aria-label="Progresso da rodada">{['Identidade', 'Conversa', 'Votação', 'Palpite', 'Resultado'].map((label, i) => <span key={label} aria-current={i === phaseIndex ? 'step' : undefined} className={i <= phaseIndex ? 'ig-phase-lit' : ''}><i />{label}</span>)}</nav>
      {error && <div role="alert" className="ig-error">{error}</div>}
      <main className={`ig-scene ig-phase-${pub?.step ?? 'loading'}${talking ? ' ig-brief' : ''}${counting ? ' ig-counting' : ''}`} key={sceneKey}>
        <div className="ig-scene-heading"><p className="ig-kicker">{pub?.step === 'summary' ? 'MISSÃO CONCLUÍDA' : talking ? 'OUÇA. OBSERVE. DESCONFIE.' : `ARQUIVO ${String(phaseIndex + 1).padStart(2, '0')} / CONFIDENCIAL`}</p><h1 ref={heading} tabIndex={-1}>{title}</h1></div>
        {!pub ? <div className="ig-center" role="status"><Emblem /><p>Aguardando estado da partida.</p></div>
          : counting ? <div className="ig-center ig-countdown" role="status"><strong key={count}>{count}</strong><p>A missão começa em instantes…</p></div>
            : <>
              {pub.step === 'reveal' && !talking && <>
                <div className={`ig-secret${showSecret ? ' ig-secret-open' : ''}`}>
                  <div className="ig-secret-label"><LockKeyhole size={12} /> ACESSO INDIVIDUAL <span>GRW / 01</span></div>
                  {priv ? <>
                    <div className="ig-secret-face" key={String(showSecret)} aria-live="polite">
                      {showSecret ? <>{priv.kind === 'word' ? <ShieldCheck className="ig-secret-icon" /> : <ShieldQuestion className="ig-secret-icon" />}<p className="ig-kicker">{priv.kind === 'word' ? 'SUA PALAVRA' : 'VOCÊ É O IMPOSTOR'}</p><h2 className={(secretText?.length ?? 0) > 22 ? 'ig-long-secret' : ''}>{secretText}</h2><p>{priv.kind === 'impostor-hint' ? 'Esta é sua dica. Entre na conversa.' : priv.kind === 'word' ? 'Guarde o segredo. Não diga esta palavra.' : 'Escute as pistas. Misture-se à galera.'}</p></>
                        : <><Emblem /><h2>Identidade protegida</h2><p>Confira sem ninguém olhar.<br />A carta se oculta em 5 segundos.</p></>}
                    </div>
                    <Button secondary disabled={blocked} onClick={() => { setRevealed(!showSecret); if (!showSecret && !priv.wasSeen) onAction('ACK_BRIEFING', null) }}>{showSecret ? <EyeOff size={18} /> : <Eye size={18} />}{showSecret ? 'Ocultar informação' : 'Revelar minha informação'}</Button>
                  </> : <div className="ig-center"><Emblem /><p role="status">{participantIds.includes(playerId) ? 'Aguardando sua informação privada.' : 'Você participará da próxima rodada.'}</p></div>}
                </div>
                <div className="ig-actions"><div className="ig-readiness" role="status"><Users size={16} /><span>{allSeen ? 'Todos visualizaram!' : `${pub.seenCount} de ${pub.totalPlayers} visualizaram.`}</span><b>{pub.seenCount}/{pub.totalPlayers}</b></div>
                  <div className="ig-progress" aria-hidden="true"><i style={{ width: `${pub.totalPlayers ? pub.seenCount / pub.totalPlayers * 100 : 0}%` }} /></div>
                  <Button disabled={!allSeen || blocked || !priv?.wasSeen} onClick={() => { setRevealed(false); setScene('brief') }}>Ir para a conversa <ArrowRight size={18} /></Button>
                </div>
              </>}
              {talking && <>
                <div className="ig-conversation"><Emblem kind="talk" />
                  <p className="ig-kicker">{pub.conversationMode === 'guided-questions' ? 'A MESMA PERGUNTA PARA TODOS' : 'UMA PALAVRA POR PESSOA'}</p>
                  <h2>{pub.question || 'Dê uma pista. Guarde o segredo.'}</h2>
                  <p>{pub.question ? 'Respondam em voz alta, sem entregar a palavra.' : 'Cada pessoa fala uma palavra ou dica em voz alta.'}</p>
                  <div className="ig-first"><span>QUEM COMEÇA</span><strong>{nameOf(pub.firstSpeaker ?? pub.speakingOrder[0] ?? '')}</strong></div>
                  {duration > 0 && <div className="ig-timer"><Timer size={17} /><strong role="timer" aria-label="Tempo da conversa">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</strong><span>{remaining === 0 ? 'Hora de decidir' : timerStartedAt ? 'Conversa em andamento' : 'Prontos para conversar?'}</span></div>}
                </div>
                <div className="ig-actions"><div className="ig-tool-row"><button type="button" onClick={() => setScene('identity')}><Eye size={16} /> Minha informação</button>{isHost && <button type="button" onClick={() => setMenu('tools')}><MoreHorizontal size={18} /> Conduzir</button>}</div>
                  {isHost ? <Button disabled={blocked || !allSeen || !allPresent} onClick={() => send(individual ? 'START_VOTING' : 'START_CLUES')}>{individual ? 'Abrir votação para todos' : 'Começar pistas'}<ArrowRight size={18} /></Button> : <p className="ig-wait" role="status">Aguardando o anfitrião liberar {individual ? 'a votação' : 'as pistas'}.</p>}
                  {!allPresent && <p className="ig-caption">Aguardando os participantes reconectarem.</p>}
                </div>
              </>}
              {(pub.step === 'clues' || pub.step === 'discussion') && <>
                <div className="ig-conversation"><Emblem kind="talk" /><p className="ig-kicker">{pub.currentSpeaker === playerId ? 'É A SUA VEZ' : 'FIQUE DE OLHO NAS PISTAS'}</p><h2>{pub.step === 'clues' ? priv?.question && pub.currentSpeaker === playerId ? priv.question : 'Uma pista, em voz alta.' : 'Quem está blefando?'}</h2><p>Conversem pessoalmente sem entregar a palavra.</p></div>
                <div className="ig-actions">{isHost ? <Button disabled={blocked} onClick={() => send(pub.step === 'clues' ? 'NEXT_CLUE' : 'START_ACCUSATION')}>{pub.step === 'clues' ? 'Próxima pessoa' : 'Escolher o acusado'}<ArrowRight size={18} /></Button> : <p className="ig-wait">O anfitrião conduz esta etapa.</p>}</div>
              </>}
              {(pub.step === 'voting' || pub.step === 'accusation') && <>
                {priv?.hasVoted || (!isHost && pub.step === 'accusation') || !priv ? <div className="ig-center" role="status"><Emblem kind="vote" /><h2>{priv?.hasVoted ? 'Voto confirmado.' : 'Acompanhe a votação.'}</h2><p>{priv?.hasVoted ? 'Aguarde os outros participantes votarem.' : 'Aguardando os participantes desta rodada.'}</p><strong>{pub.voteCount ?? 0} de {pub.totalPlayers} votos registrados</strong></div> : <>
                  <p className="ig-caption">{pub.voteRound === 2 ? 'Empate! Escolha entre os mais votados.' : individual ? 'Seu voto é secreto. Após confirmar, não pode mudar.' : 'Registre a escolha da galera.'}</p>
                  <div className="ig-suspects" role="group" aria-label="Escolher suspeito">{candidates.slice(offset, offset + pageSize).map((id, i) => <button type="button" key={id} aria-label={`${nameOf(id)}${id === playerId ? ' você' : ''}`} aria-pressed={selected === id} disabled={blocked} className={selected === id ? 'ig-selected' : ''} onClick={() => setSelected(id)}>
                    <span className={`ig-avatar ig-tone-${(offset + i) % 4}`} aria-hidden="true">{nameOf(id).slice(0, 2).toUpperCase()}</span><strong title={nameOf(id)}>{nameOf(id)}</strong><small>{id === playerId ? 'você' : id === snapshot.roomState.hostPlayerId ? 'anfitrião' : 'suspeito'}</small><i>{selected === id && <Check size={12} />}</i>
                  </button>)}</div>
                  <Pager page={currentPage} pages={pages} onChange={setPage} label="Suspeitos" />
                  <div className="ig-actions"><Button disabled={!selectionValid || blocked} onClick={() => { if (selectionValid) send(individual ? 'VOTE' : 'ACCUSE', { playerId: selected }) }}><Check size={17} /><span>{selected ? `${individual ? 'Confirmar voto em' : 'Acusar'} ${nameOf(selected)}` : 'Escolha um suspeito'}</span></Button></div>
                </>}
              </>}
              {pub.step === 'final-guess' && <>
                <div className="ig-center ig-guess-intro"><Emblem kind="vote" /><p className="ig-kicker">{pub.scoringMode === 'individual' ? 'BÔNUS DO IMPOSTOR' : 'O ÚLTIMO PALPITE'}</p><h2>{canGuess ? 'Qual era a palavra?' : 'O impostor está pensando…'}</h2><p>{pub.scoringMode === 'individual' ? 'Os pontos dos votos já estão definidos. Acertar vale +1 ponto extra.' : 'Acertar a palavra ainda pode virar a rodada.'}</p></div>
                <div className="ig-actions">{canGuess ? <form className="ig-guess-form" onSubmit={event => { event.preventDefault(); if (guess.trim() && !blocked) send('GUESS_WORD', { word: guess.trim() }) }}><label htmlFor="ig-guess">Qual era a palavra?</label><input id="ig-guess" maxLength={80} value={guess} disabled={blocked} autoComplete="off" enterKeyHint="send" placeholder="Seu palpite…" onChange={event => setGuess(event.target.value)} /><button className="ig-button" disabled={!guess.trim() || blocked} type="submit">Confirmar palpite <ArrowRight size={17} /></button></form> : <p className="ig-wait" role="status">Aguardando o impostor tentar adivinhar a palavra.</p>}
                  {isHost && <button className="ig-text-button" type="button" disabled={blocked} onClick={() => send('SKIP_GUESS')}>Encerrar sem palpite</button>}
                </div>
              </>}
              {pub.step === 'summary' && <>
                <div className="ig-result-switch" role="group" aria-label="Detalhes do resultado">
                  <button type="button" aria-pressed={resultView === 'round'} onClick={() => setResultView('round')}>Resumo da rodada</button>
                  <button type="button" aria-pressed={resultView === 'points'} onClick={() => setResultView('points')}>Pontos da rodada</button>
                </div>
                <div className="ig-result-body" key={resultView}>
                  {resultView === 'round' ? <><Emblem kind="win" /><p className="ig-caption">{pub.reason === 'tied-vote' ? 'Empate no desempate: o impostor escapou.' : pub.reason === 'not-found' ? 'O grupo votou na pessoa errada.' : pub.reason === 'stolen-word' ? 'O impostor acertou a palavra e virou a rodada.' : 'O impostor foi descoberto.'}</p>
                    {pub.result && <><div className="ig-debrief"><div><span>O IMPOSTOR ERA</span><strong title={nameOf(pub.result.impostorId)}>{nameOf(pub.result.impostorId)}</strong></div><div><span>A PALAVRA ERA</span><strong>{pub.result.word}</strong></div></div>
                      {pub.result.impostorGuessedCorrectly && <p className="ig-bonus" role="status"><Check size={15} /><span>O impostor acertou a palavra! {pub.scoringMode === 'individual' ? '+1 ponto extra.' : 'O palpite estava correto.'}</span></p>}</>}
                  </> : <><section className="ig-scoreboard" aria-label="Pontos da rodada"><h2>Pontos da rodada</h2><ul>{scores.slice(offset, offset + pageSize).map(([id, points]) => <li key={id}><span title={nameOf(id)}>{nameOf(id)}{id === playerId ? ' (você)' : ''}</span><b>+{points} <small>pts</small></b></li>)}</ul></section>
                    <Pager page={currentPage} pages={pages} onChange={setPage} label="Placar" /></>}
                </div>
                <div className="ig-actions">{isHost ? snapshot.roomState.phase === 'playing' ? <Button disabled={busy || !connected} onClick={onEnd}>Registrar pontuação <ArrowRight size={18} /></Button> : <>
                  {onReplay && <Button disabled={busy || !connected} onClick={onReplay}><RotateCcw size={17} /> Jogar novamente</Button>}
                  <Button secondary disabled={busy || !connected} onClick={onBackToLobby}><ArrowLeft size={17} /> Voltar com todos ao lobby</Button>
                </> : <p className="ig-wait">O anfitrião retorna com todos ao lobby após o resultado.</p>}</div>
              </>}
            </>}
      </main>
      <footer className="ig-footer"><span /> {nameOf(playerId)} <span className="ig-footer-divider">/</span> {isHost ? 'ANFITRIÃO' : 'AGENTE EM CAMPO'}</footer>
    </div>
    {!connected && !menu && <div className="ig-dialog-backdrop"><section className="ig-dialog" role="alert"><WifiOff size={30} /><h2>Sinal interrompido.</h2><p>Conexão interrompida; a identidade fica oculta.</p>{!isHost && <Button disabled={busy} onClick={onReconnect}>Reconectar</Button>}<Button secondary onClick={() => setMenu('exit')}>{isHost ? 'Encerrar sala' : 'Sair da sala'}</Button></section></div>}
    {menu && <GameDialog title={menu === 'tools' ? 'Conduzir a conversa' : isHost ? 'Encerrar sala?' : 'Sair da sala?'} onClose={() => setMenu(null)}>
      {menu === 'tools' ? <>
        {pub?.question && <Button disabled={blocked} secondary onClick={() => { send('NEXT_QUESTION'); setMenu(null) }}>Trocar pergunta</Button>}
        {individual && <Button disabled={blocked} secondary onClick={() => { send('DRAW_FIRST_SPEAKER'); setMenu(null) }}>Sortear quem começa</Button>}
        {duration > 0 && !timerStartedAt && <Button disabled={blocked} onClick={() => { send('START_TIMER'); setMenu(null) }}>Iniciar cronômetro</Button>}
        {timerStartedAt ? <p>O cronômetro segue o início registrado pelo anfitrião. A votação só abre quando você decidir.</p> : <p>Todos recebem a pergunta e a pessoa sorteada pela mesma sala.</p>}
      </> : <><p>{isHost ? 'Todos perderão a conexão com esta sala.' : 'Você sairá desta sala. Sua partida será encerrada neste aparelho.'}</p>
        {!connected && !isHost && <p>Sem conexão: a saída será somente local e não será confirmada pelo anfitrião.</p>}
        <Button disabled={busy} onClick={() => { setMenu(null); if (isHost) onClose(); else onLeave() }}>{isHost ? 'Sim, encerrar sala' : connected ? 'Sim, sair da sala' : 'Fechar neste aparelho'}</Button>
        <Button secondary onClick={() => setMenu(null)}>Continuar no jogo</Button></>}
    </GameDialog>}
  </div>
}
