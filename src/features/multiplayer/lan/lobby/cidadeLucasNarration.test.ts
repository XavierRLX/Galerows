import {describe,it,expect} from 'vitest'
import {getCityLucasNarrationSequence} from './cidadeLucasNarration'

const root='/assets/cidade-dorme/narracao-lucas/'
const clip=(id:string)=>root+id+'.mp3'

describe('CITY-NARRATION-MVP-01 — recorded narrator sequence',()=>{
 it('plays sleep instruction before the killer prompt in every night',()=>{
   expect(getCityLucasNarrationSequence('killer-turn')).toEqual([clip('02_cidade_dorme'),clip('03_assassino')])
 })
 it('closes the previous role before calling doctor or detective',()=>{
   expect(getCityLucasNarrationSequence('doctor-turn')).toEqual([clip('04_volte_dormir'),clip('05_medico')])
   expect(getCityLucasNarrationSequence('detective-turn')).toEqual([clip('04_volte_dormir'),clip('06_detetive')])
   expect(getCityLucasNarrationSequence('detective-result')).toEqual([clip('07_pista')])
 })
 it('announces sunrise before precisely one public outcome without reading player names',()=>{
   expect(getCityLucasNarrationSequence('morning',{nightResult:{eliminatedId:null}}))
      .toEqual([clip('04_volte_dormir'),clip('08_amanhecer'),clip('09_ninguem_morreu')])
   expect(getCityLucasNarrationSequence('morning',{nightResult:{eliminatedId:'secret-id'}}))
      .toEqual([clip('04_volte_dormir'),clip('08_amanhecer'),clip('10_alguem_morreu')])
 })
 it('uses mutually exclusive verdicts and supports end of game',()=>{
   expect(getCityLucasNarrationSequence('vote-result',{voteResult:{kind:'tie'}}))
     .toEqual([clip('13_empate')])
   expect(getCityLucasNarrationSequence('vote-result',{voteResult:{kind:'eliminated',eliminatedId:'p'}}))
     .toEqual([clip('14_eliminacao')])
   expect(getCityLucasNarrationSequence('reveal')).toEqual([clip('01_identidade')])
   expect(getCityLucasNarrationSequence('discussion')).toEqual([clip('11_discussao')])
   expect(getCityLucasNarrationSequence('voting')).toEqual([clip('12_votacao')])
   expect(getCityLucasNarrationSequence('summary')).toEqual([clip('15_fim')])
 })
 it('does not guess an outcome when the authoritative state is not yet available',()=>{
   expect(getCityLucasNarrationSequence('morning')).toEqual([])
   expect(getCityLucasNarrationSequence('vote-result')).toEqual([])
 })
})
