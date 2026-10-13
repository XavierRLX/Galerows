import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleCheck, Copy, Crown, DoorOpen,
  Eye, EyeOff, Gamepad2, Layers3, Lightbulb, LockKeyhole, Minus, Plus, QrCode, RotateCw,
  ShieldCheck, ShieldQuestion, Skull, Spade, Sparkles, Target, Trophy, Users, Wifi, WifiOff, X,
} from 'lucide-react'
import type { RoomCompetitionV2, RoomSnapshotV2 } from '../../persistentProtocol'
import { gameConfig, lobbyGameCatalog, lobbySummary } from './lobbyView'
import { ImpostorLanRound } from './ImpostorLanRound'
import { PistaUnicaLanRound } from './PistaUnicaLanRound'
import { CidadeDormeLanRound } from './CidadeDormeLanRound'
import type { PistaUnicaCategory } from '../../../pista-unica/pistaUnica.types'
import type { ImpostorMode, ConversationMode } from '../../../impostor-da-palavra/impostorDaPalavra.types'
import type { LobbyGameId, LobbyRole } from './lobbyView'
import './lobby.css'

type Action = () => void | Promise<void>
export interface LobbyRoomViewProps {
  snapshot: RoomSnapshotV2
  role: LobbyRole
  playerId: string
  busy: boolean
  connected?: boolean
  status: string
  error?: string
  code?: string
  roomCode?: string
  hostIp?: string
  inviteQr?: string
  inviteText?: string
  onSelect: (game: LobbyGameId) => void | Promise<void>
  onConfigure: (config: Record<string, number | string | string[] | boolean>) => void | Promise<void>
  onReady: (ready: boolean) => void | Promise<void>
  onStart: Action
  onGameAction: Action
  onGameCommand?: (type: string, payload: unknown) => void | Promise<void>
  onEnd: Action
  onBackToLobby: Action
  onFinishSession?: Action
  onReconnect: Action
  onLeave: Action
  onClose: Action
  onRefreshInvite: Action
  onBrowseGames?: Action
}

function GameGlyph({ gameId }: { gameId: LobbyGameId }) {
  return gameId === 'cidade-dorme' ? <Skull size={30} strokeWidth={1.8} aria-hidden="true" />
    : gameId === 'pista-unica' ? <Lightbulb size={30} strokeWidth={1.8} aria-hidden="true" />
    : gameId === 'impostor-da-palavra' ? <ShieldQuestion size={30} strokeWidth={1.8} aria-hidden="true" />
    : gameId === 'toy' ? <Spade size={30} strokeWidth={1.8} aria-hidden="true" />
    : <Target size={30} strokeWidth={1.8} aria-hidden="true" />
}
function word(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : null
}
const cardNames = Object.keys(lobbyGameCatalog) as LobbyGameId[]

function RoomCompetitionPanel({ competition, isHost, canFinish, onFinishSession }: {
  competition: RoomCompetitionV2; isHost: boolean; canFinish: boolean; onFinishSession?: Action
}) {
  const finished = competition.status === 'finished'
  if (competition.completedGames === 0 && !finished) return null
  const standings = [...competition.standings].sort((a, b) => b.points - a.points
    || b.wins - a.wins || a.displayName.localeCompare(b.displayName, 'pt-BR'))
  const champions = standings.filter(entry => competition.winnerPlayerIds.includes(entry.playerId))
  const title = finished
    ? champions.length > 1 ? 'Campeões da galera!' : 'Campeão da galera!'
    : 'Placar da sala'
  return <section className="pl03-panel pl03-competition" aria-labelledby="pl03-competition-title">
    <div className="pl03-section-heading">
      <div><span className="pl03-eyebrow">{finished ? 'RESULTADO FINAL' : 'PLACAR ACUMULADO'}</span>
        <h2 id="pl03-competition-title">{title}</h2></div>
      <Trophy size={27} aria-hidden="true" className="pl03-competition-trophy" />
    </div>
    {finished && <p className="pl03-competition-champion" role="status">
      {champions.length > 0
        ? champions.map(entry => entry.displayName).join(' e ')
        : 'Nenhum jogador marcou pontos nesta sessão.'}
    </p>}
    <p className="pl03-competition-count">{competition.completedGames}
      {competition.completedGames === 1 ? ' partida pontuada' : ' partidas pontuadas'}</p>
    <ol className="pl03-competition-list">
      {standings.map((entry, index) => <li key={entry.playerId}
        className={competition.winnerPlayerIds.includes(entry.playerId) ? 'is-champion' : ''}>
        <span className="pl03-competition-position">{index + 1}º</span>
        <span className="pl03-competition-member"><strong>{entry.displayName}</strong>
          <small>{entry.wins} vitórias · {entry.played} partidas</small></span>
        <strong className="pl03-competition-points">{entry.points} pts</strong>
      </li>)}
    </ol>
    {!finished && isHost && canFinish && onFinishSession && <button type="button"
      className="pl03-secondary-btn pl03-competition-finish" onClick={() => void onFinishSession()}>
      <Trophy size={18} aria-hidden="true" /> Encerrar disputa
    </button>}
    {finished && <p className="pl03-competition-note">Disputa encerrada. O anfitrião pode fechar a sala quando todos terminarem de conferir o pódio.</p>}
  </section>
}

