import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {armCityAutomaticNarrator,playCityAutomaticNarration,stopCityAutomaticNarrator,
  interruptCityAutomaticNarrator,isCityAutomaticNarratorInterrupted,isCityAutomaticNarratorArmed,
  resetCityAutomaticNarratorForTests} from './cidadeAutomaticAudio'
import {getCityNarrationSubtitle} from './cidadeNarration'
import {getCityLucasNarrationSequence} from './cidadeLucasNarration'
const starts:string[]=[]
class AudioMock {
 static last:AudioMock|null=null
 src='';currentTime=0;preload='';onended:(()=>void)|null=null
 constructor(src:string){this.src=src;AudioMock.last=this}
 play(){starts.push(this.src);return Promise.resolve()}
 pause(){}
}
beforeEach(()=>{starts.length=0;vi.stubGlobal('Audio',AudioMock);resetCityAutomaticNarratorForTests()})
afterEach(()=>{stopCityAutomaticNarrator();vi.unstubAllGlobals()})
describe('CITY-AUTOPILOT — automatic host narrator',()=>{
 it('arms on Start Game gesture and plays the same unlocked device across the phases',()=>{
  expect(armCityAutomaticNarrator()).toBe(true)
  expect(starts).toEqual([expect.stringContaining('01_identidade.mp3')])
  playCityAutomaticNarration('/assets/cidade-dorme/narracao-lucas/03_assassino.mp3')
  playCityAutomaticNarration('/assets/cidade-dorme/narracao-lucas/05_medico.mp3')
  expect(starts).toHaveLength(3)
  expect(starts[1]).toContain('03_assassino.mp3')
  expect(starts[2]).toContain('05_medico.mp3')
 })
 it('requires a fresh host gesture after the app loses focus, never silently skipping an unheard cue',()=>{
   armCityAutomaticNarrator()
   playCityAutomaticNarration('/assets/cidade-dorme/narracao-lucas/05_medico.mp3')
   interruptCityAutomaticNarrator()
   expect(isCityAutomaticNarratorArmed()).toBe(false)
   expect(isCityAutomaticNarratorInterrupted()).toBe(true)
   expect(playCityAutomaticNarration('/assets/cidade-dorme/narracao-lucas/06_detetive.mp3')).toBe(false)
   expect(armCityAutomaticNarrator('/assets/cidade-dorme/narracao-lucas/05_medico.mp3')).toBe(true)
   expect(isCityAutomaticNarratorInterrupted()).toBe(false)
   expect(starts.at(-1)).toContain('05_medico.mp3')
 })
 it('never falls back to local system speech for player names',()=>{
   const speak=vi.fn()
   vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'pt-BR',localService:true}],speak})
   let completed=false
   armCityAutomaticNarrator()
   playCityAutomaticNarration('/assets/cidade-dorme/narracao-lucas/10_alguem_morreu.mp3',
     ()=>{completed=true},'Ana morreu.')
   AudioMock.last?.onended?.()
   expect(speak).not.toHaveBeenCalled()
   expect(completed).toBe(true)
 })
 it('uses distinct offline narration for life, death, tie and elimination',()=>{
  expect(getCityLucasNarrationSequence('morning',{nightResult:{eliminatedId:null}}).at(-1)).toContain('09_ninguem_morreu.mp3')
  expect(getCityLucasNarrationSequence('morning',{nightResult:{eliminatedId:'a'}}).at(-1)).toContain('10_alguem_morreu.mp3')
  expect(getCityLucasNarrationSequence('vote-result',{voteResult:{kind:'tie'}}).at(-1)).toContain('13_empate.mp3')
  expect(getCityLucasNarrationSequence('vote-result',{voteResult:{kind:'eliminated',eliminatedId:'a'}}).at(-1)).toContain('14_eliminacao.mp3')
  expect(getCityNarrationSubtitle('morning',{nightResult:{eliminatedId:'a'}},id=>id==='a'?'Ana':id))
    .toMatch(/Ana morreu/)
  expect(getCityNarrationSubtitle('morning',{nightResult:{eliminatedId:null}})).toMatch(/ninguém morreu/i)
  expect(getCityNarrationSubtitle('vote-result',{voteResult:{kind:'tie'}})).toMatch(/empate/i)
 })
})
