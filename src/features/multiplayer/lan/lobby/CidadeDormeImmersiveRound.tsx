import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Crown, DoorOpen,
  Eye, EyeOff, LockKeyhole, Moon, Shield, Skull, Sun, Trophy, Users, Vote, WifiOff, X,
} from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPrivate, CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'
import { CIDADE_DORME_CARDS } from '../../../cidade-dorme/cidadeDorme.cards'
import './cidadeDormeImmersive.css'

type Props = {
  snapshot: RoomSnapshotV2; playerId: string; isHost: boolean; busy: boolean; connected: boolean
  onAction: (type: string, payload: unknown) => void | Promise<void>
  onEnd: () => void | Promise<void>; onBackToLobby: () => void | Promise<void>
  onReplay?: () => void | Promise<void>; onReconnect: () => void | Promise<void>
  onLeave: () => void | Promise<void>; onClose: () => void | Promise<void>; error?: string
}
const roleNames: Record<RoleKey, string> = {
  citizen: 'Cidadão', killer: 'Assassino', doctor: 'Médico', detective: 'Detetive', jester: 'Coringa',
}
const roleDescriptions: Record<RoleKey, string> = {
  citizen: 'Observe, converse e vote. Você não acorda para agir à noite.',
  killer: 'Escolha uma vítima quando chegar sua vez. Seu papel deve permanecer em segredo.',
  doctor: 'Proteja uma pessoa por noite. Você não pode escolher a si mesmo.',
  detective: 'Investigue uma pessoa. O resultado aparece somente neste celular.',
  jester: 'Você vence se a cidade eliminar você pela votação.',
}
const chapter: Record<CidadeDormeLanStep, { eyebrow: string; title: string; prompt: string }> = {
  reveal: { eyebrow: 'PRÓLOGO · O SEGREDO', title: 'Pegue sua carta', prompt: 'Veja sua carta longe dos olhares da galera.' },
  'killer-turn': { eyebrow: 'NOITE · A SOMBRA', title: 'A cidade dorme.', prompt: 'Os assassinos escolhem em silêncio.' },
  'doctor-turn': { eyebrow: 'NOITE · A PROTEÇÃO', title: 'Uma chance de salvar.', prompt: 'O médico pode proteger alguém nesta noite.' },
  'detective-turn': { eyebrow: 'NOITE · A INVESTIGAÇÃO', title: 'Uma pista na escuridão.', prompt: 'O detetive investiga uma pessoa em segredo.' },
  morning: { eyebrow: 'AMANHECER · A REVELAÇÃO', title: 'A cidade acordou.', prompt: 'Descubram o que aconteceu enquanto dormiam.' },
  discussion: { eyebrow: 'DIA · O DEBATE', title: 'Quem parece suspeito?', prompt: 'Conversem frente a frente antes de decidir.' },
  voting: { eyebrow: 'DIA · O JULGAMENTO', title: 'A cidade decide.', prompt: 'Cada pessoa viva vota no próprio celular.' },
  'vote-result': { eyebrow: 'CREPÚSCULO · O VEREDITO', title: 'O voto foi contado.', prompt: 'A decisão da cidade está tomada.' },
  summary: { eyebrow: 'EPÍLOGO · FIM DE PARTIDA', title: 'A noite terminou.', prompt: 'Os papéis podem enfim ser revelados.' },
}
function ActionButton({ children, onClick, disabled, secondary = false }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean
}) {
  return <button type="button" className={`cdg-button${secondary ? ' cdg-secondary' : ''}`}
    disabled={disabled} onClick={onClick}>{children}</button>
}
function Pager({ label, page, pages, onPage }: {
  label: string; page: number; pages: number; onPage: (page: number) => void
}) {
  if (pages < 2) return null
  return <nav className="cdg-pager" aria-label={label}>
    <button type="button" aria-label={`${label}: anteriores`} disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={20}/></button>
    <span aria-live="polite">{page + 1} / {pages}</span>
    <button type="button" aria-label={`${label}: próximos`} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight size={20}/></button>
  </nav>
}
export function CidadeDormeImmersiveRound(props: Props) {
  const state = props.snapshot.gamePublicState
  const data = state?.gameId === 'cidade-dorme' ? state.data as CidadeDormeLanPublic : null
  const key = [props.playerId, props.snapshot.roomState.currentGameSessionId, data?.round, data?.step, props.connected].join(':')
  return <CidadeDormeImmersiveBody key={key} {...props}/>
}
function CidadeDormeImmersiveBody({ snapshot, playerId, isHost, busy, connected, onAction,
  onEnd, onBackToLobby, onReplay, onReconnect, onLeave, onClose, error }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const session = snapshot.roomState.currentGameSessionId
  const game = snapshot.gamePublicState
  const data = game?.gameId === 'cidade-dorme' && game.gameSessionId === session
    ? game.data as CidadeDormeLanPublic : null
  const personalFrame = snapshot.privateState
  const mine = connected && personalFrame?.gameId === 'cidade-dorme' && personalFrame.gameSessionId === session
    ? personalFrame.data as CidadeDormeLanPrivate : null
  const [intro, setIntro] = useState(data?.step === 'reveal' && snapshot.roomState.phase === 'playing')
  const [roleOpen, setRoleOpen] = useState(data?.step === 'reveal')
  const [revealed, setRevealed] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(4)
  const [resultPage, setResultPage] = useState(0)
  const [menu, setMenu] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [resultView, setResultView] = useState<'roles' | 'points'>('roles')
  const blocked = busy || !connected
  const canSend = !blocked && (!sent || Boolean(error))
  const name = (id: string) => {
    const index = snapshot.roomState.members.findIndex(member => member.playerId === id)
    return snapshot.roomState.members[index]?.displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : index < 0 ? 'Jogador' : `Jogador ${index + 1}`)
  }
  useEffect(() => {
    const resize = () => {
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      root.current?.style.setProperty('--cdg-height', `${height}px`)
      root.current?.style.setProperty('--cdg-top', `${viewport?.offsetTop ?? 0}px`)
      root.current?.classList.toggle('cdg-short', height < 670)
      setPageSize(height < 670 ? 2 : 4)
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
  useEffect(() => {
    if (!intro) return
    const timer = window.setTimeout(() => setIntro(false), 1600)
    return () => window.clearTimeout(timer)
  }, [intro])
  useEffect(() => { if (!intro && !roleOpen) heading.current?.focus({ preventScroll: true }) }, [intro, roleOpen, data?.step])
  useEffect(() => {
    const hide = () => { setRevealed(false); setRoleOpen(false) }
    const visibility = () => { if (document.visibilityState === 'hidden') hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(false), 5000)
    return () => window.clearTimeout(timer)
  }, [revealed])
  useEffect(() => {
    const back = (event: Event) => {
      event.preventDefault()
      setRevealed(false)
      if (roleOpen) setRoleOpen(false)
      else if (menu) { setMenu(false); setConfirmExit(false) }
      else setMenu(true)
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') back(event) }
    window.addEventListener('galerows:back', back)
    document.addEventListener('keydown', key)
    return () => { window.removeEventListener('galerows:back', back); document.removeEventListener('keydown', key) }
  }, [roleOpen, menu])
  if (!data) return <div ref={root} className="cdg-root" data-testid="cidade-immersive"><p role="status">Retomando a partida…</p></div>
  const alive = data.players.filter(player => player.alive)
  const night = ['reveal', 'killer-turn', 'doctor-turn', 'detective-turn'].includes(data.step)
  const activeTurn = ['killer-turn', 'doctor-turn', 'detective-turn', 'voting'].includes(data.step)
  const correctRole = data.step === 'killer-turn' ? mine?.role === 'killer'
    : data.step === 'doctor-turn' ? mine?.role === 'doctor'
      : data.step === 'detective-turn' ? mine?.role === 'detective' : data.step === 'voting'
  const canAct = Boolean(mine?.canAct && correctRole && mine.alive && !mine.voted && canSend)
  const targets = alive.filter(player => {
    if (!mine) return false
    if (data.step === 'killer-turn' && (player.id === playerId || mine.killerTeammates?.includes(player.id))) return false
    if ((data.step === 'doctor-turn' || data.step === 'detective-turn') && player.id === playerId) return false
    if (data.step === 'doctor-turn' && mine.eligibleTargetIds && !mine.eligibleTargetIds.includes(player.id)) return false
    return true
  })
  const pages = Math.max(1, Math.ceil(targets.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const action = data.step === 'killer-turn' ? { type: 'KILL', text: 'Escolher vítima' }
    : data.step === 'doctor-turn' ? { type: 'PROTECT', text: 'Proteger pessoa' }
      : data.step === 'detective-turn' ? { type: 'INVESTIGATE', text: 'Investigar pessoa' }
        : { type: 'CAST_VOTE', text: 'Confirmar meu voto' }
  const send = (type: string, payload: unknown = null, personal = false) => {
    if (blocked || (personal && !canSend)) return
    setRevealed(false); setRoleOpen(false)
    if (personal) setSent(true)
    void onAction(type, payload)
  }
  const submit = () => {
    if (!targetId || !canAct || !targets.some(player => player.id === targetId)) return
    send(action.type, { playerId: targetId }, true)
  }
  const roleRows = data.finalRoles ?? []
  const scoreRows = snapshot.roomState.competition?.standings ?? []
  const rowsCount = resultView === 'roles' ? roleRows.length : scoreRows.length
  const resultPages = Math.max(1, Math.ceil(rowsCount / pageSize))
  const currentResultPage = Math.min(resultPage, resultPages - 1)
  const outcome = data.winner === 'city' ? 'A cidade resistiu.'
    : data.winner === 'killers' ? 'Os assassinos dominaram.' : 'O Coringa venceu.'
  return <div ref={root} className={`cdg-root ${night ? 'cdg-night' : 'cdg-day'}`} data-testid="cidade-immersive">
    <div className="cdg-sky" aria-hidden="true"><span className="cdg-moon"/><span className="cdg-horizon"/></div>
    <div className="cdg-shell">
      <header className="cdg-header">
        <button type="button" className="cdg-icon" aria-label="Menu do jogo" onClick={() => { setRevealed(false); setMenu(true) }}><DoorOpen size={19}/></button>
        <div><strong>CIDADE DORME</strong><small><span className={connected ? 'cdg-online' : 'cdg-offline'}/> {connected ? 'Sala conectada' : 'Sem conexão'} · Rodada {data.round}</small></div>
        {mine && data.step !== 'summary' && <button type="button" className="cdg-role-access" disabled={!connected}
          onClick={() => { setRevealed(false); setRoleOpen(true) }}><LockKeyhole size={15}/> Minha carta</button>}
      </header>
      <main className="cdg-scene" key={`${data.round}:${data.step}:${resultView}`}>
        <div className="cdg-chapter"><p className="cdg-eyebrow">{chapter[data.step].eyebrow}</p>
          <h1 ref={heading} tabIndex={-1}>{chapter[data.step].title}</h1><p>{chapter[data.step].prompt}</p></div>
        {data.step === 'reveal' && <section className="cdg-center" aria-label="Confirmar identidade">
          <Moon className="cdg-scene-icon" size={64} strokeWidth={1.1}/>
          <h2>Todos têm um segredo.</h2><p>{data.seenCount} de {data.totalPlayers} pessoas pegaram sua carta.</p>
          {!mine && <p role="status">Aguardando sua informação privada.</p>}
          {mine?.acknowledged ? <p role="status" className="cdg-confirmed"><Check size={17}/> Sua carta foi confirmada.</p>
            : <p>Abra a carta, descubra quem você é e confirme.</p>}
        </section>}
        {activeTurn && <>
          {canAct ? <><p className="cdg-instruction">{data.step === 'voting' ? 'Seu voto é secreto. Escolha uma pessoa.'
            : data.step === 'killer-turn' ? 'Escolha uma vítima sem mostrar aos outros.'
              : data.step === 'doctor-turn' ? 'Escolha quem proteger nesta noite.' : 'Investigue uma pessoa em segredo.'}</p>
            <div className="cdg-targets" role="group" aria-label="Escolher pessoa">
              {targets.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((player, index) =>
                <button type="button" key={player.id} aria-label={`Selecionar ${name(player.id)}`}
                  aria-pressed={targetId === player.id} onClick={() => setTargetId(player.id)}>
                  <span className={`cdg-avatar cdg-tone-${index % 4}`}>{name(player.id).slice(0, 2).toUpperCase()}</span>
                  <strong title={name(player.id)}>{player.id === playerId ? 'Você' : name(player.id)}</strong>
                  <span className="cdg-choice-mark">{targetId === player.id && <Check size={14}/>}</span>
                </button>)}</div>
            <Pager label="Alvos" page={currentPage} pages={pages} onPage={setPage}/>
          </> : <section className="cdg-center" role="status">
            {night ? <Moon className="cdg-scene-icon" size={64} strokeWidth={1.1}/> : <Vote className="cdg-scene-icon" size={60} strokeWidth={1.1}/>}
            <h2>{mine?.voted ? 'Seu voto foi registrado.' : !mine?.alive ? 'Você acompanha a cidade.' : 'Aguarde em silêncio.'}</h2>
            <p>{data.step === 'voting' ? `${data.votedCount} de ${data.eligibleVoters} votos recebidos.`
              : 'A próxima etapa começa após a ação secreta.'}</p></section>}
        </>}
        {data.step === 'morning' && <section className="cdg-center"><Sun className="cdg-scene-icon" size={64} strokeWidth={1.1}/>
          <h2>{data.nightResult?.eliminatedId ? `${name(data.nightResult.eliminatedId)} não resistiu à noite.` : 'Todos sobreviveram à noite.'}</h2>
          <p>A escolha dos assassinos e a proteção continuam em segredo.</p></section>}
        {data.step === 'discussion' && <section className="cdg-center"><Users className="cdg-scene-icon" size={64} strokeWidth={1.1}/>
          <h2>Olhem uns nos olhos.</h2><p>Conversem pessoalmente. Quem está contando a verdade?</p></section>}
        {data.step === 'vote-result' && <section className="cdg-center"><Skull className="cdg-scene-icon" size={64} strokeWidth={1.1}/>
          <h2>{data.voteResult?.kind === 'tie' ? 'Empate. Ninguém sai.' : `${name(data.voteResult?.eliminatedId ?? '')} foi eliminado.`}</h2>
          <p>A cidade terá outra noite para descobrir a verdade.</p></section>}
        {data.step === 'summary' && <><section className="cdg-result-heading"><Trophy size={35}/><h2>{outcome}</h2>
          <p>Os segredos da partida foram revelados.</p></section>
          <div className="cdg-result-switch" role="group" aria-label="Detalhes do resultado">
            <button type="button" aria-pressed={resultView === 'roles'} onClick={() => { setResultView('roles'); setResultPage(0) }}>Papéis</button>
            <button type="button" aria-pressed={resultView === 'points'} onClick={() => { setResultView('points'); setResultPage(0) }}>Placar da sala</button>
          </div>
          <div className="cdg-result-list" aria-label={resultView === 'roles' ? 'Papéis revelados' : 'Placar da sala'}>
            {resultView === 'roles' ? roleRows.slice(currentResultPage * pageSize, (currentResultPage + 1) * pageSize)
              .map(player => <div key={player.id}><span>{name(player.id)}</span><strong>{roleNames[player.role]}</strong></div>)
              : scoreRows.slice(currentResultPage * pageSize, (currentResultPage + 1) * pageSize)
                .map(player => <div key={player.playerId}><span>{player.displayName}</span><strong>{player.points} pts</strong></div>)}
          </div><Pager label={resultView === 'roles' ? 'Papéis' : 'Placar'} page={currentResultPage} pages={resultPages} onPage={setResultPage}/>
        </>}
        {data.step !== 'summary' && data.players.some(player => !player.alive) &&
          <p className="cdg-fallen"><Shield size={14}/> Fora da partida: {data.players.filter(player => !player.alive)
            .map(player => `${name(player.id)}${player.revealedRole ? ` (${roleNames[player.revealedRole]})` : ''}`).join(', ')}</p>}
        <div className="cdg-actions">
          {data.step === 'reveal' && isHost && <ActionButton disabled={blocked || data.seenCount !== data.totalPlayers}
            onClick={() => send('START_NIGHT')}>Começar a primeira noite <ArrowRight size={17}/></ActionButton>}
          {canAct && <ActionButton disabled={!targetId || !targets.some(player => player.id === targetId)} onClick={submit}>
            {action.text} <ArrowRight size={17}/></ActionButton>}
          {data.step === 'morning' && isHost && <ActionButton disabled={blocked} onClick={() => send('START_DISCUSSION')}>
            Abrir discussão <ArrowRight size={17}/></ActionButton>}
          {data.step === 'discussion' && isHost && <ActionButton disabled={blocked} onClick={() => send('START_VOTE')}>
            Abrir votação <Vote size={17}/></ActionButton>}
          {data.step === 'voting' && isHost && <ActionButton secondary disabled={blocked || data.votedCount !== data.eligibleVoters}
            onClick={() => send('RESOLVE_VOTE')}>Apurar votação <ArrowRight size={17}/></ActionButton>}
          {data.step === 'vote-result' && isHost && <ActionButton disabled={blocked} onClick={() => send('NEXT_NIGHT')}>
            Próxima noite <Moon size={17}/></ActionButton>}
          {data.step === 'summary' && (isHost ? snapshot.roomState.phase === 'playing'
            ? <ActionButton disabled={blocked} onClick={() => void onEnd()}>Finalizar partida e pontuar <ArrowRight size={17}/></ActionButton>
            : <><ActionButton disabled={blocked || !onReplay} onClick={() => void onReplay?.()}>Jogar novamente <ArrowRight size={17}/></ActionButton>
              <ActionButton secondary disabled={blocked} onClick={() => void onBackToLobby()}>Voltar com todos ao lobby <ArrowLeft size={17}/></ActionButton></>
            : <p role="status">O anfitrião conduz a próxima partida na mesma sala.</p>)}
        </div>
      </main>
      <footer className="cdg-footer"><span>{isHost ? <Crown size={13}/> : <Moon size={13}/>} {name(playerId)}</span>
        <span>{night ? <Moon size={14}/> : <Sun size={14}/>} {night ? 'NOITE' : 'DIA'} · {alive.length} VIVOS</span></footer>
    </div>
    {intro && <div className="cdg-intro" role="status"><div className="cdg-intro-moon"/><p>AS LUZES SE APAGAM</p>
      <h2>A cidade <em>dorme.</em></h2></div>}
    {roleOpen && !intro && mine && data.step !== 'summary' && connected && <div className="cdg-role-overlay">
      <section className="cdg-role-card" role="dialog" aria-modal="true" aria-label="Sua carta secreta">
        <div className="cdg-role-top"><LockKeyhole size={16}/> APENAS PARA SEUS OLHOS
          <button type="button" aria-label="Fechar carta secreta" onClick={() => { setRevealed(false); setRoleOpen(false) }}><X size={20}/></button></div>
        <div className="cdg-role-face" key={revealed ? 'open' : 'closed'}>
          {revealed ? <><h2 className="cdg-sr-only" data-testid="cidade-private-role">{CIDADE_DORME_CARDS[mine.role].name}</h2>
            <div className="cdg-card-art"><img src={CIDADE_DORME_CARDS[mine.role].src}
              alt={`Carta de ${CIDADE_DORME_CARDS[mine.role].name}`} width={1024} height={1536} draggable={false}/></div>
            <span className="cdg-card-guidance">{roleDescriptions[mine.role]}</span>
            {mine.killerTeammates && mine.killerTeammates.length > 0 && <small>Seus aliados: {mine.killerTeammates.map(name).join(', ')}</small>}
            {mine.investigation && <small>Investigação: {name(mine.investigation.targetId)} é {mine.investigation.result === 'suspect' ? 'suspeito' : 'inocente'}.</small>}</>
            : <><div className="cdg-card-back" aria-hidden="true"><Moon size={72} strokeWidth={1}/></div>
              <h2 className="cdg-card-invitation">Pegue sua carta</h2><span>Confira sem ninguém olhar. A carta se oculta após 5 segundos.</span></>}
        </div>
        <ActionButton secondary disabled={blocked} onClick={() => setRevealed(value => !value)}>
          {revealed ? <EyeOff size={17}/> : <Eye size={17}/>} {revealed ? 'Ocultar minha carta' : 'Pegue sua carta'}</ActionButton>
        {data.step === 'reveal' && !mine.acknowledged && <ActionButton disabled={!revealed || !canSend}
          onClick={() => send('ACK_ROLE', null, true)}><Check size={17}/> Confirmar minha carta</ActionButton>}
      </section></div>}
    {!connected && <div className="cdg-shade"><section role="alert"><WifiOff size={33}/><h2>Conexão interrompida.</h2>
      <p>Sua identidade está oculta. Aguarde a reconexão para continuar.</p>
      {!isHost && <ActionButton onClick={() => void onReconnect()}>Reconectar</ActionButton>}
      <ActionButton secondary onClick={() => { setMenu(true); setConfirmExit(true) }}>{isHost ? 'Encerrar sala' : 'Sair da sala'}</ActionButton></section></div>}
    {error && connected && <p className="cdg-error" role="alert">{error}</p>}
    {menu && <div className="cdg-shade"><section role="dialog" aria-modal="true" aria-label="Menu do jogo">
      <button className="cdg-menu-close" type="button" aria-label="Fechar menu" onClick={() => { setMenu(false); setConfirmExit(false) }}><X size={20}/></button>
      <Moon size={33}/><h2>{confirmExit ? isHost ? 'Encerrar a sala?' : 'Sair da sala?' : 'A cidade espera.'}</h2>
      <p>{confirmExit ? isHost ? 'Todos perderão a conexão com esta sala.' : 'Você precisará de um novo convite para entrar.'
        : 'Seu papel permanece secreto enquanto o menu está aberto.'}</p>
      {confirmExit ? <><ActionButton disabled={busy} onClick={() => { setMenu(false); void (isHost ? onClose() : onLeave()) }}>
        {isHost ? 'Sim, encerrar sala' : connected ? 'Sim, sair da sala' : 'Fechar neste aparelho'}</ActionButton>
        <ActionButton secondary onClick={() => setConfirmExit(false)}>Continuar no jogo</ActionButton></>
        : <><ActionButton secondary onClick={() => setMenu(false)}>Continuar no jogo</ActionButton>
          <button className="cdg-exit-link" type="button" onClick={() => setConfirmExit(true)}>
            <DoorOpen size={17}/>{isHost ? 'Encerrar sala' : 'Sair da sala'}</button></>}
    </section></div>}
  </div>
}
