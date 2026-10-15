/** Single shared host audio element, unlocked by the genuine Start Game touch event.
 * The remaining LAN clients receive only captions; only host calls this module. */
let player:HTMLAudioElement|null=null
let armed=false
let interrupted=false
let speechCleanup:(()=>void)|null=null
/** Offline-only supplement for dynamic public names. Without a local Portuguese
 * voice we keep the prerecorded general announcement and the named subtitle. */
function finishWithLocalPublicName(text:string|undefined,done?:()=>void){
  if(!text||typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined'){
    done?.();return
  }
  const voice=speechSynthesis.getVoices().find(v=>v.localService && v.lang.toLowerCase().startsWith('pt'))
  if(!voice){done?.();return}
  let completed=false
  const finish=()=>{
    if(completed)return
    completed=true
    window.clearTimeout(timer)
    speechCleanup=null
    done?.()
  }
  const utterance=new SpeechSynthesisUtterance(text)
  utterance.lang='pt-BR'
  utterance.voice=voice
  utterance.onend=finish
  utterance.onerror=finish
  const timer=window.setTimeout(finish,4500)
  speechCleanup=()=>{
    if(completed)return
    completed=true
    window.clearTimeout(timer)
    speechSynthesis.cancel()
    speechCleanup=null
  }
  try{speechSynthesis.speak(utterance)}catch{finish()}
}
export function isCityAutomaticNarratorArmed(){return armed}
export function isCityAutomaticNarratorInterrupted(){return interrupted}
export function armCityAutomaticNarrator(src='/assets/cidade-dorme/narracao/reveal.m4a',
  onEnded?:()=>void,publicName?:string):boolean{
  if(typeof Audio==='undefined')return false
  try {
    if(player)player.pause()
    player=new Audio(src)
    player.onended=()=>finishWithLocalPublicName(publicName,onEnded)
    player.preload='auto'
    armed=true
    interrupted=false
    const attempt=player.play()
    void attempt?.catch(()=>{armed=false})
    return true
  } catch {
    armed=false
    return false
  }
}
export function observeCityAutomaticNarration(onEnded:()=>void){
  if(player)player.onended=onEnded
}
export function playCityAutomaticNarration(src:string,onEnded?:()=>void,publicName?:string):boolean{
  if(!armed||!player)return false
  try {
    player.pause()
    player.currentTime=0
    player.src=src
    player.onended=()=>finishWithLocalPublicName(publicName,onEnded)
    void player.play().catch(()=>{armed=false})
    return true
  }catch{armed=false;return false}
}
export function interruptCityAutomaticNarrator(){
  if(!armed)return
  stopCityAutomaticNarrator()
  armed=false
  interrupted=true
}
export function stopCityAutomaticNarrator(){
  if(speechCleanup){const close=speechCleanup;speechCleanup=null;close()}
  if(player){player.pause();player.currentTime=0;player.onended=null}
}
export function resetCityAutomaticNarratorForTests(){
  stopCityAutomaticNarrator()
  player=null
  armed=false
  interrupted=false
}
