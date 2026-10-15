import type { CidadeDormeLanPublic, CidadeDormeLanStep } from '../../cidadeDormeLanGame'

/** These pre-recorded clips are shipped in /public. No TTS/network call runs on players' phones. */
const texts: Record<CidadeDormeLanStep,string> = {
  reveal:'A partida começou. Confira seu papel em segredo e confirme quando estiver pronto.',
  'killer-turn':'A cidade adormece. Todos fechem os olhos. Assassino, acorde. Escolha sua vítima em segredo.',
  'doctor-turn':'Sua escolha foi registrada. Agora, volte a dormir. Médico, acorde. Escolha uma pessoa para proteger esta noite.',
  'detective-turn':'Sua escolha foi registrada. Agora, volte a dormir. Detetive, acorde. Escolha uma pessoa para investigar.',
  'detective-result':'Detetive, confira o resultado no seu celular. Confirme quando terminar.',
  morning:'A noite terminou. A cidade acorda. Todos podem abrir os olhos.',
  discussion:'Hora de discutir. Conversem, compartilhem suas suspeitas e tentem descobrir o assassino.',
  voting:'A discussão terminou. Escolha em segredo quem você acredita ser o assassino.',
  'vote-result':'A votação terminou. Confira o resultado.',
  summary:'A partida chegou ao fim. Descubram os papéis e vejam quem venceu.',
}
type Outcome=Partial<Pick<CidadeDormeLanPublic,'nightResult'|'voteResult'>>
export function getCityNarrationSubtitle(step:CidadeDormeLanStep,outcome?:Outcome,
  name:(id:string)=>string=id=>id):string {
  if(step==='morning' && outcome?.nightResult){
    return outcome.nightResult.eliminatedId
      ? 'A noite terminou. A cidade acorda. Todos podem abrir os olhos. '+name(outcome.nightResult.eliminatedId)+' morreu durante a noite.'
      : 'A noite terminou. A cidade acorda. Todos podem abrir os olhos. Todos sobreviveram. Ninguém morreu esta noite.'
  }
  if(step==='vote-result' && outcome?.voteResult){
    return outcome.voteResult.kind==='tie'?'Houve empate na votação. Ninguém foi eliminado.':
      'A votação terminou. '+name(outcome.voteResult.eliminatedId??'')+' foi eliminado.'
  }
  return texts[step]
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
    isEnabled:()=>enabled,
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
