import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Moon, Shield, Skull, Sun, Trophy, Users, Vote, WifiOff } from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPrivate, CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'

type Props = {
  snapshot: RoomSnapshotV2
  playerId: string
  isHost: boolean
  busy: boolean
  connected: boolean
  onAction: (type: string, payload: unknown) => void | Promise<void>
  onEnd: () => void | Promise<void>
}
const roleLabels: Record<RoleKey, string> = {
  killer: 'Assassino', traitor: 'Traidor', doctor: 'Médico', detective: 'Detetive',
  citizen: 'Cidadão', jester: 'Coringa',
}
const titleFor: Record<CidadeDormeLanStep, string> = {
  reveal: 'Descubra seu papel', 'killer-turn': 'A cidade adormeceu',
  'doctor-turn': 'A noite continua', 'detective-turn': 'O mistério aumenta',
  morning: 'A cidade acordou', discussion: 'Hora da discussão',
  voting: 'Votação da galera', 'vote-result': 'Resultado da votação', summary: 'Fim de partida',
}
/** Keyed by game identity, turn and connectivity to avoid keeping a role visible across a transition. */
export function CidadeDormeLanRound(props: Props) {
  const game = props.snapshot.gamePublicState
  const data = game?.gameId === 'cidade-dorme' ? game.data as CidadeDormeLanPublic : null
  const key = `${props.snapshot.roomState.currentGameSessionId}:${data?.round}:${data?.step}:${props.connected}`
  return <CidadeDormeLanBody {...props} key={key} />
}
function CidadeDormeLanBody({ snapshot, playerId, isHost, busy, connected, onAction, onEnd }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  useEffect(() => {
    const hide = () => setRevealed(false)
    const onVisibility = () => { if (document.visibilityState === 'hidden') hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  const game = snapshot.gamePublicState
  const sessionId = snapshot.roomState.currentGameSessionId
  if (!sessionId || game?.gameId !== 'cidade-dorme' || game.gameSessionId !== sessionId) return null
  const data = game.data as CidadeDormeLanPublic
  const personalFrame = snapshot.privateState
  const mine = connected && personalFrame?.gameSessionId === sessionId
    && personalFrame.gameId === 'cidade-dorme'
    ? personalFrame.data as CidadeDormeLanPrivate : null
  const blocked = busy || !connected || sent
  const hostBlocked = busy || !connected
  const label = (id: string) => {
    const index = snapshot.roomState.members.findIndex(member => member.playerId === id)
    const member = snapshot.roomState.members[index]
    return member?.displayName || (id === snapshot.roomState.hostPlayerId
      ? 'Anfitrião' : `Jogador ${index + 1}`)
  }
  const alive = data.players.filter(player => player.alive)
  const correctRole = data.step === 'killer-turn' ? (mine?.activeKiller ?? (mine?.role === 'killer'))
    : data.step === 'doctor-turn' ? mine?.role === 'doctor'
      : data.step === 'detective-turn' ? mine?.role === 'detective' : data.step === 'voting'
  const canPick = Boolean(mine?.canAct && correctRole) && !blocked
  const options = alive.filter(player => {
    if (!mine) return false
    if (data.step === 'killer-turn' && (player.id === playerId || mine.killerTeammates?.includes(player.id))) return false
    if (data.step === 'doctor-turn' && player.id === playerId) return false
    if (data.step === 'detective-turn' && player.id === playerId) return false
    return true
  })
  const privateAction = data.step === 'killer-turn' ? { verb: 'Escolher vítima', type: 'KILL' }
    : data.step === 'doctor-turn' ? { verb: 'Proteger pessoa', type: 'PROTECT' }
      : data.step === 'detective-turn' ? { verb: 'Investigar pessoa', type: 'INVESTIGATE' }
        : { verb: 'Confirmar meu voto', type: 'CAST_VOTE' }
  const submit = () => {
    if (!targetId || !canPick) return
    setTargetId(null)
    setRevealed(false)
    setSent(true)
    void onAction(privateAction.type, { playerId: targetId })
  }
  return <section className="pl03-cidade-round" aria-label="Cidade Dorme LAN">
    <div className="pl03-impostor-head">
      <span className="pl03-eyebrow">CIDADE DORME / MULTIPLAYER LOCAL</span>
      <h3>{titleFor[data.step]}</h3>
      <p>Rodada {data.round} · {alive.length} de {data.players.length} jogadores vivos.</p>
    </div>
    {!connected && <p className="pl03-pista-alert" role="status"><WifiOff size={16}/> Conexão interrompida. Aguarde a reconexão.</p>}
    {mine && data.step !== 'summary' && <div className="pl03-cidade-secret">
      <div className="pl03-impostor-help"><LockKeyhole size={17}/> Seu papel pertence apenas a este celular.</div>
      {revealed && <div className="pl03-impostor-private" data-testid="cidade-private-role">
        <small>SEU PAPEL</small><strong>{roleLabels[mine.role]}</strong>
        {mine.killerTeammates && mine.killerTeammates.length > 0 &&
          <p>Outros assassinos: {mine.killerTeammates.map(label).join(', ')}</p>}
        {mine.investigation && <p>Investigação: {label(mine.investigation.targetId)} —
          <b>{mine.investigation.result === 'suspect' ? 'Suspeito' : 'Inocente'}</b></p>}
      </div>}
      <button type="button" className="pl03-secondary-btn" disabled={blocked}
        onClick={() => setRevealed(value => !value)}>
        {revealed ? <EyeOff size={17}/> : <Eye size={17}/>}
        {revealed ? 'Ocultar meu papel' : 'Ver meu papel'}
      </button>
    </div>}
    {data.step === 'reveal' && <div className="pl03-impostor-step">
      <Moon size={29} aria-hidden="true"/><strong>Cada participante recebe um papel secreto.</strong>
      <p>{data.seenCount} de {data.totalPlayers} jogadores confirmaram o papel.</p>
      {mine && !mine.acknowledged
        ? <button className="pl03-primary-btn" type="button" disabled={blocked || !revealed}
          onClick={() => { setRevealed(false); setSent(true); void onAction('ACK_ROLE', null) }}>
          Confirmar meu papel</button>
        : <p className="pl03-configured">Papel confirmado. Espere a galera.</p>}
      {isHost && <button type="button" className="pl03-secondary-btn"
        disabled={hostBlocked || data.seenCount !== data.totalPlayers}
        onClick={() => void onAction('START_NIGHT',null)}>Todos prontos · Começar a noite</button>}
    </div>}
    {['killer-turn','doctor-turn','detective-turn'].includes(data.step) && <div className="pl03-impostor-step">
      <Moon size={29} aria-hidden="true"/>
      <strong>{data.step === 'killer-turn' ? 'A ação dos assassinos' :
        data.step === 'doctor-turn' ? 'A proteção do médico' : 'A investigação do detetive'}</strong>
      <p>O jogador responsável escolhe em segredo no próprio celular. A galera aguarda.</p>
      {canPick && <div className="pl03-cidade-selector">
        {options.map(player => <button key={player.id} type="button"
          aria-label={`Selecionar ${label(player.id)}`}
          aria-pressed={targetId === player.id}
          className={targetId === player.id ? 'is-selected' : ''}
          onClick={() => setTargetId(player.id)}>{label(player.id)}</button>)}
        <button type="button" className="pl03-primary-btn" disabled={!targetId}
          onClick={submit}>{privateAction.verb}</button>
      </div>}
    </div>}
    {data.step === 'morning' && <div className="pl03-impostor-step">
      <Sun size={30} aria-hidden="true"/>
      <strong>{data.nightResult?.eliminatedId
        ? `${label(data.nightResult.eliminatedId)} não resistiu à noite.`
        : 'Ninguém foi eliminado nesta noite.'}</strong>
      <p>Conversem sobre o que aconteceu. Informações privadas continuam secretas.</p>
      {isHost && <button className="pl03-primary-btn" type="button" disabled={blocked}
        onClick={() => void onAction('START_DISCUSSION',null)}>Começar discussão</button>}
    </div>}
    {data.step === 'discussion' && <div className="pl03-impostor-step">
      <Users size={30} aria-hidden="true"/><strong>Descubram os assassinos.</strong>
      <p>Conversem presencialmente antes de votar. Os eliminados não participam da votação.</p>
      {isHost && <button className="pl03-primary-btn" type="button" disabled={blocked}
        onClick={() => void onAction('START_VOTE',null)}>Abrir votação</button>}
    </div>}
    {data.step === 'voting' && <div className="pl03-impostor-step">
      <Vote size={30} aria-hidden="true"/><strong>Voto secreto</strong>
      <p>{data.votedCount} de {data.eligibleVoters} votos enviados.</p>
      {mine?.voted ? <p className="pl03-configured">Seu voto foi recebido. Aguarde os demais.</p>
        : canPick && <div className="pl03-cidade-selector">
          {options.map(player => <button key={player.id} type="button"
            className={targetId === player.id ? 'is-selected' : ''}
            aria-pressed={targetId === player.id} aria-label={`Selecionar ${label(player.id)}`}
            onClick={() => setTargetId(player.id)}>{label(player.id)}</button>)}
          <button type="button" className="pl03-primary-btn" disabled={!targetId}
            onClick={submit}>Confirmar meu voto</button>
        </div>}
      {isHost && <button type="button" className="pl03-secondary-btn" disabled={hostBlocked ||
        data.votedCount !== data.eligibleVoters} onClick={() => void onAction('RESOLVE_VOTE',null)}>
        Apurar votação</button>}
    </div>}
    {data.step === 'vote-result' && <div className="pl03-impostor-step">
      <Skull size={30} aria-hidden="true"/>
      <strong>{data.voteResult?.kind === 'tie' ? 'Empate — ninguém foi eliminado.' :
        `${label(data.voteResult?.eliminatedId || '')} foi eliminado pela votação.`}</strong>
      {isHost && <button type="button" className="pl03-primary-btn" disabled={blocked}
        onClick={() => void onAction('NEXT_NIGHT',null)}>Próxima noite</button>}
    </div>}
    {data.step === 'summary' && <div className="pl03-impostor-step">
      <Trophy size={32} aria-hidden="true"/>
      <strong>{data.winner === 'city' ? 'Vitória da cidade!' :
        data.winner === 'killers' ? 'Vitória dos assassinos!' : 'Vitória do Coringa!'}</strong>
      <p>{data.winner === 'city' ? 'Todos os assassinos foram eliminados.' :
        data.winner === 'killers' ? 'Os assassinos dominaram a cidade.' :
          'O Coringa conseguiu ser eliminado pela votação.'}</p>
      {data.finalRoles && <div className="pl03-cidade-final-roles" aria-label="Papéis revelados no encerramento">
        {data.finalRoles.map(player => <p key={player.id}>{label(player.id)}: {roleLabels[player.role]}</p>)}
      </div>}
      {isHost ? <button type="button" className="pl03-primary-btn" disabled={blocked}
        onClick={() => void onEnd()}>Finalizar partida e pontuar</button>
        : <p>O anfitrião vai concluir esta partida. O placar continua na mesma sala.</p>}
    </div>}
    {data.players.some(p => !p.alive) && data.step !== 'summary' && <div className="pl03-cidade-fallen">
      <Shield size={16} aria-hidden="true"/> Eliminados: {data.players.filter(p => !p.alive)
        .map(p => label(p.id) + (p.revealedRole ? ` (${roleLabels[p.revealedRole]})` : '')).join(', ')}
    </div>}
  </section>
}
