import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Crown, Eye, EyeOff, LockKeyhole,
  Moon, Play, Shield, Skull, Sun, Users, Vote, X,
} from 'lucide-react'
import { createDefaultCidadeDormeSettings, getRecommendedKillersCount } from '../../../cidade-dorme/cidadeDorme.setup'
import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'
import type { CidadeDormeLanConfig, CidadeDormeLanPublic } from '../../cidadeDormeLanGame'
import { CidadeDormePreviewRoom } from './cidadeDormePreviewRoom'
import './cidadeDormePrototype.css'

type Stage = 'entry' | 'room' | 'transition' | 'game' | 'results'
const defaults = createDefaultCidadeDormeSettings(4)
const initialConfig: CidadeDormeLanConfig = {
  enableDoctor: defaults.enableDoctor, enableDetective: defaults.enableDetective,
  enableJester: defaults.enableJester, revealRoleOnDeath: defaults.revealRoleOnDeath,
}
const roleName: Record<RoleKey, string> = {
  citizen: 'Cidadão', killer: 'Assassino', traitor: 'Traidor', doctor: 'Médico', detective: 'Detetive', jester: 'Coringa',
}
const roleDescription: Record<RoleKey, string> = {
  citizen: 'Você não acorda à noite. Observe, converse e vote para encontrar os assassinos.',
  killer: 'Acorde na sua vez e escolha uma vítima em segredo. Convença a cidade de que é inocente.',
  traitor: 'Conheça seus aliados; você só escolhe vítimas quando assumir após a morte do assassino ativo.',
  doctor: 'Acorde à noite e escolha uma pessoa para proteger. Você não pode proteger a si mesmo.',
  detective: 'Investigue uma pessoa à noite. A resposta aparece somente neste celular.',
  jester: 'Seu objetivo é convencer a cidade a eliminar você pela votação.',
}
const stepCopy: Record<CidadeDormeLanPublic['step'], { overline: string; title: string; intro: string }> = {
  reveal: { overline: 'PRÓLOGO · O SEGREDO', title: 'Descubra seu papel', intro: 'A cidade ainda está acordada. Veja sua identidade sem mostrar a ninguém.' },
  'killer-turn': { overline: 'NOITE · A SOMBRA', title: 'A cidade dorme.', intro: 'Os assassinos escolhem em silêncio quem será a vítima.' },
  'doctor-turn': { overline: 'NOITE · A PROTEÇÃO', title: 'Uma chance de salvar.', intro: 'O médico pode proteger uma pessoa nesta noite.' },
  'detective-result': { overline: 'NOITE · PISTA', title: 'Resultado do Detetive', intro: 'Confirme a pista no próprio celular.' },
  'detective-turn': { overline: 'NOITE · A INVESTIGAÇÃO', title: 'Uma pista na escuridão.', intro: 'O detetive investiga uma pessoa. A resposta é só dele.' },
  morning: { overline: 'AMANHECER · A REVELAÇÃO', title: 'A cidade acordou.', intro: 'A noite terminou. Descubram o que aconteceu antes de conversar.' },
  discussion: { overline: 'DIA · O DEBATE', title: 'Quem parece suspeito?', intro: 'Conversem frente a frente. Observem cada história antes do voto.' },
  voting: { overline: 'DIA · O JULGAMENTO', title: 'A cidade decide.', intro: 'Cada pessoa viva vota no próprio celular. O voto permanece secreto.' },
  'vote-result': { overline: 'CREPÚSCULO · O VEREDITO', title: 'O voto foi contado.', intro: 'A decisão da cidade está tomada.' },
  summary: { overline: 'EPÍLOGO · FIM DE PARTIDA', title: 'A noite terminou.', intro: 'Os papéis podem enfim ser revelados.' },
}
const errorText: Record<string, string> = {
  not_ready: 'Ainda falta alguém ficar pronto ou concluir sua ação.',
  invalid_player_count: 'Cidade Dorme precisa de 4 a 12 jogadores conectados.',
  invalid_config: 'Confira as regras antes de salvar.',
  invalid_payload: 'Essa escolha não é válida nesta rodada. Tente outra pessoa.',
  invalid_phase: 'A etapa mudou. Confira o novo estado da partida.',
  unauthorized: 'Essa ação pertence a outro jogador.',
}

