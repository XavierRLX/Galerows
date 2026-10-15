import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {armCityAutomaticNarrator,interruptCityAutomaticNarrator,isCityAutomaticNarratorArmed,
  isCityAutomaticNarratorInterrupted,playCityAutomaticNarration,resetCityAutomaticNarratorForTests} from './cidadeAutomaticAudio'

const played:string[]=[]
class AudioMock {
 static last:AudioMock|null=null
 src='';currentTime=0;preload='';onended:(()=>void)|null=null
 constructor(src:string){this.src=src;AudioMock.last=this}
 play(){played.push(this.src);return Promise.resolve()}
 pause(){}
}
beforeEach(()=>{played.length=0;vi.stubGlobal('Audio',AudioMock);resetCityAutomaticNarratorForTests()})
afterEach(()=>{resetCityAutomaticNarratorForTests();vi.unstubAllGlobals()})

describe('CITY-NARRATION-MVP-01 — one host-only offline audio player',()=>{
 it('plays a complete cue list in order; notifies completion after the last recording only',()=>{
  let ended=0
  expect(armCityAutomaticNarrator('start.mp3')).toBe(true)
  expect(playCityAutomaticNarration(['sleep.mp3','killer.mp3'],()=>ended++)).toBe(true)
  expect(played).toEqual(['start.mp3','sleep.mp3'])
  AudioMock.last?.onended?.()
  expect(played).toEqual(['start.mp3','sleep.mp3','killer.mp3'])
  expect(ended).toBe(0)
  AudioMock.last?.onended?.()
  expect(ended).toBe(1)
 })
 it('never continues to the next clip after interruption',()=>{
  let ended=0
  armCityAutomaticNarrator()
  playCityAutomaticNarration(['sleep.mp3','killer.mp3'],()=>ended++)
  const stale=AudioMock.last?.onended
  interruptCityAutomaticNarrator()
  stale?.()
  expect(isCityAutomaticNarratorInterrupted()).toBe(true)
  expect(played).not.toContain('killer.mp3')
  expect(ended).toBe(0)
 })
 it('never calls browser/system speech synthesis for player names',()=>{
  const speak=vi.fn()
  vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'pt-BR',localService:true}],speak})
  armCityAutomaticNarrator()
  playCityAutomaticNarration(['outcome.mp3'],()=>{},undefined)
  AudioMock.last?.onended?.()
  expect(speak).not.toHaveBeenCalled()
 })
 it('blocks phase completion after playback rejection',async()=>{
  class RejectAudio extends AudioMock {override play(){played.push(this.src);return Promise.reject(new Error('Autoplay blocked'))}}
  vi.stubGlobal('Audio',RejectAudio)
  const onError=vi.fn()
  armCityAutomaticNarrator()
  await Promise.resolve()
  expect(isCityAutomaticNarratorArmed()).toBe(false)
  expect(isCityAutomaticNarratorInterrupted()).toBe(true)
  expect(playCityAutomaticNarration(['a.mp3'],undefined,undefined,onError)).toBe(false)
 })
})
