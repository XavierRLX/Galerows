import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Eye, EyeOff, Lock, Shield, Users } from 'lucide-react'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'

interface MayorConsultation {
  kind: 'mayor-consultation'
  roles: {playerId:string;role:RoleKey;alive:boolean}[]
  successionOrder: string[]
  actions: {killerTarget?:string;protectedTarget?:string;detectiveTarget?:string;
    investigation?:{targetId:string;result:'suspect'|'innocent'}}
}
interface Props {
  snapshot:RoomSnapshotV2
  connected:boolean
  busy:boolean
  onRoomCommand:(type:string,payload:unknown)=>void|Promise<void>
  onGameCommand:(type:string,payload:unknown)=>void|Promise<void>
  onEnd:()=>void|Promise<void>
}
const descriptions:Record<CidadeDormeLanStep,{title:string,script:string}> = {
  reveal:{title:'Distribuição dos papéis',script:'Peça para todos visualizarem e confirmarem o papel secreto.'},
  'killer-turn':{title:'A cidade dorme',script:'Todos dormem. Assassino, acorde e faça sua escolha no próprio celular.'},
  'doctor-turn':{title:'O médico acorda',script:'Assassino, durma. Médico, acorde e escolha quem proteger.'},
  'detective-turn':{title:'O detetive acorda',script:'Médico, durma. Detetive, acorde e escolha quem investigar.'},
  morning:{title:'A cidade acorda',script:'Todos acordam. Anuncie o resultado público da noite.'},
  discussion:{title:'Discussão da cidade',script:'A cidade conversa livremente. Você pode iniciar a votação quando todos terminarem.'},
  voting:{title:'Votação secreta',script:'Cada jogador vivo escolhe e confirma seu voto no próprio celular. Aguarde todos.'},
  'vote-result':{title:'Resultado da votação',script:'Anuncie o resultado e, se a partida continua, passe para a próxima noite.'},
  summary:{title:'Fim da partida',script:'Anuncie o grupo vencedor. Encerre a partida para registrar a pontuação.'},
}
const roleLabels:Record<RoleKey,string>={killer:'Assassino',traitor:'Traidor',doctor:'Médico',
  detective:'Detetive',citizen:'Cidadão',jester:'Coringa'}
