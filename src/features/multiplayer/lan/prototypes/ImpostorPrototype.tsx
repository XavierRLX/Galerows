import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Crown, Eye, EyeOff,
  Fingerprint, LockKeyhole, Play, Radio, RotateCcw, ScanFace,
  ShieldCheck, ShieldQuestion, Sparkles, Timer, Trophy, UserPlus, Users, Wifi,
} from 'lucide-react'
import './impostorPrototype.css'

// Preview only: no Room, sockets, player credentials or persistent game state.
const players = [
  { id: 'renan', name: 'Renan', initials: 'RE', tone: 'violet' },
  { id: 'ana', name: 'Ana', initials: 'AN', tone: 'pink' },
  { id: 'leo', name: 'Léo', initials: 'LÉ', tone: 'lime' },
  { id: 'bia', name: 'Bia', initials: 'BI', tone: 'peach' },
  { id: 'gui', name: 'Gui', initials: 'GU', tone: 'blue' },
  { id: 'lu', name: 'Lu', initials: 'LU', tone: 'mint' },
] as const
type Screen = 'room' | 'game' | 'result'
type Role = 'agent' | 'impostor'
type ImpostorMode = 'no-word' | 'hint' | 'alternate-word'
type ConversationMode = 'one-word' | 'guided-questions'
type TimerMode = 'off' | '120' | '180' | '300'
const path = (screen: Screen) => '/__prototype/impostor-' + screen

function Avatar({ index, small = false }: { index: number; small?: boolean }) {
  const player = players[index]
  return <span aria-hidden="true" className={'ip-avatar ip-' + player.tone + (small ? ' ip-avatar-small' : '')}>{player.initials}</span>
}
function Radar({ success = false }: { success?: boolean }) {
  return <div className={'ip-radar' + (success ? ' ip-radar-success' : '')} aria-hidden="true">
    <div className="ip-radar-cross"/><div className="ip-radar-ring"/><div className="ip-radar-ring ip-radar-ring-inner"/>
    <i className="ip-radar-dot ip-dot-one"/><i className="ip-radar-dot ip-dot-two"/><i className="ip-radar-dot ip-dot-three"/>
    <div className="ip-radar-core">{success ? <Trophy size={44} strokeWidth={1.3}/> : <ScanFace size={52} strokeWidth={1.15}/>}</div>
    <span className="ip-radar-caption">{success ? 'OPERAÇÃO CONCLUÍDA' : 'IDENTIDADE DESCONHECIDA'}</span>
  </div>
}
function Action({ children, onClick, secondary = false, disabled = false }: {
  children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean
}) {
  return <button type="button" className={secondary ? 'ip-button ip-button-secondary' : 'ip-button'} disabled={disabled} onClick={onClick}>{children}</button>
}
function Lab({ children }: { children: ReactNode }) {
  return <details className="ip-lab"><summary>Explorar protótipo <ChevronDown size={14}/></summary>
    <div className="ip-lab-content"><p>Estados simulados: não representam outros celulares conectados.</p>{children}</div>
  </details>
}

export default function ImpostorPrototype({ screen }: { screen: Screen }) {
  const [params] = useSearchParams()
  const round = Math.max(1, Math.min(99, Number.parseInt(params.get('round') ?? '1',10) || 1))
  const titleRef = useRef<HTMLDivElement>(null)
  useEffect(()=>{titleRef.current?.focus({preventScroll:true})},[round,screen])
  return <div className={'ip-root ip-screen-' + screen}>
    <div className="ip-shell">
      {screen!=='game' && <header className="ip-header">
        <Link to={path('room')} aria-label="Galerows — lobby do protótipo"><img src="/assets/brand/galerows-wordmark.svg" alt="Galerows" width="530" height="178"/></Link>
        <span className="ip-preview-tag">PRÉVIA VISUAL</span>
      </header>}
      <div ref={titleRef} tabIndex={-1} className="ip-page" key={screen + round}>
        {screen==='room' ? <Lobby round={round}/> : screen==='game' ? <Game round={round}/> : <Result round={round}/>}
      </div>
      <footer className="ip-footer"><span className="ip-status-dot"/> Protótipo visual · sem conexão LAN</footer>
    </div>
  </div>
}

