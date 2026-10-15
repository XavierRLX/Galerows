import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {armCityAutomaticNarrator,playCityAutomaticNarration,stopCityAutomaticNarrator,
  interruptCityAutomaticNarrator,isCityAutomaticNarratorInterrupted,isCityAutomaticNarratorArmed,
  resetCityAutomaticNarratorForTests} from './cidadeAutomaticAudio'
import {getCityNarrationCue,getCityNarrationSubtitle} from './cidadeNarration'
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
  expect(starts).toEqual([expect.stringContaining('reveal.m4a')])
  playCityAutomaticNarration('/assets/cidade-dorme/narracao/killer-turn.m4a')
  playCityAutomaticNarration('/assets/cidade-dorme/narracao/doctor-turn.m4a')
  expect(starts).toHaveLength(3)
  expect(starts[1]).toContain('killer-turn.m4a')
  expect(starts[2]).toContain('doctor-turn.m4a')
 })
 it('requires a fresh host gesture after the app loses focus, never silently skipping an unheard cue',()=>{
   armCityAutomaticNarrator()
   playCityAutomaticNarration('/assets/cidade-dorme/narracao/doctor-turn.m4a')
   interruptCityAutomaticNarrator()
   expect(isCityAutomaticNarratorArmed()).toBe(false)
   expect(isCityAutomaticNarratorInterrupted()).toBe(true)
   expect(playCityAutomaticNarration('/assets/cidade-dorme/narracao/detective-turn.m4a')).toBe(false)
   expect(armCityAutomaticNarrator('/assets/cidade-dorme/narracao/doctor-turn.m4a')).toBe(true)
   expect(isCityAutomaticNarratorInterrupted()).toBe(false)
   expect(starts.at(-1)).toContain('doctor-turn.m4a')
 })
 it('speaks a public eliminated player name only with an installed offline Portuguese voice',()=>{
   const spoken:string[]=[]
   let completed=false
   class Utterance {text:string;voice:unknown=null;lang='';onend:(()=>void)|null=null;onerror:(()=>void)|null=null
     constructor(text:string){this.text=text}}
   vi.stubGlobal('SpeechSynthesisUtterance',Utterance)
   vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'pt-BR',localService:true}],
     speak:(u:Utterance)=>{spoken.push(u.text);u.onend?.()},cancel:()=>{}})
   armCityAutomaticNarrator()
   playCityAutomaticNarration('/assets/cidade-dorme/narracao/morning-death.m4a',()=>{completed=true},'Ana morreu.')
   // The prerecorded cue ends before the locally synthesized name is spoken.
   const media=AudioMock.last
   media?.onended?.()
   expect(spoken).toEqual(['Ana morreu.'])
   expect(completed).toBe(true)
 })
 it('uses distinct offline narration for life, death, tie and elimination',()=>{
  expect(getCityNarrationCue('morning',{nightResult:{eliminatedId:null}})).toContain('morning-survived.m4a')
  expect(getCityNarrationCue('morning',{nightResult:{eliminatedId:'a'}})).toContain('morning-death.m4a')
  expect(getCityNarrationCue('vote-result',{voteResult:{kind:'tie'}})).toContain('vote-tie.m4a')
  expect(getCityNarrationCue('vote-result',{voteResult:{kind:'eliminated',eliminatedId:'a'}})).toContain('vote-eliminated.m4a')
  expect(getCityNarrationSubtitle('morning',{nightResult:{eliminatedId:'a'}},id=>id==='a'?'Ana':id))
    .toMatch(/Ana morreu/)
  expect(getCityNarrationSubtitle('morning',{nightResult:{eliminatedId:null}})).toMatch(/ninguém morreu/i)
  expect(getCityNarrationSubtitle('vote-result',{voteResult:{kind:'tie'}})).toMatch(/empate/i)
 })
})