const nextCommands:Partial<Record<CidadeDormeLanStep,{label:string,type:string,ready:boolean}>> = {
  reveal:{label:'Começar a noite',type:'START_NIGHT',ready:true},
  morning:{label:'Começar discussão',type:'START_DISCUSSION',ready:true},
  discussion:{label:'Abrir votação',type:'START_VOTE',ready:true},
  voting:{label:'Apurar votação',type:'RESOLVE_VOTE',ready:true},
  'vote-result':{label:'Próxima noite',type:'NEXT_NIGHT',ready:true},
}
export function CidadeDormeMayorPanel({snapshot,connected,busy,onRoomCommand,onGameCommand,onEnd}:Props) {
  const [confirming,setConfirming]=useState(false)
  const [showScript,setShowScript]=useState(false)
  const [viewing,setViewing]=useState(false)
  const viewingRef=useRef(false)
  const consultationOpenedAt=useRef(0)
  const game=snapshot.gamePublicState
  const sessionId=snapshot.roomState.currentGameSessionId
  const pub=game?.gameId==='cidade-dorme' && game.gameSessionId===sessionId
    ? game.data as CidadeDormeLanPublic : null
  const privateFrame=snapshot.privateState
  const confidential=connected && privateFrame?.gameId==='cidade-dorme'
    && privateFrame.gameSessionId===sessionId
    && (privateFrame.data as {kind?:string})?.kind==='mayor-consultation'
    ? privateFrame.data as MayorConsultation:null
  const hide=useCallback(()=>{
    setViewing(false)
    setConfirming(false)
    if(viewingRef.current) {
      viewingRef.current=false
      if(connected)void onRoomCommand('CLOSE_MAYOR_SECRETS',null)
    }
  },[connected,onRoomCommand])
  useEffect(()=>{
    const onBlur=()=>{if(viewingRef.current)hide()}
    const onVisibility=()=>{if(document.visibilityState==='hidden')hide()}
    const onAndroidBack=(e:Event)=>{if(viewingRef.current){e.preventDefault();hide()}}
    window.addEventListener('blur',onBlur)
    window.addEventListener('galerows:back',onAndroidBack)
    document.addEventListener('visibilitychange',onVisibility)
    return ()=>{window.removeEventListener('blur',onBlur)
      window.removeEventListener('galerows:back',onAndroidBack)
      document.removeEventListener('visibilitychange',onVisibility)}
  },[hide])
  useEffect(()=>{
    if (!viewing) return
    const remaining=Math.max(0,30_000-(Date.now()-consultationOpenedAt.current))
    const timeout=window.setTimeout(hide,remaining)
    return ()=>window.clearTimeout(timeout)
  },[viewing,connected,sessionId,hide])
  if(!pub) return null
  const item=descriptions[pub.step]
  const name=(id:string)=>snapshot.roomState.members.find(m=>m.playerId===id)?.displayName||id
  const progress=pub.step==='reveal'
    ? `${pub.seenCount} de ${pub.totalPlayers} jogadores visualizaram o papel.`
    :pub.step==='voting'
      ? `${pub.votedCount} de ${pub.eligibleVoters} votos registrados.`
      : ['killer-turn','doctor-turn','detective-turn'].includes(pub.step)
        ? 'Aguarde a ação secreta do participante autorizado.'
        : 'Acompanhe a fase e conduza a narração.'
  const next=nextCommands[pub.step]
  const canContinue=pub.step==='reveal'?pub.seenCount===pub.totalPlayers
    :pub.step==='voting'?pub.votedCount===pub.eligibleVoters:true
  return <section className="pl03-cidade-mayor" aria-label="Painel do Prefeito">
    <header className="pl03-impostor-head">
      <span className="pl03-eyebrow"><BookOpen size={15}/> PREFEITO — CONDUÇÃO HUMANA</span>
      <h3>Prefeito da cidade</h3>
      <p>Rodada {pub.round} · {pub.players.filter(p=>p.alive).length} jogadores vivos.</p>
    </header>
    <div className="pl03-impostor-step">
      <h4>{item.title}</h4>
      <p>{item.script}</p>
      <p role="status">{progress}</p>
      <button type="button" className="pl03-secondary-btn" onClick={()=>setShowScript(true)}>Repetir instrução</button>
      <p><Users size={16} aria-hidden="true"/> {snapshot.roomState.members.filter(m=>m.connected&&m.role==='guest').length} jogadores conectados.</p>
      <button type="button" className="pl03-secondary-btn" disabled={busy||!connected||pub.step==='summary'}
        onClick={()=>void onGameCommand(pub.paused?'RESUME_CITY':'PAUSE_CITY',null)}>
        {pub.paused?'Retomar partida':'Pausar partida'}</button>
      {pub.paused && <p role="status">Partida pausada. Os jogadores não podem enviar ações.</p>}
      {next && <button type="button" className="pl03-primary-btn"
        disabled={busy||!connected||!canContinue||Boolean(pub.paused)}
        onClick={()=>void onGameCommand(next.type,null)}>{next.label}</button>}
      {pub.step==='summary' && <button type="button" className="pl03-primary-btn"
        disabled={busy||!connected} onClick={()=>void onEnd()}>Finalizar e pontuar</button>}
    </div>
    <div className="pl03-impostor-step">
      <p><Lock size={16} aria-hidden="true"/> As identidades permanecem secretas até você abrir uma consulta privada.</p>
      <button type="button" className="pl03-secondary-btn" disabled={!connected||busy}
        onClick={()=>setConfirming(true)}><Eye size={18}/> Consultar papéis e ações</button>
    </div>
    {showScript && <div className="pl03-modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Roteiro da fase"
        className="pl03-panel" style={{maxWidth:460,width:'100%',margin:'auto'}}>
        <h3>{item.title}</h3>
        <p style={{fontSize:19,lineHeight:1.7}}>{item.script}</p>
        <p>Leia a instrução para os participantes. A narração por áudio ainda não está ativa.</p>
        <button type="button" className="pl03-primary-btn" onClick={()=>setShowScript(false)}>Voltar ao painel</button>
      </section>
    </div>}
    {connected && confirming && <div className="pl03-modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Confirmar consulta confidencial"
        className="pl03-panel" style={{maxWidth:460,width:'100%',margin:'auto'}}>
        <h3><Shield size={18}/> Consulta confidencial</h3>
        <p>Confirme que ninguém está olhando a tela. Você verá todos os papéis e ações em andamento.</p>
        <button type="button" className="pl03-primary-btn" onClick={()=>{
          setConfirming(false);setViewing(true);viewingRef.current=true
          consultationOpenedAt.current=Date.now()
          void onRoomCommand('OPEN_MAYOR_SECRETS',null)
        }}>Estou em um local privado</button>
        <button type="button" className="pl03-secondary-btn" onClick={()=>setConfirming(false)}>Cancelar</button>
      </section>
    </div>}
    {connected && viewing && <div className="pl03-modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Consulta confidencial do prefeito"
        className="pl03-panel pl03-mayor-confidential" style={{maxHeight:'85dvh',overflowY:'auto',maxWidth:480,width:'100%',margin:'auto'}}>
        <h3><EyeOff size={19}/> Consulta confidencial</h3>
        <p>Não mostre esta tela aos jogadores. Ela se fecha quando o aplicativo perde o foco.</p>
        {confidential
          ? <><h4>Papéis dos jogadores</h4>
            <ul>{confidential.roles.map(p=><li key={p.playerId}>{name(p.playerId)} — <strong>{roleLabels[p.role]}</strong> ({p.alive?'vivo':'eliminado'})</li>)}</ul>
            <h4>Ordem da equipe assassina</h4>
            <p>{confidential.successionOrder.map(name).join(' → ') || 'Sem equipe'}</p>
            <h4>Ações da noite</h4>
            <p>{confidential.actions.killerTarget ? `Alvo da noite: ${name(confidential.actions.killerTarget)}`
              :'Alvo da noite: ainda não escolhido'}</p>
            <p>{confidential.actions.protectedTarget
              ? `Proteção: ${name(confidential.actions.protectedTarget)}`:'Proteção: ainda não escolhida'}</p>
            <p>{confidential.actions.detectiveTarget
              ? `Investigação: ${name(confidential.actions.detectiveTarget)}`:'Investigação: ainda não escolhida'}</p>
            {confidential.actions.investigation && <p>Resultado confidencial: {confidential.actions.investigation.result==='suspect'?'Suspeito':'Inocente'}</p>}
          </> : <p>Obtendo consulta autorizada do anfitrião...</p>}
        <button type="button" className="pl03-primary-btn" onClick={hide}>Fechar consulta</button>
      </section>
    </div>}
  </section>
}
