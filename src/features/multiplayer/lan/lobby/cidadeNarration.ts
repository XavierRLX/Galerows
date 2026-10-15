import type { CidadeDormeLanStep } from '../../cidadeDormeLanGame'

/** These pre-recorded clips are shipped in /public. No TTS/network call runs on players' phones. */
const texts: Record<CidadeDormeLanStep,string> = {
  reveal:'A cidade está pronta. Descubram seus papéis em segredo.',
  'killer-turn':'A cidade dorme. Todos fecham os olhos. Assassino, acorde e escolha a sua vítima.',
  'doctor-turn':'Assassino, volte a dormir. Médico, acorde e escolha quem deseja proteger.',
  'detective-turn':'Médico, volte a dormir. Detetive, acorde e investigue uma pessoa.',
  morning:'A cidade acorda. Abram os olhos. A noite terminou.',
  discussion:'A cidade desperta para o mistério. Conversem e descubram quem pode ser o assassino.',
  voting:'A discussão acabou. É hora de votar. Cada jogador escolhe uma pessoa em segredo.',
  'vote-result':'Os votos foram apurados. A cidade conhece o resultado.',
  summary:'O jogo terminou. A cidade revela seus segredos.',
}
export function getCityNarrationSubtitle(step:CidadeDormeLanStep):string {return texts[step]}
export function getCityNarrationCue(step:CidadeDormeLanStep):string {
  return '/assets/cidade-dorme/narracao/'+step+'.m4a'
}
export interface CityNarrationFrame {
  eventId:string
  step:CidadeDormeLanStep
  sessionId:string
  connected:boolean
  narratorHost:boolean
  mayor:boolean
  paused:boolean
  visible:boolean
}
/** Pure gate. One cue per canonical phase, never queue stale cues on reconnection or remount. */
export function createCityNarrationGate() {
  let enabled=false
  let lastPlayedKey=''
  let lastKey=''
  let lastSession=''
  const canPlay=(f:CityNarrationFrame)=> f.narratorHost && !f.mayor && f.connected
    && !f.paused && f.visible && Boolean(f.eventId) && Boolean(f.sessionId)
  const key=(f:CityNarrationFrame)=>f.sessionId+':'+f.eventId
  return {
    activate(f:CityNarrationFrame) {
      if(!canPlay(f))return false
      enabled=true
      const now=key(f)
      if(lastPlayedKey===now)return false
      lastPlayedKey=now
      lastKey=now
      lastSession=f.sessionId
      return true
    },
    observe(f:CityNarrationFrame) {
      const now=key(f)
      if(now===lastKey)return false
      const changedSession=lastSession!=='' && lastSession!==f.sessionId
      lastSession=f.sessionId
      lastKey=now
      const play=enabled && !changedSession && canPlay(f)
      if(play)lastPlayedKey=now
      return play
    },
  }
}
