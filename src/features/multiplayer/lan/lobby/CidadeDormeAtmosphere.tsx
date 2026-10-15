import { useCallback, useEffect, useRef, useState } from 'react'
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import type { CidadeDormeLanStep } from '../../cidadeDormeLanGame'
import { createCityNarrationGate, getCityNarrationCue, getCityNarrationSubtitle } from './cidadeNarration'
import type { CityNarrationFrame } from './cidadeNarration'

interface Props {
  step:CidadeDormeLanStep
  sessionId:string
  phaseEventId:string
  host:boolean
  mayorMode:boolean
  connected:boolean
  paused:boolean
}
const nightPhases:CidadeDormeLanStep[]=['killer-turn','doctor-turn','detective-turn']
const isNight=(step:CidadeDormeLanStep)=>nightPhases.includes(step)
function getTime(step:CidadeDormeLanStep) {
  if(isNight(step))return 'night'
  if(step==='morning'||step==='reveal')return 'dawn'
  return 'day'
}
/** Visible on all phones; only the automatic-mode host can opt into playing the bundled files. */
export function CidadeDormeAtmosphere({step,sessionId,phaseEventId,host,mayorMode,connected,paused}:Props){
  const [audioEnabled,setAudioEnabled]=useState(false)
  const [audioError,setAudioError]=useState(false)
  const gate=useRef(createCityNarrationGate())
  const audioRef=useRef<HTMLAudioElement|null>(null)
  const stop=useCallback(()=>{
    const audio=audioRef.current
    if(audio){audio.pause();audio.currentTime=0;audioRef.current=null}
  },[])
  const playCue=useCallback((phase:CidadeDormeLanStep)=>{
    stop()
    if(typeof Audio==='undefined'){setAudioError(true);return}
    const player=new Audio(getCityNarrationCue(phase))
    audioRef.current=player
    void player.play().catch(()=>{if(audioRef.current===player)setAudioError(true)})
  },[stop])
  const frame:CityNarrationFrame={eventId:phaseEventId,sessionId,step,
    narratorHost:host,mayor:mayorMode,connected,paused,
    visible:typeof document!=='undefined'&&document.visibilityState!=='hidden'}
  useEffect(()=>{
    const current:CityNarrationFrame={eventId:phaseEventId,sessionId,step,
      narratorHost:host,mayor:mayorMode,connected,paused,
      visible:document.visibilityState!=='hidden'}
    const shouldPlay=gate.current.observe(current)
    if(!connected || paused || !host || mayorMode)stop()
    else if(shouldPlay)playCue(step)
    return undefined
  },[phaseEventId,sessionId,step,connected,paused,host,mayorMode,playCue,stop])
  useEffect(()=>{
    const onHidden=()=>{if(document.visibilityState==='hidden')stop()}
    const onBlur=()=>stop()
    window.addEventListener('blur',onBlur)
    document.addEventListener('visibilitychange',onHidden)
    return ()=>{window.removeEventListener('blur',onBlur)
      document.removeEventListener('visibilitychange',onHidden)
      stop()}
  },[stop])
  const activate=()=>{
    setAudioError(false)
    if(gate.current.activate(frame)){
      playCue(step)
      setAudioEnabled(true)
    }
  }
  const time=getTime(step)
  return <div className="pl03-cidade-atmosphere" data-testid="city-ambience" data-time={time}>
    <span className="pl03-cidade-atmosphere-icon" aria-hidden="true">
      {time==='night'?<Moon size={26}/>:<Sun size={26}/>}
    </span>
    <div className="pl03-cidade-atmosphere-caption">
      <span className="pl03-eyebrow">{time==='night'?'NOITE NA CIDADE':'A CIDADE DESPERTA'}</span>
      <p role="status" aria-live="polite">{getCityNarrationSubtitle(step)}</p>
    </div>
    {host && !mayorMode && <div className="pl03-cidade-speaker">
      {!audioEnabled
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
