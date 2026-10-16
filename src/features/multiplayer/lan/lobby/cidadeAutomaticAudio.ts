/** One host audio element. The Start Game gesture unlocks local prerecorded speech.
 * The game never invokes network TTS or the Android/macOS system narrator. */
let player:HTMLAudioElement|null=null
let armed=false
let interrupted=false
let revision=0
// A new user-gesture arm owns a new playback generation; stale scenes must not stop it.
let armGeneration=0
const defaultCue='/assets/cidade-dorme/narracao-lucas/01_identidade.mp3'

export function isCityAutomaticNarratorArmed(){return armed}
export function isCityAutomaticNarratorInterrupted(){return interrupted}
export function getCityAutomaticNarratorGeneration(){return armGeneration}
/** A scene may stop only the narrator generation that it mounted with. */
export function stopCityAutomaticNarrator(expectedGeneration?:number){
  if(expectedGeneration!==undefined && expectedGeneration!==armGeneration)return
  revision++
  if(player){player.pause();player.currentTime=0;player.onended=null}
}
function markInterrupted(expectedRevision:number,onError?:()=>void){
  if(revision!==expectedRevision)return
  stopCityAutomaticNarrator()
  armed=false
  interrupted=true
  onError?.()
}
function begin(sources:string[],onEnded?:()=>void,onError?:()=>void):boolean{
  if(!player || !sources.length)return false
  stopCityAutomaticNarrator()
  const current=revision
  let index=0
  const advance=()=>{
    if(current!==revision || !armed || !player)return
    index++
    if(index===sources.length){onEnded?.();return}
    playCurrent()
  }
  const playCurrent=()=>{
    if(current!==revision || !armed || !player)return
    try{
      player.src=sources[index]
      player.onended=advance
      const attempt=player.play()
      void attempt?.catch(()=>markInterrupted(current,onError))
    }catch{markInterrupted(current,onError)}
  }
  playCurrent()
  return armed
}
/** Must be called synchronously inside a genuine host tap gesture. */
export function armCityAutomaticNarrator(src:string|string[]=defaultCue,
  onEnded?:()=>void):boolean{
  if(typeof Audio==='undefined')return false
  const sources=Array.isArray(src)?src:[src]
  if(!sources.length)return false
  stopCityAutomaticNarrator()
  try{
    player=new Audio(sources[0])
    armGeneration++
    player.preload='auto'
    armed=true
    interrupted=false
    return begin(sources,onEnded)
  }catch{
    armed=false
    interrupted=true
    return false
  }
}
/** Used by the initial Start Game cue, which begins before the route mounts. */
export function observeCityAutomaticNarration(onEnded:()=>void){
  if(player && armed)player.onended=onEnded
}
export function playCityAutomaticNarration(src:string|string[],onEnded?:()=>void,
  _publicName?:string,onError?:()=>void):boolean{
  if(!armed || !player)return false
  return begin(Array.isArray(src)?src:[src],onEnded,onError)
}
export function interruptCityAutomaticNarrator(){
  if(!armed && !interrupted)return
  stopCityAutomaticNarrator()
  armed=false
  interrupted=true
}
export function resetCityAutomaticNarratorForTests(){
  stopCityAutomaticNarrator()
  player=null
  armGeneration++
  armed=false
  interrupted=false
}