export default function CidadeDormePrototype() {
  const [room, setRoom] = useState<CidadeDormePreviewRoom | null>(null)
  const [version, setVersion] = useState(0)
  const [stage, setStage] = useState<Stage>('entry')
  const [viewId, setViewId] = useState('host')
  const [config, setConfig] = useState<CidadeDormeLanConfig>(initialConfig)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownWasStopped, setCountdownWasStopped] = useState(false)
  const [revealState, setRevealState] = useState({ key: '', open: false })
  const [targetId, setTargetId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const countdownTimer = useRef<number | null>(null)
  const transitionTimer = useRef<number | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  void version

  const snapshot = room?.snapshot(viewId)
  const publicGame = snapshot?.gamePublicState?.gameId === 'cidade-dorme'
    ? snapshot.gamePublicState.data as CidadeDormeLanPublic : null
  const secretKey = `${viewId}:${stage}:${publicGame?.step ?? ''}:${publicGame?.round ?? ''}`
  const revealed = revealState.key === secretKey && revealState.open
  const setRevealed = (next: boolean | ((current: boolean) => boolean)) =>
    setRevealState({ key: secretKey, open: typeof next === 'function' ? next(revealed) : next })
  const privateGame = room?.privateState(viewId) ?? null
  const isHost = viewId === 'host'
  const members = snapshot?.roomState.members ?? []
  const selected = snapshot?.roomState.selectedGameId === 'cidade-dorme'
  const configured = Boolean(snapshot?.roomState.selectedConfig)
  const ready = members.filter(member => member.connected && member.ready).length
  const allReady = members.length >= 4 && ready === members.length
  const ownReady = members.find(member => member.playerId === viewId)?.ready ?? false
  const name = (id: string) => id === viewId ? 'Você' : id === 'host' ? 'Anfitrião' : CidadeDormePreviewRoom.name(id)

  useEffect(() => {
    const hide = () => setRevealState(current => ({ ...current, open: false }))
    const onVisibility = () => { if (document.visibilityState === 'hidden') hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }) },
    [viewId, stage, publicGame?.step, publicGame?.round])
  useEffect(() => () => {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current)
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
  }, [])

  const tick = () => setVersion(value => value + 1)
  const begin = (asGuest: boolean) => {
    const preview = new CidadeDormePreviewRoom()
    if (asGuest) {
      preview.joinNext(); preview.joinNext(); preview.joinNext()
      preview.roomCommand('host', 'SELECT_GAME', { gameId: 'cidade-dorme' })
      preview.roomCommand('host', 'CONFIGURE_GAME', initialConfig)
    }
    setRoom(preview); setViewId(asGuest ? 'guest-1' : 'host'); setStage('room'); setNotice('')
  }
  const reset = () => {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current)
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    countdownTimer.current = null; transitionTimer.current = null; setCountdownWasStopped(false)
    setCountdown(null); setRoom(null); setStage('entry'); setViewId('host'); setNotice('')
  }
  const changeView = (id: string) => {
    setRevealState({ key: '', open: false }); setTargetId(null); setViewId(id); setNotice('')
  }
  const sendRoom = (actor: string, type: string, payload: unknown = null) => {
    if (!room) return false
    const result = room.roomCommand(actor, type, payload)
    setNotice(result.status === 'accepted' ? '' : errorText[result.error ?? ''] ?? 'Não foi possível concluir a ação.')
    if (result.status === 'accepted' && type === 'CONFIGURE_GAME') setCountdownWasStopped(false)
    if (result.status === 'accepted' && type === 'READY') {
      if (payload && typeof payload === 'object' && 'ready' in payload && payload.ready === false) {
        stopCountdown(); setCountdownWasStopped(false)
      } else startCountdown()
    }
    tick()
    return result.status === 'accepted'
  }
  const sendGame = (actor: string, type: string, payload: unknown = null) => {
    if (!room) return false
    const result = room.gameCommand(actor, type, payload)
    setNotice(result.status === 'accepted' ? '' : errorText[result.error ?? ''] ?? 'Não foi possível concluir a ação.')
    if (result.status === 'accepted') { setRevealed(false); setTargetId(null) }
    tick()
    return result.status === 'accepted'
  }
  const stopCountdown = () => {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current)
    countdownTimer.current = null; setCountdownWasStopped(true); setCountdown(null)
  }
  const startCountdown = (manual = false) => {
    if (!room || (!manual && countdownWasStopped) || countdownTimer.current !== null) return
    const current = room.snapshot('host').roomState
    const present = current.members.filter(member => member.connected)
    if (current.selectedGameId !== 'cidade-dorme' || !current.selectedConfig
      || present.length < 4 || present.some(member => !member.ready)) return
    setCountdownWasStopped(false)
    let remaining = 5
    setCountdown(remaining)
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1
      if (remaining > 0) { setCountdown(remaining); return }
      if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current)
      countdownTimer.current = null; setCountdown(null)
      const result = room.roomCommand('host', 'START_GAME')
      if (result.status !== 'accepted') {
        setNotice(errorText[result.error ?? ''] ?? 'Não foi possível iniciar a partida.'); tick(); return
      }
      tick(); setStage('transition')
      transitionTimer.current = window.setTimeout(() => { setStage('game'); transitionTimer.current = null }, 900)
    }, 1_000)
  }
  const addGuests = (count: number) => {
    if (countdownTimer.current !== null) { stopCountdown(); setCountdownWasStopped(false) }
    for (let i = 0; i < count; i++) room?.joinNext()
    tick()
  }
  const simulateReady = () => {
    if (!room) return
    for (const id of room.playerIds()) {
      if (id !== viewId && !room.snapshot(id).roomState.members.find(member => member.playerId === id)?.ready) {
        room.roomCommand(id, 'READY', { ready: true })
      }
    }
    tick(); startCountdown()
  }
  const simulateAcks = () => {
    if (!room) return
    for (const id of room.playerIds()) {
      if (id !== viewId && !room.privateState(id)?.acknowledged) room.gameCommand(id, 'ACK_ROLE')
    }
    tick()
  }
  const simulateAction = () => {
    if (!room?.simulateCurrentAction(viewId)) setNotice('É a sua vez de agir. Escolha alguém abaixo.')
    else setNotice('')
    tick()
  }
  const simulateVotes = () => { room?.simulateRemainingVotes(viewId); tick() }

  const step = publicGame?.step
  const night = step === 'reveal' || step === 'killer-turn' || step === 'doctor-turn' || step === 'detective-turn'
  const activeTargetStep = step === 'killer-turn' || step === 'doctor-turn' || step === 'detective-turn' || step === 'voting'
  const actionType = step === 'killer-turn' ? 'KILL' : step === 'doctor-turn' ? 'PROTECT'
    : step === 'detective-turn' ? 'INVESTIGATE' : 'CAST_VOTE'
  const actionLabel = step === 'killer-turn' ? 'Escolher vítima' : step === 'doctor-turn' ? 'Proteger pessoa'
    : step === 'detective-turn' ? 'Investigar pessoa' : 'Confirmar voto'
  const options = publicGame?.players.filter(player => player.alive && (
    step === 'voting' || player.id !== viewId) && (
    step !== 'killer-turn' || !privateGame?.killerTeammates?.includes(player.id))) ?? []

  return <div className={`cdp-root cdp-${stage} ${night ? 'cdp-night' : ''}`}>
    <div className="cdp-shell">
      <header className="cdp-header">
        <button type="button" className="cdp-brand" onClick={reset} aria-label="Voltar ao início do protótipo">
          <span className="cdp-brand-moon" aria-hidden="true"/><span>GALEROWS <b>/ CIDADE DORME</b></span>
        </button>
        <span className="cdp-preview-label">PRÉVIA INTERATIVA</span>
      </header>

      {stage === 'entry' && <main className="cdp-entry">
        <div className="cdp-entry-art" role="img" aria-label="Cidade iluminada sob a lua durante a noite"/>
        <div className="cdp-entry-copy">
          <p className="cdp-kicker">UMA CIDADE. MUITOS SEGREDOS.</p>
          <h1 ref={titleRef} tabIndex={-1}>Quando a cidade dorme, <em>ninguém é inocente.</em></h1>
          <p>Entre na sala, descubra seu papel e atravesse noites, suspeitas e votos no seu próprio celular.</p>
          <div className="cdp-entry-actions">
            <button type="button" className="cdp-primary" onClick={() => begin(false)}><Moon size={18}/> Criar sala de demonstração <ArrowRight size={17}/></button>
            <button type="button" className="cdp-secondary" onClick={() => begin(true)}><Users size={18}/> Entrar como convidado</button>
          </div>
          <small>Protótipo local. Jogadores e ações de outros celulares são simulados nesta prévia.</small>
        </div>
      </main>}

      {stage === 'room' && room && snapshot && <main className="cdp-room-main">
        <div className="cdp-topline"><button type="button" onClick={reset}><ArrowLeft size={16}/> Início</button>
          <span><span className="cdp-online"/> SALA ABERTA · CD 04</span></div>
        <section className="cdp-room-hero" aria-labelledby="cdp-room-title">
          <div className="cdp-room-hero-image"/>
          <div className="cdp-room-hero-content"><p className="cdp-kicker">O PONTO DE ENCONTRO</p>
            <h1 ref={titleRef} tabIndex={-1} id="cdp-room-title">A cidade se reúne.</h1>
            <p>{selected ? 'O jogo foi escolhido. Configure os papéis e esperem todos ficarem prontos.'
              : 'O anfitrião escolhe o jogo. Cada participante entra antes do primeiro anoitecer.'}</p></div>
          <div className="cdp-room-code"><small>CÓDIGO DE EXEMPLO</small><strong>CD 04</strong></div>
        </section>
        <div className="cdp-room-grid">
          <section className="cdp-panel cdp-roster" aria-labelledby="cdp-roster-title">
            <div className="cdp-section-head"><div><p className="cdp-kicker">MORADORES</p><h2 id="cdp-roster-title">Quem está na sala</h2></div>
              <span>{members.length} / 12</span></div>
            <ul>{members.map((member, index) => <li key={member.playerId}>
              <span className="cdp-avatar">{String(index + 1).padStart(2, '0')}</span>
              <span className="cdp-member-name"><strong>{name(member.playerId)}</strong>
                {member.role === 'host' && <small><Crown size={12}/> Anfitrião</small>}</span>
              <span className={`cdp-ready-chip ${member.ready ? 'is-ready' : ''}`}>{member.ready ? 'Pronto' : 'Aguardando'}</span>
            </li>)}</ul>
            {members.length < 4 && <p className="cdp-hint">Faltam {4 - members.length} pessoas para jogar. Simule a entrada pelos controles abaixo.</p>}
          </section>
          <section className="cdp-panel cdp-settings" aria-labelledby="cdp-settings-title">
            <div className="cdp-section-head"><div><p className="cdp-kicker">ESCOLHA DO ANFITRIÃO</p><h2 id="cdp-settings-title">O jogo da noite</h2></div>
              <Skull size={24} aria-hidden="true"/></div>
            <div className="cdp-game-choice"><Moon size={29} aria-hidden="true"/><div><strong>Cidade Dorme</strong>
              <span>Papéis secretos · noites · votação</span></div></div>
            {isHost && !selected && <button type="button" className="cdp-secondary" onClick={() => sendRoom('host', 'SELECT_GAME', { gameId: 'cidade-dorme' })}>
              Escolher Cidade Dorme <ArrowRight size={16}/></button>}
            {selected && isHost && <div className="cdp-config">
              <h3>Quem entra na história?</h3>
              <p>Um assassino em grupos de 4 a 7. A quantidade cresce com a sala.</p>
              {([['enableDoctor', 'Médico', 'Pode proteger alguém à noite.'],
                ['enableDetective', 'Detetive', 'Investiga uma pessoa em segredo.'],
                ['enableJester', 'Coringa', 'Vence se for eliminado pelo voto.'],
                ['revealRoleOnDeath', 'Revelar papéis', 'Mostra o papel quando alguém morre.']] as const)
                .map(([key, label, description]) => <button key={key} type="button" className="cdp-toggle"
                  aria-pressed={config[key]} onClick={() => setConfig(value => ({ ...value, [key]: !value[key] }))}>
                  <span><strong>{label}</strong><small>{description}</small></span><span className="cdp-switch" aria-hidden="true"/></button>)}
              <p className="cdp-config-note">{members.length >= 4
                ? `${getRecommendedKillersCount(members.length)} assassino${getRecommendedKillersCount(members.length) > 1 ? 's' : ''} para ${members.length} jogadores.`
                : 'Mínimo de 4 jogadores para começar.'}</p>
              <button type="button" className="cdp-secondary" onClick={() => sendRoom('host', 'CONFIGURE_GAME', config)}>
                <Check size={17}/> Salvar regras</button>
              {configured && <p className="cdp-saved"><Check size={15}/> Regras salvas. Todos já podem ficar prontos.</p>}
            </div>}
            {selected && !isHost && <div className="cdp-guest-rules"><LockKeyhole size={20}/>
              <p>{configured ? 'O anfitrião salvou as regras. Seu papel será revelado apenas no início da partida.'
                : 'O anfitrião está escolhendo os papéis da noite.'}</p></div>}
          </section>
        </div>
        <section className="cdp-launch" aria-label="Preparar partida">
          <div><p className="cdp-kicker">ANTES DE ANOITECER</p><h2>{countdown === null ? 'Esperando a cidade ficar pronta.' : 'O anoitecer se aproxima.'}</h2>
            <p>{ready} de {members.length} moradores prontos.</p></div>
          {countdown !== null ? <div className="cdp-countdown" role="status"><span>PARTIDA EM</span>
            <strong role="timer" aria-label={`${countdown} segundos`}>{countdown}</strong>
            {isHost && <button type="button" onClick={stopCountdown}><X size={16}/> Parar contagem</button>}</div>
            : <div className="cdp-launch-actions">
              {configured && <button type="button" className={ownReady ? 'cdp-secondary' : 'cdp-primary'}
                onClick={() => sendRoom(viewId, 'READY', { ready: !ownReady })}>
                <Check size={17}/>{ownReady ? 'Cancelar pronto' : 'Estou pronto'}</button>}
              {isHost && <button type="button" className="cdp-primary" disabled={!allReady || !configured}
                onClick={() => startCountdown(true)}><Play size={17}/> {countdownWasStopped ? 'Reiniciar contagem' : 'Começar contagem'} <ArrowRight size={17}/></button>}
              {!isHost && <p>Quando todos estiverem prontos, o anfitrião inicia a contagem.</p>}
            </div>}
        </section>
        <PreviewControls room={room} viewId={viewId} onView={changeView}
          onAdd={() => addGuests(members.length === 1 ? 3 : 1)} onReady={simulateReady}/>
      </main>}

      {stage === 'transition' && <main className="cdp-transition-scene" aria-live="polite">
        <span className="cdp-transition-moon" aria-hidden="true"/>
        <p className="cdp-kicker">A PRIMEIRA NOITE COMEÇA</p><h1 ref={titleRef} tabIndex={-1}>As luzes se apagam.<br/><em>A cidade dorme.</em></h1>
      </main>}

      {stage === 'game' && room && publicGame && snapshot && <main className="cdp-game-main">
        <div className="cdp-topline"><span><span className="cdp-online"/> RODADA {String(publicGame.round).padStart(2, '0')}</span>
          <span>{night ? <Moon size={16}/> : <Sun size={16}/>} {night ? 'NOITE' : 'DIA'} · {publicGame.players.filter(p => p.alive).length} VIVOS</span></div>
        <div className={`cdp-chapter cdp-step-${publicGame.step}`}>
          <div className="cdp-chapter-art" aria-hidden="true"/>
          <div className="cdp-chapter-copy"><p className="cdp-kicker">{stepCopy[publicGame.step].overline}</p>
            <h1 ref={titleRef} tabIndex={-1}>{stepCopy[publicGame.step].title}</h1>
            <p>{stepCopy[publicGame.step].intro}</p></div>
        </div>
        <div className="cdp-game-grid">
          {privateGame && publicGame.step !== 'summary' && <section className={`cdp-role-panel ${revealed ? 'is-revealed' : ''}`} aria-label="Seu papel secreto">
            <div className="cdp-role-top"><LockKeyhole size={16}/><span>APENAS PARA SEUS OLHOS</span><span>0{publicGame.round}</span></div>
            {revealed ? <div className="cdp-role-content"><p>SEU PAPEL</p>
              <h2 data-testid="preview-role-name">{roleName[privateGame.role]}</h2>
              <span>{roleDescription[privateGame.role]}</span>
              {privateGame.killerTeammates && privateGame.killerTeammates.length > 0 &&
                <small>Seus aliados: {privateGame.killerTeammates.map(name).join(', ')}</small>}
              {privateGame.investigation && <small>Investigação: {name(privateGame.investigation.targetId)} é
                {privateGame.investigation.result === 'suspect' ? ' suspeito.' : ' inocente.'}</small>}</div>
              : <div className="cdp-role-covered"><Moon size={40} strokeWidth={1.2}/><strong>Identidade protegida</strong>
                <span>Vire a carta longe dos olhares da galera.</span></div>}
            <button type="button" className="cdp-secondary" onClick={() => setRevealed(value => !value)}>
              {revealed ? <EyeOff size={17}/> : <Eye size={17}/>}{revealed ? 'Ocultar meu papel' : 'Revelar meu papel'}</button>
          </section>}
          <section className="cdp-story-panel" aria-label="Ação da rodada">
            {publicGame.step === 'reveal' && <>
              <p className="cdp-kicker">TODOS TÊM UM SEGREDO</p><h2>Conheça seu papel.</h2>
              <p>{publicGame.seenCount} de {publicGame.totalPlayers} pessoas confirmaram.</p>
              {!privateGame?.acknowledged && <button type="button" className="cdp-primary" disabled={!revealed}
                onClick={() => sendGame(viewId, 'ACK_ROLE')}><Check size={18}/> Entendi meu papel</button>}
              {privateGame?.acknowledged && <p className="cdp-saved"><Check size={16}/> Confirmado. Aguarde os demais.</p>}
              {isHost && <button type="button" className="cdp-secondary"
                disabled={publicGame.seenCount !== publicGame.totalPlayers}
                onClick={() => sendGame('host', 'START_NIGHT')}>Começar a primeira noite <ArrowRight size={16}/></button>}
            </>}
            {activeTargetStep && <>
              <p className="cdp-kicker">{publicGame.step === 'voting' ? 'UM VOTO POR PESSOA' : 'AÇÃO EM SEGREDO'}</p>
              <h2>{publicGame.step === 'voting' ? 'A escolha é sua.' : privateGame?.canAct ? 'Sua vez de agir.' : 'Aguarde em silêncio.'}</h2>
              <p>{publicGame.step === 'voting'
                ? `${publicGame.votedCount} de ${publicGame.eligibleVoters} votos recebidos.`
                : 'A próxima etapa começa quando a pessoa responsável concluir a ação.'}</p>
              {privateGame?.canAct && !privateGame.voted && <div className="cdp-targets" role="group" aria-label="Escolher pessoa">
                {options.map(player => <button type="button" key={player.id} aria-pressed={targetId === player.id}
                  onClick={() => setTargetId(player.id)}>{name(player.id)}</button>)}
                <button type="button" className="cdp-primary" disabled={!targetId}
                  onClick={() => targetId && sendGame(viewId, actionType, { playerId: targetId })}>{actionLabel} <ArrowRight size={16}/></button>
              </div>}
              {privateGame?.voted && publicGame.step === 'voting' && <p className="cdp-saved"><Check size={16}/> Seu voto foi registrado.</p>}
              {isHost && publicGame.step === 'voting' && <button type="button" className="cdp-secondary"
                disabled={publicGame.votedCount !== publicGame.eligibleVoters}
                onClick={() => sendGame('host', 'RESOLVE_VOTE')}>Revelar resultado dos votos <ArrowRight size={16}/></button>}
            </>}
            {publicGame.step === 'morning' && <><p className="cdp-kicker">O QUE ACONTECEU?</p>
              <h2>{publicGame.nightResult?.eliminatedId
                ? `${name(publicGame.nightResult.eliminatedId)} não resistiu à noite.`
                : 'Todos sobreviveram à noite.'}</h2>
              <p>Agora a cidade pode conversar. O alvo e a proteção continuam em segredo.</p>
              {isHost && <button type="button" className="cdp-primary" onClick={() => sendGame('host', 'START_DISCUSSION')}>
                Abrir discussão <ArrowRight size={16}/></button>}</>}
            {publicGame.step === 'discussion' && <><p className="cdp-kicker">CONVERSA PRESENCIAL</p>
              <h2>Olhem uns nos olhos.</h2><p>Contem o que sabem, escutem os outros e decidam em quem confiar.</p>
              {isHost && <button type="button" className="cdp-primary" onClick={() => sendGame('host', 'START_VOTE')}>
                Abrir votação <Vote size={16}/></button>}</>}
            {publicGame.step === 'vote-result' && <><p className="cdp-kicker">O VEREDITO</p>
              <h2>{publicGame.voteResult?.kind === 'tie' ? 'Empate. Ninguém sai.'
                : `${name(publicGame.voteResult?.eliminatedId ?? '')} foi eliminado.`}</h2>
              <p>A cidade terá outra noite para descobrir a verdade.</p>
              {isHost && <button type="button" className="cdp-primary" onClick={() => sendGame('host', 'NEXT_NIGHT')}>
                Próxima noite <Moon size={16}/></button>}</>}
            {publicGame.step === 'summary' && <><p className="cdp-kicker">QUEM VENCEU?</p>
              <h2>{publicGame.winner === 'city' ? 'A cidade resistiu.'
                : publicGame.winner === 'killers' ? 'Os assassinos dominaram.' : 'O Coringa venceu.'}</h2>
              <p>Os segredos da partida foram revelados.</p>
              <ul className="cdp-final-roles">{publicGame.finalRoles?.map(player => <li key={player.id}>
                <span>{name(player.id)}</span><strong>{roleName[player.role]}</strong></li>)}</ul>
              {isHost && <button type="button" className="cdp-primary" onClick={() => {
                if (sendRoom('host', 'END_GAME')) setStage('results')
              }}>Finalizar partida e pontuar <ArrowRight size={16}/></button>}</>}
          </section>
        </div>
        {publicGame.players.some(player => !player.alive) && publicGame.step !== 'summary' &&
          <p className="cdp-fallen"><Shield size={15}/> Fora da partida: {publicGame.players.filter(player => !player.alive)
            .map(player => name(player.id)).join(', ')}</p>}
        <PreviewControls room={room} viewId={viewId} onView={changeView}
          onAcks={simulateAcks} onAction={simulateAction} onVotes={simulateVotes} step={publicGame.step}/>
      </main>}

      {stage === 'results' && room && snapshot && <main className="cdp-results-main">
        <div className="cdp-results-art"/><p className="cdp-kicker">RESULTADO DA RODADA</p>
        <h1 ref={titleRef} tabIndex={-1}>O amanhecer tem <em>um vencedor.</em></h1>
        <p>A sala continua aberta. O placar foi atualizado e a galera pode escolher a próxima partida.</p>
        <div className="cdp-score-list">{(snapshot.roomState.competition?.standings ?? []).map(player => <div key={player.playerId}>
          <span>{name(player.playerId)}</span><strong>{player.points} pts</strong></div>)}</div>
        {isHost && <button type="button" className="cdp-primary" onClick={() => {
          if (sendRoom('host', 'RETURN_TO_LOBBY')) setStage('room')
        }}>Voltar à sala <ArrowRight size={16}/></button>}
        {!isHost && <p>O anfitrião leva todos de volta à sala.</p>}
        <PreviewControls room={room} viewId={viewId} onView={changeView}/>
      </main>}
      {notice && <div className="cdp-notice" role="alert">{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
      <footer className="cdp-footer"><span className="cdp-online"/> Protótipo local · sem conexão LAN</footer>
    </div>
  </div>
}

function PreviewControls({ room, viewId, onView, onAdd, onReady, onAcks, onAction, onVotes, step }: {
  room: CidadeDormePreviewRoom; viewId: string; onView: (id: string) => void
  onAdd?: () => void; onReady?: () => void; onAcks?: () => void; onAction?: () => void
  onVotes?: () => void; step?: CidadeDormeLanPublic['step']
}) {
  const ids = room.playerIds()
  return <details className="cdp-lab"><summary>Explorar protótipo <ChevronDown size={15}/></summary>
    <div><p>Troque o celular observado ou simule ações de outros participantes. Nenhum dado sai deste navegador.</p>
      <div className="cdp-lab-views">{ids.map(id => <button type="button" key={id} aria-pressed={id === viewId}
        aria-label={`Ver como ${id === 'host' ? 'anfitrião' : CidadeDormePreviewRoom.name(id)}`}
        onClick={() => onView(id)}>{id === 'host' ? 'Anfitrião' : CidadeDormePreviewRoom.name(id)}</button>)}</div>
      {onAdd && ids.length < 12 && <button type="button" onClick={onAdd}>
        {ids.length === 1 ? 'Adicionar 3 jogadores simulados' : 'Adicionar jogador simulado'}</button>}
      {onReady && <button type="button" onClick={onReady}>Simular prontos dos demais</button>}
      {onAcks && step === 'reveal' && <button type="button" onClick={onAcks}>Simular confirmação dos demais</button>}
      {onAction && (step === 'killer-turn' || step === 'doctor-turn' || step === 'detective-turn')
        && <button type="button" onClick={onAction}>Simular ação do outro jogador</button>}
      {onVotes && step === 'voting' && <button type="button" onClick={onVotes}>Simular votos dos demais</button>}
    </div>
  </details>
}
