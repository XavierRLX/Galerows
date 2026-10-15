import { useCallback, useEffect, useRef, useState } from 'react'
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import type { CidadeDormeLanStep, CidadeDormeLanPublic } from '../../cidadeDormeLanGame'
import { createCityNarrationGate, getCityNarrationCue, getCityNarrationSubtitle } from './cidadeNarration'
import type { CityNarrationFrame } from './cidadeNarration'
import {armCityAutomaticNarrator,isCityAutomaticNarratorArmed,isCityAutomaticNarratorInterrupted,
  interruptCityAutomaticNarrator,observeCityAutomaticNarration,playCityAutomaticNarration,stopCityAutomaticNarrator} from './cidadeAutomaticAudio'

interface Props {
  step:CidadeDormeLanStep
  sessionId:string
  phaseEventId:string
  host:boolean
  mayorMode:boolean
  connected:boolean
  paused:boolean
  narrationGate?: ReturnType<typeof createCityNarrationGate>
  narratorEnabled?: boolean
  onNarratorEnabled?: () => void
  autoMode?:boolean
  publicState?:CidadeDormeLanPublic
  nameOf?:(id:string)=>string
  onNarrationDone?:(eventId:string)=>void
}
const nightPhases:CidadeDormeLanStep[]=['killer-turn','doctor-turn','detective-turn','detective-result']
const isNight=(step:CidadeDormeLanStep)=>nightPhases.includes(step)
function getTime(step:CidadeDormeLanStep) {
  if(isNight(step))return 'night'
  if(step==='morning'||step==='reveal')return 'dawn'
  return 'day'
}
/** Visible on all phones; only the automatic-mode host can opt into playing the bundled files. */
export function CidadeDormeAtmosphere({step,sessionId,phaseEventId,host,mayorMode,connected,paused,
  narrationGate,narratorEnabled=false,onNarratorEnabled,autoMode=false,publicState,nameOf,onNarrationDone}:Props){
  const [audioEnabled,setAudioEnabled]=useState(false)
  const [audioInterrupted,setAudioInterrupted]=useState(false)
  const [audioError,setAudioError]=useState(false)
  const gate=useRef(narrationGate ?? createCityNarrationGate())
  const audioRef=useRef<HTMLAudioElement|null>(null)
  const stop=useCallback(()=>{
    const audio=audioRef.current
    if(audio){audio.pause();audio.currentTime=0;audioRef.current=null}
    if(autoMode)stopCityAutomaticNarrator()
  },[autoMode])
  const publicNameFor=useCallback((phase:CidadeDormeLanStep)=>{
    return phase==='morning' && publicState?.nightResult?.eliminatedId
      ? (nameOf?.(publicState.nightResult.eliminatedId) ?? '')+' morreu.'
      : phase==='vote-result' && publicState?.voteResult?.kind==='eliminated'
        ? (nameOf?.(publicState.voteResult.eliminatedId ?? '') ?? '')+' foi eliminado.'
        : undefined
  },[publicState,nameOf])
  const playCue=useCallback((phase:CidadeDormeLanStep)=>{
    stop()
    if(typeof Audio==='undefined'){setAudioError(true);return}
    if(autoMode && isCityAutomaticNarratorArmed()){
      if(!playCityAutomaticNarration(getCityNarrationCue(phase,publicState),
        ()=>onNarrationDone?.(phaseEventId),publicNameFor(phase)))setAudioError(true)
      return
    }
    const player=new Audio(getCityNarrationCue(phase,publicState))
    audioRef.current=player
    void player.play().catch(()=>{if(audioRef.current===player)setAudioError(true)})
  },[stop,autoMode,publicState,phaseEventId,onNarrationDone,publicNameFor])
  const frame:CityNarrationFrame={eventId:phaseEventId,sessionId,step,
    narratorHost:host,mayor:mayorMode,connected,paused,
    visible:typeof document!=='undefined'&&document.visibilityState!=='hidden'}
  useEffect(()=>{
    const current:CityNarrationFrame={eventId:phaseEventId,sessionId,step,
      narratorHost:host,mayor:mayorMode,connected,paused,
      visible:document.visibilityState!=='hidden'}
    if(autoMode && host && !mayorMode && isCityAutomaticNarratorArmed()
      && !gate.current.isEnabled()){
      gate.current.activate(current)
      observeCityAutomaticNarration(()=>onNarrationDone?.(phaseEventId))
    }
    const shouldPlay=gate.current.observe(current)
    if(!connected || paused || !host || mayorMode){
      if(autoMode && host && (!connected || paused))interruptCityAutomaticNarrator()
      else stop()
    }
    else if(shouldPlay)playCue(step)
    return undefined
  },[phaseEventId,sessionId,step,connected,paused,host,mayorMode,autoMode,playCue,stop,onNarrationDone])
  useEffect(()=>{
    const onHidden=()=>{if(document.visibilityState==='hidden'){
      if(autoMode&&host){
        const previouslyRunning=isCityAutomaticNarratorArmed()||isCityAutomaticNarratorInterrupted()
        interruptCityAutomaticNarrator()
        if(previouslyRunning){setAudioEnabled(false);setAudioInterrupted(true)}
      }
      else stop()
    }}
    const onBlur=()=>{
      if(autoMode&&host){
        const previouslyRunning=isCityAutomaticNarratorArmed()||isCityAutomaticNarratorInterrupted()
        interruptCityAutomaticNarrator()
        if(previouslyRunning){setAudioEnabled(false);setAudioInterrupted(true)}
      }
      else stop()
    }
    window.addEventListener('blur',onBlur)
    document.addEventListener('visibilitychange',onHidden)
    return ()=>{window.removeEventListener('blur',onBlur)
      document.removeEventListener('visibilitychange',onHidden)
      stop()}
  },[stop,autoMode,host])
  const activate=()=>{
    setAudioError(false)
    if(autoMode){
      const started=armCityAutomaticNarrator(getCityNarrationCue(step,publicState),
        ()=>onNarrationDone?.(phaseEventId),publicNameFor(step))
      if(started){
        setAudioInterrupted(false)
        gate.current.activate(frame)
        setAudioEnabled(true)
        onNarratorEnabled?.()
      }else setAudioError(true)
      return
    }
    if(gate.current.activate(frame)){
      playCue(step)
      setAudioEnabled(true)
      onNarratorEnabled?.()
    }
  }
  const time=getTime(step)
  return <div className="pl03-cidade-atmosphere" data-testid="city-ambience" data-time={time}>
    <span className="pl03-cidade-atmosphere-icon" aria-hidden="true">
      {time==='night'?<Moon size={26}/>:<Sun size={26}/>}
    </span>
    <div className="pl03-cidade-atmosphere-caption">
      <span className="pl03-eyebrow">{time==='night'?'NOITE NA CIDADE':'A CIDADE DESPERTA'}</span>
      <p role="status" aria-live="polite">{getCityNarrationSubtitle(step,publicState,nameOf)}</p>
    </div>
    {host && !mayorMode && <div className="pl03-cidade-speaker">
      {autoMode && isCityAutomaticNarratorArmed()
        ? <span className="pl03-cidade-narration-enabled"><Volume2 size={16}/> Narração automática ativa</span>
        : autoMode && (audioInterrupted || isCityAutomaticNarratorInterrupted())
        ? <button type="button" className="pl03-secondary-btn" onClick={activate}
            disabled={!connected||paused}>
            <Volume2 size={16} aria-hidden="true"/> Retomar narração
          </button>
        : !(audioEnabled || narratorEnabled)
        ? <button type="button" className="pl03-secondary-btn" onClick={activate}
            disabled={!connected||paused}>
            <Volume2 size={16} aria-hidden="true"/> Ativar narração no anfitrião
          </button>
        : <span className="pl03-cidade-narration-enabled"><Volume2 size={16}/>
            Narração ligada apenas neste aparelho</span>}
      {audioError && <p className="pl03-pista-alert" role="status">
        <VolumeX size={16}/> Áudio indisponível neste aparelho. Acompanhe as legendas.
      </p>}
    </div>}
  </div>
}