export function LobbyRoomView({
  snapshot, role, playerId, busy, connected = true, status, error, code, roomCode, hostIp, inviteQr, inviteText,
  onSelect, onConfigure, onReady, onStart, onGameAction, onGameCommand, onEnd, onBackToLobby,
  onFinishSession, onReconnect, onLeave, onClose, onRefreshInvite, onBrowseGames,
}: LobbyRoomViewProps) {
  const summary = lobbySummary(snapshot, role, playerId)
  const isHost = role === 'host'
  const competition = snapshot.roomState.competition
  const competitionFinished = competition?.status === 'finished'
  const [configNumber, setConfigNumber] = useState(2)
  const [impostorMode, setImpostorMode] = useState<ImpostorMode>('no-word')
  const [conversationMode, setConversationMode] = useState<ConversationMode>('one-word')
  const [pistaCategories, setPistaCategories] = useState<PistaUnicaCategory[]>(['words', 'movies', 'series'])
  const [cidadeRoles, setCidadeRoles] = useState({
    enableDoctor: true, enableDetective: true,
    enableJester: false, revealRoleOnDeath: false,
  })
  const [showCatalog, setShowCatalog] = useState(false)
  const [revealedSessionId, setRevealedSessionId] = useState<string | null>(null)
  const [exitPrompt, setExitPrompt] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // A private card intentionally revealed in the foreground must never remain
    // visible in the Android task switcher or when a different person picks up
    // the phone after switching back to the app.
    const hidePrivateCard = () => setRevealedSessionId(null)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') hidePrivateCard()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', hidePrivateCard)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', hidePrivateCard)
    }
  }, [])

  const currentSession = snapshot.roomState.currentGameSessionId
  const revealed = Boolean(currentSession) && revealedSessionId === currentSession
  const secret = snapshot.privateState?.gameSessionId === currentSession
    ? word(snapshot.privateState.data, 'secret') : null
  const count = word(snapshot.gamePublicState?.data, 'count')
  const target = word(snapshot.gamePublicState?.data, 'target')
  const clues = word(snapshot.gamePublicState?.data, 'clueCount')
  const canAct = !busy && connected && summary.phase === 'playing'
    && summary.members.find(member => member.isYou)?.participation === 'active'

  async function copyInvite() {
    if (!inviteText || !navigator.clipboard?.writeText) return
    try { await navigator.clipboard.writeText(inviteText); setCopied(true) }
    catch { setCopied(false) }
  }
  function selectGame(id: LobbyGameId) {
    setShowCatalog(false)
    setConfigNumber(lobbyGameCatalog[id].defaultValue)
    void onSelect(id)
  }

  return <div className="pl03" data-testid="pl03-lobby">
    <header className="pl03-header">
      <img src="/assets/brand/galerows-logo.svg" alt="Galerows" width="168" height="42" />
      <span className="pl03-header-tag"><Wifi size={14} aria-hidden="true" /> LOCAL / LAN</span>
    </header>

    <div className="pl03-container">
      <div className="pl03-kicker"><span className="pl03-light" /> SALA DA GALERA <span className="pl03-kicker-sep">/</span> VERSÃO DE TESTE</div>
      <section className="pl03-intro" aria-label="Informações da sala">
        <div>
          <h1>Todo mundo <em>na roda.</em></h1>
          <p>Uma sala, vários jogos. A próxima rodada começa aqui.</p>
        </div>
        <div className="pl03-revision" aria-label={`Revisão da sala ${snapshot.revision}`}>
          <span>REV.</span><strong>{String(snapshot.revision).padStart(2, '0')}</strong>
        </div>
      </section>

      <div className="pl03-feedback" role="status">
        <span className="pl03-feedback-icon">{connected ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}</span>
        <span>{status}</span>
        <span className="pl03-status-badge">{summary.phaseLabel}</span>
      </div>
      {error && <p role="alert" className="pl03-error"><WifiOff size={17} aria-hidden="true" /> {error}</p>}

      <div className="pl03-layout">
        <div className="pl03-primary">
          <section className="pl03-panel pl03-players" aria-labelledby="pl03-players-title">
            <div className="pl03-section-heading">
              <div><span className="pl03-eyebrow">QUEM TÁ NO JOGO</span><h2 id="pl03-players-title">A galera <span>chegou.</span></h2></div>
              <span className="pl03-count"><Users size={15} aria-hidden="true" /> {summary.connectedCount}/12</span>
            </div>
            <div className="pl03-people-list">
              {summary.members.map((member, index) => <div className={`pl03-player ${!member.connected ? 'is-offline' : ''}`} key={member.playerId}>
                <div className={`pl03-avatar tone-${index % 4}`}>{member.label.charAt(0).toUpperCase()}</div>
                <div className="pl03-player-name"><strong>{member.label} {member.isYou && <small>(você)</small>}</strong>
                  <span>{member.role === 'host' ? <><Crown size={12} aria-hidden="true" /> Anfitrião</>
                    : member.participation === 'waiting' ? 'Aguardando próxima partida' : 'Jogador'}</span></div>
                <span className={`pl03-ready ${!member.connected ? 'off' : member.ready ? 'on' : ''}`}>
                  {member.connected && member.ready ? <Check size={13} aria-hidden="true" /> : null}
                  {!member.connected ? 'Offline' : member.ready ? 'Pronto' : 'Aguardando'}
                </span>
              </div>)}
            </div>
            <footer className="pl03-players-foot"><span><CircleCheck size={16} aria-hidden="true" /> {summary.readyCount} / {summary.connectedCount} prontos</span>
              <span>Até 12 na sala</span></footer>
          </section>

          {competition && <RoomCompetitionPanel competition={competition} isHost={isHost}
            canFinish={!busy && connected && summary.phase === 'lobby'} onFinishSession={onFinishSession} />}

          {!competitionFinished && <section className="pl03-panel pl03-game" aria-labelledby="pl03-game-title">
            <div className="pl03-section-heading">
              <div><span className="pl03-eyebrow">PRÓXIMA RODADA</span><h2 id="pl03-game-title">
                {summary.phase === 'playing' ? 'Valendo!' : summary.phase === 'results' ? 'Fim de rodada.' : 'Qual é o jogo?'}</h2></div>
              <Gamepad2 size={23} aria-hidden="true" className="pl03-muted-icon" />
            </div>

            {(summary.phase === 'lobby' || summary.phase === 'configuring') && isHost && (!summary.gameId || showCatalog) &&
              <div className="pl03-game-options">
                {cardNames.map((id, index) => <button type="button" className={`pl03-game-option game-${id}`} key={id}
                  onClick={() => selectGame(id)} disabled={busy || !connected} aria-label={`Selecionar ${lobbyGameCatalog[id].title}`}>
                  <span className="pl03-game-illustration"><GameGlyph gameId={id} /></span>
                  <span className="pl03-game-copy"><small>0{index + 1} / {id === 'impostor-da-palavra' || id === 'pista-unica' || id === 'cidade-dorme' ? 'JOGO MULTIPLAYER' : 'EXPERIÊNCIA TESTE'}</small><strong>{lobbyGameCatalog[id].title}</strong>
                    <span>{lobbyGameCatalog[id].subtitle}</span></span>
                  <ChevronRight size={19} aria-hidden="true" />
                </button>)}
              </div>}

            {!summary.game && !isHost && <div className="pl03-waiting"><Layers3 size={36} aria-hidden="true" />
              <strong>Aguardando o anfitrião</strong><span>Quando ele escolher o jogo, vai aparecer aqui.</span></div>}

            {summary.game && (!showCatalog || !isHost) && <div className={`pl03-chosen game-${summary.gameId}`}>
              <div className="pl03-chosen-head">
                <span className="pl03-game-illustration"><GameGlyph gameId={summary.gameId!} /></span>
                <div><small>JOGO SELECIONADO</small><strong>{summary.game.title}</strong><span>{summary.game.subtitle}</span></div>
              </div>
              {isHost && (summary.phase === 'configuring' || summary.phase === 'lobby') &&
                <button className="pl03-link-btn" type="button" onClick={() => setShowCatalog(true)} disabled={busy || !connected}>Trocar jogo <ArrowRight size={15} aria-hidden="true" /></button>}
            </div>}

            {summary.phase === 'configuring' && summary.game && <>
              {isHost && summary.gameId === 'impostor-da-palavra' ? <div className="pl03-impostor-config">
                <strong>Como o impostor joga?</strong>
                <div className="pl03-impostor-choices">
                  {([['no-word', 'Sem palavra'], ['hint', 'Com dica'], ['alternate-word', 'Palavra alternativa']] as const)
                    .map(([value, label]) => <button key={value} type="button"
                      className={impostorMode === value ? 'is-selected' : ''}
                      aria-pressed={impostorMode === value} disabled={busy || !connected}
                      onClick={() => setImpostorMode(value)}>{label}</button>)}
                </div>
                <strong>Como a galera dá pistas?</strong>
                <div className="pl03-impostor-choices">
                  {([['one-word', 'Uma palavra por pessoa'], ['guided-questions', 'Perguntas guiadas']] as const)
                    .map(([value, label]) => <button key={value} type="button"
                      className={conversationMode === value ? 'is-selected' : ''}
                      aria-pressed={conversationMode === value} disabled={busy || !connected}
                      onClick={() => setConversationMode(value)}>{label}</button>)}
                </div>
                <p>3 a 12 celulares. Cada pessoa vê sua palavra ou pista individualmente. O impostor pode roubar a palavra no final.</p>
                <button className="pl03-secondary-btn" type="button" disabled={busy || !connected}
                  onClick={() => void onConfigure({ impostorMode, conversationMode })}>
                  <Check size={17} aria-hidden="true" /> Salvar regras do Impostor
                </button>
              </div> : isHost && summary.gameId === 'pista-unica' ? <div className="pl03-impostor-config">
                <strong>Quais categorias vão aparecer?</strong>
                <div className="pl03-impostor-choices">
                  {([['words', 'Palavras'], ['movies', 'Filmes'], ['series', 'Séries']] as const)
                    .map(([value, label]) => <button key={value} type="button"
                      aria-pressed={pistaCategories.includes(value)} disabled={busy || !connected}
                      className={pistaCategories.includes(value) ? 'is-selected' : ''}
                      onClick={() => setPistaCategories(current => current.includes(value)
                        ? current.filter(category => category !== value) : [...current, value])}>{label}</button>)}
                </div>
                <p>3 a 12 jogadores. Cada pessoa escreve no próprio celular, e todos terão uma vez de adivinhar.</p>
                <button type="button" className="pl03-secondary-btn"
                  disabled={busy || !connected || pistaCategories.length === 0}
                  onClick={() => void onConfigure({ categories: pistaCategories })}>
                  <Check size={17} /> Salvar categorias da Pista Única
                </button>
              </div> : isHost && summary.gameId === 'cidade-dorme' ? <div className="pl03-impostor-config">
                <strong>Configure os papéis da galera</strong>
                <div className="pl03-cidade-settings" aria-label="Papéis do Cidade Dorme">
                  {([
                    ['enableDoctor', 'Médico'],
                    ['enableDetective', 'Detetive'],
                    ['enableJester', 'Coringa'],
                    ['revealRoleOnDeath', 'Revelar papel ao morrer'],
                  ] as const).map(([key, label]) => <button type="button" key={key}
                    className={cidadeRoles[key] ? 'is-selected' : ''}
                    aria-pressed={cidadeRoles[key]} disabled={busy || !connected}
                    onClick={() => setCidadeRoles(value => ({ ...value, [key]: !value[key] }))}>
                    <Check size={15} aria-hidden="true" /> {label}
                  </button>)}
                </div>
                <p>4 a 12 celulares. Cada pessoa recebe seu papel secreto; a noite e os votos são resolvidos pela rede local. Assassinos proporcionais à quantidade de jogadores.</p>
                <button type="button" className="pl03-secondary-btn" disabled={busy || !connected}
                  onClick={() => void onConfigure(cidadeRoles)}>
                  <Check size={17} aria-hidden="true" /> Salvar papéis da Cidade Dorme
                </button>
              </div> : isHost ? <div className="pl03-settings">
                <div className="pl03-settings-copy"><strong>Regras da rodada</strong><span>Escolha o desafio antes de começar.</span></div>
                <div className="pl03-stepper" aria-label="Configuração do jogo">
                  <button type="button" aria-label="Diminuir" onClick={() => setConfigNumber(value => Math.max(1, value - 1))} disabled={busy || !connected || configNumber === 1}><Minus size={17} /></button>
                  <span><strong>{configNumber}</strong><small>{summary.game.unit}</small></span>
                  <button type="button" aria-label="Aumentar" onClick={() => setConfigNumber(value => Math.min(summary.game!.maxValue, value + 1))} disabled={busy || !connected || configNumber === summary.game.maxValue}><Plus size={17} /></button>
                </div>
                <button className="pl03-secondary-btn" type="button" onClick={() => void onConfigure(gameConfig(summary.gameId!, configNumber))} disabled={busy || !connected}>
                  <Check size={17} aria-hidden="true" /> Salvar regras
                </button>
              </div> : <div className="pl03-hint"><LockKeyhole size={15} aria-hidden="true" /> O anfitrião define as regras.</div>}
              {Boolean(snapshot.roomState.selectedConfig) && <div className="pl03-configured"><Check size={14} /> Regras confirmadas para esta rodada</div>}
            </>}

            {(summary.phase === 'lobby' || summary.phase === 'configuring') && <>
              <div className="pl03-action-area">
                {summary.canReady && (isHost || Boolean(snapshot.roomState.selectedConfig)) &&
                  <button type="button" className={summary.ownReady ? 'pl03-secondary-btn pl03-ready-action' : 'pl03-primary-btn'}
                    onClick={() => void onReady(!summary.ownReady)} disabled={busy || !connected}>
                    {summary.ownReady ? <><Check size={18} /> Cancelar pronto</> : <><Check size={18} /> Estou pronto</>}</button>}
                {isHost && summary.game && <button type="button" className="pl03-primary-btn"
                  onClick={() => void onStart()} disabled={busy || !connected || !summary.canStart}>
                  <Gamepad2 size={19} aria-hidden="true" /> Iniciar rodada <ArrowRight size={18} aria-hidden="true" /></button>}
              </div>
              {isHost && summary.game && !summary.canStart && <p className="pl03-helper">Para começar, salve as regras e aguarde {summary.gameId === 'cidade-dorme' ? 'ao menos 4 jogadores conectados e todos prontos' : summary.gameId === 'impostor-da-palavra' || summary.gameId === 'pista-unica' ? 'ao menos 3 jogadores conectados e todos prontos' : 'pelo menos dois jogadores prontos'}.</p>}
              {!isHost && <p className="pl03-helper">Marque pronto quando estiver tudo certo. O anfitrião inicia a partida.</p>}
            </>}

            {summary.phase === 'playing' && summary.gameId === 'impostor-da-palavra' && onGameCommand &&
              <ImpostorLanRound snapshot={snapshot} playerId={playerId} isHost={isHost}
                busy={busy} connected={connected} onAction={(type, payload) => void onGameCommand(type, payload)}
                onEnd={() => void onEnd()} />}
            {summary.phase === 'playing' && summary.gameId === 'pista-unica' && onGameCommand &&
              <PistaUnicaLanRound snapshot={snapshot} playerId={playerId} isHost={isHost}
                busy={busy} connected={connected} onAction={(type, payload) => void onGameCommand(type, payload)}
                onEnd={() => void onEnd()} />}
            {summary.phase === 'playing' && summary.gameId === 'cidade-dorme' && onGameCommand &&
              <CidadeDormeLanRound snapshot={snapshot} playerId={playerId} isHost={isHost}
                busy={busy} connected={connected} onAction={(type, payload) => void onGameCommand(type, payload)}
                onEnd={() => void onEnd()} />}
            {summary.phase === 'playing' && summary.gameId !== 'impostor-da-palavra'
              && summary.gameId !== 'pista-unica' && summary.gameId !== 'cidade-dorme' && <div className="pl03-in-game">
              {summary.gameId === 'counter' ? <div className="pl03-score"><span>CONTAGEM DA GALERA</span>
                <strong>{count ?? '0'} <small>/ {target ?? '—'}</small></strong></div>
                : <div className="pl03-score"><span>PISTAS REGISTRADAS</span><strong>{clues ?? '0'}</strong></div>}
              {secret !== null && connected && <div className="pl03-secret">
                <div><LockKeyhole size={17} aria-hidden="true" /><strong>Só você pode ver sua carta</strong></div>
                {revealed && <p className="pl03-secret-value">{secret}</p>}
                <button type="button" className="pl03-secondary-btn"
                  onClick={() => setRevealedSessionId(revealed ? null : currentSession)}
                  aria-label={revealed ? 'Ocultar minha carta' : 'Revelar minha carta'}>
                  {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
                  {revealed ? 'Ocultar minha carta' : 'Revelar minha carta'}</button>
              </div>}
              <div className="pl03-action-area">
                <button className="pl03-primary-btn" type="button" onClick={() => void onGameAction()} disabled={!canAct}>
                  <Plus size={18} aria-hidden="true" /> {summary.game?.action || 'Jogar agora'}</button>
                {isHost && <button type="button" className="pl03-secondary-btn" onClick={() => void onEnd()} disabled={busy || !connected}>Encerrar rodada</button>}
              </div>
              <p className="pl03-helper">Partida sintética para validar a sala. Nenhum jogo real está ativado.</p>
            </div>}

            {summary.phase === 'results' && <div className="pl03-results">
              <div className="pl03-results-glyph"><Trophy size={30} aria-hidden="true" /></div>
              <h3>Mais uma pra conta.</h3>
              <p>Rodada encerrada. Todo mundo continua na mesma sala para escolher o próximo jogo.</p>
              {isHost ? <button type="button" className="pl03-primary-btn" onClick={() => void onBackToLobby()} disabled={busy || !connected}>
                <RotateCw size={18} aria-hidden="true" /> Voltar ao lobby</button>
                : <div className="pl03-hint"><Users size={16} aria-hidden="true" /> Aguardando o anfitrião voltar ao lobby.</div>}
            </div>}
          </section>}
        </div>

        <aside className="pl03-aside">
          {isHost && <section className="pl03-panel pl03-invite" aria-labelledby="pl03-invite-title">
            <div className="pl03-invite-heading"><span className="pl03-eyebrow">CONVITE LAN</span>
              <ShieldCheck size={22} aria-hidden="true" /></div>
            <h2 id="pl03-invite-title">Chama a <em>galera.</em></h2>
            <p>Compartilhe estes seis números. Todo mundo no mesmo Wi-Fi encontra e entra rapidinho.</p>
            {roomCode && <div className="pl03-short-code-host">
              <small>CÓDIGO PARA ENTRAR</small><strong aria-label={`Código da sala ${roomCode}`}>{roomCode}</strong>
              <span>Seis números, sem copiar convite grande</span>
            </div>}
            {inviteQr && <div className="pl03-qr"><img src={inviteQr} alt="QR de convite da sala" width="216" height="216" /></div>}
            {code && <details className="pl03-manual">
              <summary>Verificação adicional para entrada por QR</summary>
              <div className="pl03-code"><small>CÓDIGO DE SEGURANÇA DO QR</small><strong>{code}</strong></div>
            </details>}
            {hostIp && <span className="pl03-address">Rede local: {hostIp}</span>}
            <details className="pl03-manual"><summary><QrCode size={16} /> Convite para digitar</summary>
              <label htmlFor="pl03-invite-text">Texto completo do convite</label>
              <textarea id="pl03-invite-text" readOnly value={inviteText || ''} rows={3} />
              <button type="button" onClick={() => void copyInvite()} className="pl03-secondary-btn">
                <Copy size={16} aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar convite'}</button></details>
            <button type="button" className="pl03-quiet-btn" onClick={() => void onRefreshInvite()} disabled={busy || !connected}>
              <RotateCw size={16} aria-hidden="true" /> Renovar convite</button>
          </section>}
          <section className="pl03-panel pl03-side-note">
            <Sparkles size={25} aria-hidden="true" />
            <span className="pl03-eyebrow">É MELHOR JUNTO</span>
            <h2>Uma sala.<br /><em>Mil resenhas.</em></h2>
            <p>Sem conta, sem matchmaking e sem internet obrigatória para a rede local.</p>
            <div><Check size={14} aria-hidden="true" /> Sala contínua entre rodadas</div>
            <div><Check size={14} aria-hidden="true" /> Cada um no próprio celular</div>
          </section>
        </aside>
      </div>

      <footer className="pl03-footer">
        <div><span>GALEROWS / LAN V2</span><small>Prova de interface • PL-03</small></div>
        {onBrowseGames && <button type="button" className="pl03-quiet-btn" onClick={() => void onBrowseGames()} disabled={busy}>
          <Gamepad2 size={17} aria-hidden="true" /> Ver jogos
        </button>}
        <button type="button" className="pl03-quiet-btn" onClick={() => setExitPrompt(true)}>
          {isHost ? 'Encerrar sala' : 'Sair da sala'} <DoorOpen size={17} aria-hidden="true" />
        </button>
        <button type="button" className="pl03-quiet-btn" onClick={() => void onReconnect()} disabled={busy || isHost} hidden={isHost || connected}>
          Reconectar <RotateCw size={16} aria-hidden="true" /></button>
      </footer>
    </div>

    {exitPrompt && <div className="pl03-modal-backdrop"><div className="pl03-dialog" role="dialog"
      aria-modal="true" aria-labelledby="pl03-exit-title">
      <button type="button" className="pl03-dismiss" aria-label="Cancelar saída" onClick={() => setExitPrompt(false)}><X size={21} /></button>
      <div className="pl03-dialog-icon"><DoorOpen size={25} aria-hidden="true" /></div>
      <h2 id="pl03-exit-title">{isHost ? 'Encerrar a sala?' : 'Sair da sala?'}</h2>
      <p>{isHost ? 'A conexão será encerrada para todos. Finalizar uma rodada não fecha a sala.'
        : 'Você sairá definitivamente e precisará de um novo convite para entrar.'}</p>
      <button type="button" className="pl03-danger-btn" disabled={busy || !connected}
        onClick={() => { setExitPrompt(false); void (isHost ? onClose() : onLeave()) }}>
        {isHost ? 'Sim, encerrar sala' : 'Sim, sair da sala'} <ArrowRight size={16} /></button>
      <button type="button" className="pl03-quiet-btn" onClick={() => setExitPrompt(false)} disabled={busy}><ArrowLeft size={16} /> Continuar na sala</button>
    </div></div>}
  </div>
}