function Lobby({ round }: { round:number }) {
  const navigate=useNavigate()
  const [ready,setReady]=useState(false)
  const [invite,setInvite]=useState(false)
  const [countdown,setCountdown]=useState<number|null>(null)
  const [mode,setMode]=useState<ImpostorMode>('no-word')
  const [conversation,setConversation]=useState<ConversationMode>('one-word')
  const [timer,setTimer]=useState<TimerMode>('off')
  useEffect(()=>{
    if(countdown===null)return
    if(countdown===0){
      navigate(path('game')+'?'+new URLSearchParams({round:String(round),mode,conversation,timer}).toString())
      return
    }
    const t=window.setTimeout(()=>setCountdown(c=>c===null?null:c-1),950)
    return ()=>window.clearTimeout(t)
  },[countdown,conversation,mode,navigate,round,timer])
  return <main>
    <div className="ip-room-meta"><span><Wifi size={15}/> SALA DA GALERA</span><span>GRW · 204</span></div>
    <div className="ip-room-heading"><div><p className="ip-eyebrow">PONTO DE ENCONTRO</p><h1>A galera tá na sala.</h1>
      <p>Selecione o jogo, configure e comece quando todos estiverem prontos.</p></div>
      <span className="ip-room-number" aria-hidden="true">06<span>AGENTES</span></span>
    </div>
    <div className="ip-lobby-grid">
      <section className="ip-mission" aria-labelledby="ip-game-title">
        <div className="ip-mission-top"><span className="ip-pill"><span className="ip-status-dot"/> JOGO SELECIONADO</span><span>01 / MISSÃO</span></div>
        <Radar/>
        <div className="ip-mission-copy"><p className="ip-eyebrow">IMPOSTOR DA PALAVRA</p>
          <h2 id="ip-game-title">Operação<br/><em>Infiltrado.</em></h2>
          <p>Uma palavra em comum.<br/>Alguém escondendo a verdade.</p></div>
        <div className="ip-mission-specs"><span><Users size={15}/> 6 jogadores</span><span><ShieldQuestion size={15}/> 1 impostor</span></div>
      </section>
      <section className="ip-roster" aria-labelledby="ip-roster-title">
        <div className="ip-section-heading"><h2 id="ip-roster-title">Sua equipe</h2><span className="ip-muted">6 / 12</span></div>
        <ul className="ip-player-list">{players.map((player,index)=><li key={player.id} className={index===0?'ip-host':''}>
          <Avatar index={index}/><div className="ip-player-name"><strong>{player.name}{index===0&&<small> você</small>}</strong>
            {index===0&&<span><Crown size={12}/> Anfitrião</span>}</div>
          <span className={'ip-ready'+(index===3&&!ready?' ip-not-ready':'')}>
            {index===3&&!ready ? <>Não pronto</> : <><Check size={14}/> Pronto</>}</span>
        </li>)}</ul>
        <button className="ip-invite-button" type="button" aria-expanded={invite} aria-controls="ip-invite" onClick={()=>setInvite(!invite)}>
          <UserPlus size={17}/> Convidar amigos <span>+</span></button>
        {invite&&<div className="ip-invite-panel" id="ip-invite"><p className="ip-eyebrow">CONVITE DE EXEMPLO</p>
          <strong>GRW 204</strong><p>Na LAN real, QR e código são gerados pelo anfitrião. Este é ilustrativo.</p>
          <button className="ip-text-button" type="button" onClick={()=>setInvite(false)}>Fechar convite</button></div>}
      </section>
      <section className="ip-room-settings" aria-label="Configurações do Impostor">
        <div className="ip-section-heading"><h2>Configurar partida</h2><span className="ip-muted">Anfitrião</span></div>
        <fieldset><legend>Modo do impostor</legend>
          {([['no-word','Sem palavra'],['hint','Com dica'],['alternate-word','Palavra alternativa']] as const).map(([v,label])=>
            <button key={v} type="button" aria-pressed={mode===v} onClick={()=>setMode(v)}>{label}</button>)}
        </fieldset>
        <fieldset><legend>Conversa</legend>
          {([['one-word','Uma palavra por pessoa'],['guided-questions','Perguntas guiadas']] as const).map(([v,label])=>
            <button key={v} type="button" aria-pressed={conversation===v} onClick={()=>setConversation(v)}>{label}</button>)}
        </fieldset>
        <fieldset><legend>Cronômetro opcional</legend>
          {([['off','Sem limite'],['120','2 min'],['180','3 min'],['300','5 min']] as const).map(([v,label])=>
            <button key={v} type="button" aria-pressed={timer===v} onClick={()=>setTimer(v)}>{label}</button>)}
        </fieldset>
      </section>
      <section className="ip-rules" aria-labelledby="ip-rules-title">
        <div className="ip-section-heading"><h2 id="ip-rules-title">Como funciona</h2></div>
        <ol><li><span>01</span><p><strong>Revele sua informação</strong>Cada jogador vê somente sua própria identidade.</p></li>
          <li><span>02</span><p><strong>Conversem sem sair da carta</strong>A palavra pode ser consultada novamente.</p></li>
          <li><span>03</span><p><strong>Votem individualmente</strong>O resultado aparece quando todos confirmarem.</p></li></ol>
      </section>
      <div className="ip-launch">
        <div className="ip-readiness" role="status"><span><span className="ip-status-dot"/>
          {ready?'Todos prontos para a missão.':'Só falta a Bia ficar pronta.'}</span><strong>{ready?6:5}/6</strong></div>
        <div className="ip-progress" aria-hidden="true"><span style={{width:ready?'100%':'83.33%'}}/></div>
        {countdown===null ? <Action disabled={!ready} onClick={()=>setCountdown(3)}>
          <Play size={18} fill="currentColor"/> Iniciar partida <ArrowRight size={18}/></Action>
          : <div className="ip-launch-countdown" role="status" aria-live="polite">
            <span>Preparando a entrada de todos</span><strong>{countdown===0?'JOGAR!':countdown}</strong></div>}
        <p>A contagem é simulada; na LAN real todos serão sincronizados.</p>
        <Lab><button type="button" onClick={()=>setReady(!ready)}>{ready?'Simular Bia não pronta':'Simular todos prontos'}</button></Lab>
      </div>
    </div>
  </main>
}

