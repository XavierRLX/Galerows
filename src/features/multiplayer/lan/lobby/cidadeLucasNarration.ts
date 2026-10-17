import type {CidadeDormeLanPublic,CidadeDormeLanStep} from '../../cidadeDormeLanGame'

type Outcome=Partial<Pick<CidadeDormeLanPublic,'nightResult'|'voteResult'>>
const clip=(id:string)=>'/assets/cidade-dorme/narracao-lucas/'+id+'.mp3'

/** Ordered, pre-recorded pt-BR narration. No audio service runs during LAN games.
 * All listeners read the same public state, but ONLY the host plays these clips.
 * Names/results stay as visual captions rather than device TTS.
 */
export function getCityLucasNarrationSequence(step:CidadeDormeLanStep,outcome?:Outcome):string[]{
 switch(step){
   case 'reveal': return [clip('01_identidade')]
   case 'killer-turn': return [clip('02_cidade_dorme'),clip('03_assassino')]
   case 'doctor-turn': return [clip('04_volte_dormir'),clip('05_medico')]
   case 'detective-turn': return [clip('04_volte_dormir'),clip('06_detetive')]
   case 'detective-result': return [clip('07_pista')]
   case 'watchman-turn': return [clip('04_volte_dormir'),clip('16_vigia')]
   case 'watchman-result': return [clip('17_resultado_vigia')]
   case 'morning':
     if(!outcome?.nightResult)return []
     return [clip('04_volte_dormir'),clip('08_amanhecer'),
       clip(outcome.nightResult.eliminatedId?'10_alguem_morreu':'09_ninguem_morreu')]
   case 'discussion':return [clip('11_discussao')]
   case 'voting':return [clip('12_votacao')]
   case 'vote-result':
     if(!outcome?.voteResult)return []
     return [clip(outcome.voteResult.kind==='tie'?'13_empate':'14_eliminacao')]
   case 'summary':return [clip('15_fim')]
 }
}
