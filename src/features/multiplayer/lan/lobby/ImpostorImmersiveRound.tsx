import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, Fingerprint,
  LockKeyhole, Radio, Crown, ShieldCheck, ShieldQuestion, Timer, Trophy, Users, WifiOff,
} from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { ImpostorLanPrivate, ImpostorLanPublic } from '../../impostorLanGame'
import '../prototypes/impostorPrototype.css'
import './impostorImmersive.css'

type Props = {
  snapshot: RoomSnapshotV2; playerId: string; isHost: boolean; busy: boolean; connected: boolean
  onAction: (type: string, payload: unknown) => void
  onEnd: () => void; onBackToLobby: () => void; onReplay?: () => void; onReconnect: () => void
  onLeave: () => void; onClose: () => void
}

export function ImpostorImmersiveRound(props: Props) {
  const pub = props.snapshot.gamePublicState?.data as ImpostorLanPublic | undefined
  const key = [props.snapshot.roomState.currentGameSessionId, pub?.step, pub?.voteRound, props.connected].join(':')
  return <ImpostorImmersiveBody key={key} {...props}/>
}

function ImpostorImmersiveBody({snapshot, playerId, isHost, busy, connected, onAction,
  onEnd, onBackToLobby, onReplay, onReconnect, onLeave, onClose}: Props) {
  const [now, setNow] = useState(Date.now)
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<string|null>(null)
  const [guess, setGuess] = useState('')
  const [exitPrompt, setExitPrompt] = useState(false)
  const session = snapshot.roomState.currentGameSessionId
  const pub = snapshot.gamePublicState?.gameId === 'impostor-da-palavra'
    && snapshot.gamePublicState.gameSessionId === session
    ? snapshot.gamePublicState.data as ImpostorLanPublic : null
  const priv = connected && snapshot.privateState?.gameId === 'impostor-da-palavra'
    && snapshot.privateState.gameSessionId === session
    ? snapshot.privateState.data as ImpostorLanPrivate : null
  const showSecret = connected && !!priv && revealed && pub?.step === 'reveal'
  const members = snapshot.roomState.members.filter(m=>m.participation==='active')
  const nameOf = (id: string) => {
    const position = snapshot.roomState.members.findIndex(member => member.playerId === id)
    const member = snapshot.roomState.members[position]
    return member?.displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : `Jogador ${String(position + 1).padStart(2, '0')}`)
  }
  const blocked = busy || !connected || !members.some(m=>m.playerId===playerId)
  useEffect(()=>{
    const hide=()=>setRevealed(false)
    const visibility=()=>{if(document.visibilityState==='hidden')hide()}
    window.addEventListener('blur',hide)
    document.addEventListener('visibilitychange',visibility)
    return ()=>{window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility)}
  },[])
  useEffect(()=>{
    if (!revealed || pub?.step !== 'reveal' || !connected) return
    const timeout = window.setTimeout(() => setRevealed(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [revealed, pub?.step, connected])
  useEffect(()=>{
    if(!exitPrompt)return
    const handleBack=(event:Event)=>{event.preventDefault();setExitPrompt(false)}
    const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setExitPrompt(false)}}
    window.addEventListener('galerows:back',handleBack)
    document.addEventListener('keydown',handleKey)
    return ()=>{window.removeEventListener('galerows:back',handleBack);document.removeEventListener('keydown',handleKey)}
  },[exitPrompt])
  useEffect(()=>{
    if(pub?.step!=='reveal'||!connected)return
    const clock=window.setInterval(()=>setNow(Date.now()),250)
    return ()=>window.clearInterval(clock)
  },[pub?.step,connected])
  if(!pub)return <section role="status">Aguardando estado da partida.</section>
  const count = Math.max(0,Math.ceil(((pub.startedAt??0)+3000-now)/1000))
  const allSeen = pub.seenCount === pub.totalPlayers
  const voteCount = pub.voteCount??0
  const duration = pub.timerSeconds??0
  const elapsed = pub.timerStartedAt ? Math.max(0,Math.floor((now-pub.timerStartedAt)/1000)) : 0
  const remaining = Math.max(0,duration-elapsed)
  return <div className="ip-root ip-screen-game ip-immersive" data-testid="impostor-immersive">
    <div className="ip-shell"><main className="ip-playfield">
      <div className="ip-game-meta ip-real-game-meta">
        <span><Radio size={15}/> Rede local</span>
        <span>RODADA · {session?.split(':').at(-1)??'01'}</span>
        <span><Crown size={13}/> {nameOf(snapshot.roomState.hostPlayerId)} <small>Host</small></span>
        <span>{connected?<><Users size={15}/> {members.length} na sala</>:<><WifiOff size={15}/> Sem conexão</>}</span>
      </div>
      {!connected&&<div className="ip-real-offline" role="alert"><WifiOff size={18}/>
        Conexão interrompida; a identidade fica oculta.
        {!isHost&&<button type="button" onClick={onReconnect} disabled={busy}>Reconectar</button>}
      </div>}
      {count>0&&pub.step==='reveal'&&connected
        ? <section className="ip-real-countdown" role="status" aria-live="polite">
            <span>Prepare seu disfarce</span><strong>{count}</strong>
            <p>A missão começa em instantes...</p>
          </section>
        : <>
        <div className="ip-stage-progress" aria-label="Etapa atual">
          <span className={pub.step==='reveal'?'is-active':''}>01 · IDENTIDADE</span>
          <span className={pub.step==='voting'?'is-active':''}>02 · VOTAÇÃO</span>
          {pub.step==='summary'&&<span className="is-active">03 · RESULTADO</span>}
        </div>
        {pub.step==='reveal'&&<section className="ip-real-identity">
          <div className="ip-stage-heading"><p className="ip-eyebrow">SÓ VOCÊ PODE VER</p>
            <h1>Seu segredo fica com você.</h1>
            <p>Confira em particular. A informação fica visível por 5 segundos e pode ser revelada novamente.</p>
          </div>
          {!priv&&<p role="status" className="ip-team-pending">Esta rodada já está em andamento. Você participará da próxima.</p>}
          {priv&&<section className={'ip-secret-card'+(showSecret?' ip-secret-open':'')} aria-label="Sua informação secreta">
            <div className="ip-secret-top"><span><LockKeyhole size={13}/> CONFIDENCIAL</span>
              <span>ACESSO INDIVIDUAL</span></div>
            <div className="ip-secret-content" aria-live="polite">
              {showSecret
                ? priv.kind==='word'
                  ? <><ShieldCheck size={40}/><p className="ip-eyebrow">SUA PALAVRA</p>
                      <h2>{priv.word}</h2><p>Guarde o segredo. Dê uma dica em voz alta.</p></>
                  : <><ShieldQuestion size={40}/><p className="ip-eyebrow">VOCÊ É O IMPOSTOR</p>
                      <h2>{priv.kind==='impostor-hint'?'Dica: '+priv.hint:'Sem palavra'}</h2>
                      <p>Escute as dicas sem revelar sua identidade.</p></>
                : <><Fingerprint size={68} strokeWidth={1}/><h2>Identidade protegida</h2>
                    <p>Revele quando ninguém estiver olhando.</p></>}
            </div>
            <button type="button" className="ip-reveal-button" disabled={blocked} aria-pressed={showSecret}
              onClick={()=>{
                setRevealed(!showSecret)
                if(!showSecret&&!priv.wasSeen)onAction('ACK_BRIEFING',null)
              }}>{showSecret?<EyeOff size={18}/>:<Eye size={18}/>}
              {showSecret?'Ocultar informação':'Revelar minha informação'}</button>
            <span className="ip-card-serial" aria-hidden="true">GRW / INF — SEGREDO PESSOAL</span>
          </section>}
          {allSeen?<div className="ip-team-brief" role="status">
            <div><Check size={18}/><strong>Todos visualizaram!</strong>
              <span>{pub.seenCount}/{pub.totalPlayers}</span></div>
            <p>{pub.conversationMode==='one-word'
              ? 'Cada pessoa fala uma palavra ou dica em voz alta.'
              : 'Cada pessoa responde à mesma pergunta em voz alta. Perguntas adicionais podem ser feitas entre os amigos.'}</p>
            {pub.question&&<p><strong>Pergunta para todos:</strong> {pub.question}</p>}
            {isHost&&pub.question&&<button type="button" disabled={blocked}
              onClick={()=>onAction('NEXT_QUESTION',null)}>Trocar pergunta</button>}
            <p><strong>Quem começa:</strong> {pub.firstSpeaker?nameOf(pub.firstSpeaker):'A galera escolhe'}</p>
            {isHost&&<button type="button" disabled={blocked}
              onClick={()=>onAction('DRAW_FIRST_SPEAKER',null)}>Sortear quem começa</button>}
            <small>Você pode consultar sua informação novamente até começar a votação.</small>
          </div>:<div className="ip-team-pending" role="status"><Users size={18}/>
            {pub.seenCount} de {pub.totalPlayers} visualizaram.</div>}
          {allSeen&&duration>0&&<div className="ip-inline-timer">
            <div><Timer size={18}/><span>Tempo da conversa</span>
              <strong role="timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</strong></div>
            {isHost&&!pub.timerStartedAt&&<button type="button" disabled={blocked}
              onClick={()=>onAction('START_TIMER',null)}>Iniciar cronômetro</button>}
            {remaining===0&&pub.timerStartedAt&&<p>Tempo esgotado. O anfitrião decide quando votar.</p>}
          </div>}
          {allSeen&&isHost&&<button className="ip-button" type="button" disabled={blocked}
            onClick={()=>{setRevealed(false);onAction('START_VOTING',null)}}>
            Abrir votação para todos <ArrowRight size={17}/></button>}
          {allSeen&&!isHost&&<p className="ip-helper">Aguardando o anfitrião liberar a votação.</p>}
        </section>}
        {pub.step==='voting'&&<section className="ip-real-voting">
          <div className="ip-stage-heading"><p className="ip-eyebrow">VOTO INDIVIDUAL</p>
            <h1>{pub.voteRound===2?'Votação de desempate':'Quem é o impostor?'}</h1>
            <p>{pub.voteRound===2?'Empate! Escolha entre os mais votados.':
              'Escolha um suspeito e confirme. O voto é secreto.'}</p>
          </div>
          {priv?.hasVoted?<div className="ip-vote-wait" role="status">
            <div className="ip-stage-symbol"><ShieldCheck size={30}/></div>
            <h2>Voto confirmado.</h2><p>Aguarde os outros participantes votarem.</p>
            <strong>{voteCount} de {pub.totalPlayers} votos registrados</strong>
            <div className="ip-progress"><span style={{width:(100*voteCount/pub.totalPlayers)+'%'}}/></div>
          </div>:<>
            <div className="ip-suspects" role="group" aria-label="Escolher suspeito">
              {members.filter(m=>!pub.runoffCandidates||pub.runoffCandidates.includes(m.playerId))
                .map(member=><button type="button" key={member.playerId} disabled={blocked}
                  aria-pressed={selected===member.playerId}
                  className={selected===member.playerId?'ip-selected':''}
                  onClick={()=>setSelected(member.playerId)}>
                  <span className="ip-avatar ip-vote-avatar">{nameOf(member.playerId).slice(0,2).toUpperCase()}</span>
                  <strong>{nameOf(member.playerId)}{member.playerId===playerId?' (você)':''}
                    {member.role==='host'&&<small className="ip-host-marker"> · Host</small>}</strong>
                  <span className="ip-radio">{selected===member.playerId&&<Check size={12}/>}</span>
                </button>)}
            </div>
            <button type="button" className="ip-button" disabled={!selected||blocked}
              onClick={()=>{if(selected)onAction('VOTE',{playerId:selected})}}>
              <Check size={17}/> {selected?'Confirmar voto em '+nameOf(selected):'Escolha um suspeito'}
            </button>
            <p className="ip-helper">O resultado aparece para todos ao concluir a votação.</p>
          </>}
        </section>}
        {pub.step==='final-guess'&&pub.scoringMode==='individual'&&<section className="ip-real-voting">
          <div className="ip-stage-heading">
            <p className="ip-eyebrow">BÔNUS DO IMPOSTOR</p>
            <h1>Última chance de descobrir a palavra</h1>
            <p>O impostor pode tentar adivinhar a palavra. Os pontos individuais dos votos já estão registrados.</p>
          </div>
          {priv?.canGuess&&<form onSubmit={event=>{
            event.preventDefault()
            if (guess.trim()) onAction('GUESS_WORD',{word:guess.trim()})
          }} className="ip-guess-form">
            <label htmlFor="ip-final-guess">Qual era a palavra?</label>
            <input id="ip-final-guess" maxLength={80} value={guess} onChange={event=>setGuess(event.target.value)} />
            <button className="ip-button" disabled={!guess.trim()||blocked} type="submit">Confirmar palpite</button>
          </form>}
          {!priv?.canGuess&&<p className="ip-helper">Aguardando o impostor tentar adivinhar a palavra.</p>}
          {isHost&&<button type="button" className="ip-button" disabled={blocked}
            onClick={()=>onAction('SKIP_GUESS',null)}>Encerrar sem palpite</button>}
        </section>}
        {pub.step==='summary'&&<section className="ip-real-results">
          <div className="ip-result-hero"><div className="ip-result-icon"><Trophy size={50}/></div>
            <p className="ip-eyebrow">RESULTADO DA RODADA</p>
            <h1>{pub.winner==='group'?'Vitória da galera!':'Vitória do impostor!'}</h1>
            <p>{pub.reason==='tied-vote'?'Empate no desempate: o impostor escapou.'
              :pub.reason==='not-found'?'O grupo votou na pessoa errada.':'O impostor foi descoberto.'}</p>
          </div>
          {pub.result?.impostorGuessedCorrectly && <div className="ip-word-bonus" role="status">
            <Check size={22} aria-hidden="true"/>
            <div><strong>O impostor acertou a palavra!</strong>
              <p>{pub.scoringMode === 'individual'
                ? 'Acertou a palavra e ganhou +1 ponto extra.'
                : 'O palpite estava correto.'}</p></div>
          </div>}
          {pub.result&&<><div className="ip-debrief">
            <div><span className="ip-eyebrow">O IMPOSTOR ERA</span>
              <strong>{nameOf(pub.result.impostorId)}</strong></div>
            <div><span className="ip-eyebrow">A PALAVRA ERA</span>
              <strong className="ip-answer">{pub.result.word}</strong></div>
          </div><section className="ip-scoreboard"><h2>Pontos da rodada</h2><ul>
            {Object.entries(pub.result.points).map(([id,points])=><li key={id}>
              <strong>{nameOf(id)}</strong><span className={points?'ip-points':'ip-muted'}>+{points} pts</span>
            </li>)}
          </ul></section></>}
          {isHost&&snapshot.roomState.phase==='playing'&&<button type="button" className="ip-button"
            disabled={busy||!connected} onClick={onEnd}>Registrar pontuação <ArrowRight size={18}/></button>}
          {isHost&&snapshot.roomState.phase==='results'&&<div className="ip-replay-actions">
            {onReplay&&<button type="button" className="ip-button" disabled={busy||!connected}
              onClick={onReplay}><ArrowRight size={18}/> Jogar novamente</button>}
            <button type="button" className="ip-button" disabled={busy||!connected}
              onClick={onBackToLobby}><ArrowLeft size={18}/> Voltar com todos ao lobby</button></div>}
          {!isHost&&<p className="ip-helper">O anfitrião retorna com todos ao lobby após o resultado.</p>}
        </section>}
        </>}
      </main>
      <footer className="ip-real-footer">
        <button type="button" onClick={()=>setExitPrompt(true)}>
          {isHost?'Encerrar sala':'Sair da sala'}
        </button>
      </footer>
      {exitPrompt&&<div className="ip-exit-backdrop"><div className="ip-exit-dialog" role="dialog"
        aria-modal="true" aria-labelledby="ip-exit-dialog-title">
        <h2 id="ip-exit-dialog-title">{isHost?'Encerrar sala?':'Sair da sala?'}</h2>
        <p>{isHost?'Todos perderão a conexão com esta sala.':'Você sairá desta sala. Sua partida será encerrada neste aparelho.'}</p>
        {!connected&&!isHost&&<p>Sem conexão: a saída será somente local e não será confirmada pelo anfitrião.</p>}
        <button type="button" className="ip-exit-confirm" disabled={busy} onClick={()=>{
          setExitPrompt(false);if(isHost)onClose();else onLeave()
        }}>{isHost?'Sim, encerrar sala':connected?'Sim, sair da sala':'Fechar neste aparelho'}</button>
        <button type="button" className="ip-exit-cancel" disabled={busy}
          onClick={()=>setExitPrompt(false)}>Continuar no jogo</button>
      </div></div>}
    </div>
  </div>
}