function Game({round}:{round:number}) {
  const navigate=useNavigate()
  const [params]=useSearchParams()
  const [phase,setPhase]=useState<'identity'|'vote'>('identity')
  const [role,setRole]=useState<Role>('agent')
  const [viewAs,setViewAs]=useState<'host'|'guest'>('host')
  const [seen,setSeen]=useState(false)
  const [allSeen,setAllSeen]=useState(false)
  const [selected,setSelected]=useState<number|null>(null)
  const [voteConfirmed,setVoteConfirmed]=useState(false)
  const heading=useRef<HTMLHeadingElement>(null)
  const rawMode=params.get('mode')
  const mode:ImpostorMode=rawMode==='hint'||rawMode==='alternate-word'?rawMode:'no-word'
  const conversation:ConversationMode=params.get('conversation')==='guided-questions'?'guided-questions':'one-word'
  const rawTimer=params.get('timer')
  const timer:TimerMode=rawTimer==='120'||rawTimer==='180'||rawTimer==='300'?rawTimer:'off'
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo(0,0)},[phase])
  const finish=()=>{
    if(selected===null)return
    const winner=selected===(role==='impostor'?0:2)?'team':'impostor'
    navigate(path('result')+'?round='+round+'&winner='+winner+'&role='+role+'&voted='+selected)
  }
  return <main className="ip-game-main ip-playfield">
    <div className="ip-game-meta"><Link to={path('room')}><ArrowLeft size={16}/> Lobby</Link>
      <span>RODADA {String(round).padStart(2,'0')}</span><span><Radio size={14}/> 6 na missão</span></div>
    <h1 ref={heading} tabIndex={-1} className="ip-sr-only">{phase==='identity'?'Identidade secreta':'Votação individual'}</h1>
    <div className="ip-stage-progress" aria-label="Etapa atual">
      <span className={phase==='identity'?'is-active':''}>01 · IDENTIDADE</span>
      <span className={phase==='vote'?'is-active':''}>02 · VOTAÇÃO</span>
    </div>
    {phase==='identity'?
      <Identity role={role} mode={mode} conversation={conversation} timer={timer}
        isHost={viewAs==='host'} seen={seen} allSeen={allSeen} onSeen={()=>setSeen(true)}
        onVote={()=>setPhase('vote')}/>
      : <Voting selected={selected} onSelect={setSelected} confirmed={voteConfirmed}
          onConfirm={()=>setVoteConfirmed(true)} onSimulate={finish}/>}
    <Lab>
      <div className="ip-lab-options">
        <button type="button" aria-pressed={role==='agent'} onClick={()=>{setRole('agent');setSeen(false);setAllSeen(false)}}>Agente · Renan</button>
        <button type="button" aria-pressed={role==='impostor'} onClick={()=>{setRole('impostor');setSeen(false);setAllSeen(false)}}>Impostor · Renan</button>
        <button type="button" aria-pressed={viewAs==='host'} onClick={()=>setViewAs('host')}>Anfitrião</button>
        <button type="button" aria-pressed={viewAs==='guest'} onClick={()=>setViewAs('guest')}>Convidado</button>
      </div>
      {phase==='identity'&&<button type="button" onClick={()=>setAllSeen(true)}>Simular todos visualizaram</button>}
    </Lab>
  </main>
}

function Identity({role,mode,conversation,timer,isHost,seen,allSeen,onSeen,onVote}:{
  role:Role;mode:ImpostorMode;conversation:ConversationMode;timer:TimerMode;
  isHost:boolean;seen:boolean;allSeen:boolean;onSeen:()=>void;onVote:()=>void
}) {
  const [revealed,setRevealed]=useState(false)
  const [remaining,setRemaining]=useState(Number(timer))
  const [running,setRunning]=useState(false)
  useEffect(()=>{
    const hide=()=>setRevealed(false)
    const onVisibility=()=>{if(document.visibilityState==='hidden')hide()}
    window.addEventListener('blur',hide)
    document.addEventListener('visibilitychange',onVisibility)
    return ()=>{window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',onVisibility)}
  },[])
  useEffect(()=>{
    if(!running||remaining<=0||!allSeen)return
    const timeout=window.setTimeout(()=>setRemaining(n=>Math.max(0,n-1)),1000)
    return ()=>window.clearTimeout(timeout)
  },[allSeen,remaining,running])
  const alternate=role==='impostor'&&mode==='alternate-word'
  const hasWord=role==='agent'||alternate
  return <section className="ip-identity-layout">
    <div className="ip-stage-heading">
      <p className="ip-eyebrow">SÓ VOCÊ PODE VER</p>
      <h2>Seu segredo fica com você.</h2>
      <p>Olhe ao redor antes de revelar sua informação.</p>
    </div>
    <section className={'ip-secret-card'+(revealed?' ip-secret-open':'')} aria-label="Sua informação secreta">
      <div className="ip-secret-top"><span><LockKeyhole size={13}/> CONFIDENCIAL</span><span>ACESSO INDIVIDUAL</span></div>
      <div className="ip-secret-content" aria-live="polite">{revealed
        ? hasWord
          ? <><ShieldCheck size={42}/><p className="ip-eyebrow">SUA PALAVRA</p><h4>{alternate?'Manga':'Abacaxi'}</h4>
              <p>Fale uma dica sem revelar a palavra.</p></>
          : <><ShieldQuestion size={42}/><p className="ip-eyebrow">VOCÊ É O IMPOSTOR</p>
              <h4>{mode==='hint'?'Dica: fruta tropical':'Sem palavra'}</h4>
              <p>Escute os outros e tente passar despercebido.</p></>
        : <><Fingerprint size={68} strokeWidth={1}/><h4>Identidade protegida</h4>
            <p>Consulte novamente quando quiser, até começar a votação.</p></>}</div>
      <button className="ip-reveal-button" type="button" aria-pressed={revealed}
        onClick={()=>{setRevealed(!revealed);onSeen()}}>
        {revealed?<EyeOff size={18}/>:<Eye size={18}/>}
        {revealed?'Ocultar informação':'Revelar minha informação'}</button>
      <span className="ip-card-serial" aria-hidden="true">GRW / INF — 001 ▰ ▰ ▰ ▰</span>
    </section>
    {seen&&!allSeen&&<div className="ip-team-status" role="status"><Check size={18}/>
      Você já visualizou. Aguarde os demais.<small>PRÉVIA · 4/6</small></div>}
    {allSeen ? <div className="ip-team-brief" role="status">
        <div><Check size={18}/><strong>Todos visualizaram!</strong><span>6/6</span></div>
        <p>Agora cada pessoa fala {conversation==='one-word'?'uma dica ou uma palavra':'sua resposta à pergunta'} em voz alta. Discutam juntos.</p>
        <small>A sua informação continua disponível acima. Pode revelar novamente.</small>
      </div>
      : <div className="ip-team-pending" role="status"><Users size={18}/> Aguardando todos visualizarem a identidade</div>}
    {allSeen&&timer!=='off'&&<div className="ip-inline-timer">
      <div><Timer size={18}/><span>Tempo da conversa</span>
        <strong role="timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</strong></div>
      {isHost&&<button type="button" onClick={()=>setRunning(!running)}>{running?'Pausar':'Iniciar'} cronômetro</button>}
    </div>}
    {allSeen&&isHost&&<Action onClick={()=>{setRevealed(false);onVote()}}>
      Ir para votação <ArrowRight size={18}/></Action>}
    {allSeen&&!isHost&&<p className="ip-helper">O anfitrião abre a votação quando a conversa terminar.</p>}
  </section>
}

function Voting({selected,onSelect,confirmed,onConfirm,onSimulate}:{
  selected:number|null;onSelect:(index:number)=>void;confirmed:boolean;
  onConfirm:()=>void;onSimulate:()=>void
}) {
  return <section className="ip-voting-layout">
    <div className="ip-stage-heading"><p className="ip-eyebrow">VOTO INDIVIDUAL</p>
      <h2>Quem é o impostor?</h2><p>Escolha um jogador e confirme seu voto.</p></div>
    {!confirmed ? <>
      <div className="ip-suspects" role="group" aria-label="Escolher suspeito">
        {players.map((player,index)=><button type="button" key={player.id}
          aria-pressed={selected===index} className={selected===index?'ip-selected':''} onClick={()=>onSelect(index)}>
          <Avatar index={index}/><strong>{player.name}</strong><span className="ip-radio">{selected===index&&<Check size={12}/>}</span>
        </button>)}
      </div>
      <Action disabled={selected===null} onClick={onConfirm}><Check size={18}/>
        {selected===null?'Escolha um suspeito':'Confirmar voto em '+players[selected].name}</Action>
      <p className="ip-helper">O resultado só aparece depois que todos confirmarem.</p>
    </> : <div className="ip-vote-wait" role="status">
      <div className="ip-stage-symbol"><ShieldCheck size={30}/></div><h2>Voto confirmado.</h2>
      <p>Aguardando os votos dos outros participantes.</p>
      <strong>1 de 6 votos confirmados</strong>
      <div className="ip-progress"><span style={{width:'16.67%'}}/></div>
      <Lab><button type="button" onClick={onSimulate}>Simular os demais votos e mostrar resultado</button></Lab>
    </div>}
  </section>
}

function Result({round}:{round:number}) {
  const navigate=useNavigate()
  const [params]=useSearchParams()
  const teamWon=params.get('winner')!=='impostor'
  const impostor=params.get('role')==='impostor'?0:2
  return <main className="ip-result-main">
    <div className="ip-result-meta"><span className="ip-eyebrow">RELATÓRIO DA MISSÃO</span>
      <span>RODADA {String(round).padStart(2,'0')}</span></div>
    <section className="ip-result-hero"><Radar success/><span className="ip-pill"><Sparkles size={13}/>
      {teamWon?'INFILTRADO NEUTRALIZADO':'MISSÃO DO IMPOSTOR CUMPRIDA'}</span>
      <h1>{teamWon?<>Vitória da <em>galera!</em></>:<>Vitória do <em>impostor!</em></>}</h1>
      <p>Resultado ilustrativo após os seis votos simulados. Nada foi enviado à LAN.</p></section>
    <div className="ip-debrief">
      <div><span className="ip-eyebrow">O IMPOSTOR ERA</span>
        <div><Avatar index={impostor} small/><strong>{players[impostor].name}</strong></div></div>
      <div><span className="ip-eyebrow">A PALAVRA ERA</span>
        <strong className="ip-answer">Abacaxi</strong><span className="ip-muted">Segredo revelado</span></div>
    </div>
    <section className="ip-scoreboard" aria-labelledby="ip-score-title">
      <div className="ip-section-heading"><h2 id="ip-score-title">Pontos da rodada</h2><Trophy size={18}/></div>
      <ul>{players.map((player,index)=>{
        const score=teamWon?index===impostor?0:1:index===impostor?2:0
        return <li key={player.id}><Avatar index={index} small/><strong>{player.name}{index===0&&<small> você</small>}</strong>
          <span className={score?'ip-points':'ip-muted'}>+{score} <small>pts</small></span></li>
      })}</ul>
    </section>
    <div className="ip-result-actions">
      <Action onClick={()=>navigate(path('game')+'?round='+(round+1))}><RotateCcw size={17}/> Nova rodada <ArrowRight size={17}/></Action>
      <Action secondary onClick={()=>navigate(path('room')+'?round='+(round+1))}><Users size={17}/> Voltar ao lobby</Action>
    </div>
    <p className="ip-helper">A votação e os pontos são exemplos. A integração real ainda precisa das regras de desempate e da última chance do impostor.</p>
    <Lab><button type="button" onClick={()=>navigate(path('result')+'?round='+round+'&winner='+(teamWon?'impostor':'team'))}>
      Ver vitória {teamWon?'do impostor':'da galera'}</button></Lab>
  </main>
}
