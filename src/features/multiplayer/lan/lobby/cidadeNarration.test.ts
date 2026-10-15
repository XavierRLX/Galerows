import { describe, expect, it } from 'vitest'
import { createCityNarrationGate, getCityNarrationCue, getCityNarrationSubtitle } from './cidadeNarration'
const frame=(id:string,step:'reveal'|'killer-turn'|'doctor-turn'|'morning'='reveal',options:Partial<{
  connected:boolean;host:boolean;mayor:boolean;paused:boolean;visible:boolean;sessionId:string}>={})=>({
  eventId:id,step,sessionId:options.sessionId??'session1',connected:options.connected??true,
  narratorHost:options.host??true,mayor:options.mayor??false,paused:options.paused??false,
  visible:options.visible??true,
})
describe('CITY-ORCHESTRATION-01 — offline host narrator gate',()=>{
  it('maps only public canonical phases into bundled local pt-BR cues',()=>{
    for(const step of ['reveal','killer-turn','doctor-turn','detective-turn',
      'morning','discussion','voting','vote-result','summary'] as const){
      expect(getCityNarrationCue(step)).toBe('/assets/cidade-dorme/narracao/'+step+'.m4a')
      expect(getCityNarrationSubtitle(step).length).toBeGreaterThan(15)
      expect(getCityNarrationSubtitle(step)).not.toMatch(/jogador .* é assassino|vítima é/i)
    }
  })
  it('requires deliberate activation, plays current cue once, ignores repeated snapshots',()=>{
    const gate=createCityNarrationGate()
    const reveal=frame('phase1')
    expect(gate.observe(reveal)).toBe(false)
    expect(gate.activate(reveal)).toBe(true)
    expect(gate.observe(reveal)).toBe(false)
    const night=frame('phase2','killer-turn')
    expect(gate.observe(night)).toBe(true)
    expect(gate.observe(night)).toBe(false)
    expect(gate.activate(night)).toBe(false)
  })
  it('never plays from guest, human mayor, disconnected, hidden or paused frames',()=>{
    const gate=createCityNarrationGate()
    expect(gate.activate(frame('p1','reveal',{host:false}))).toBe(false)
    expect(gate.activate(frame('p1','reveal',{mayor:true}))).toBe(false)
    expect(gate.activate(frame('p1','reveal',{connected:false}))).toBe(false)
    expect(gate.activate(frame('p1','reveal',{visible:false}))).toBe(false)
    expect(gate.activate(frame('p1','reveal',{paused:true}))).toBe(false)
    const allowed=frame('p1');expect(gate.activate(allowed)).toBe(true)
    expect(gate.observe(frame('p2','killer-turn',{paused:true}))).toBe(false)
    expect(gate.observe(frame('p2','killer-turn'))).toBe(false)
    expect(gate.observe(frame('p3','doctor-turn',{connected:false}))).toBe(false)
    expect(gate.observe(frame('p3','doctor-turn'))).toBe(false)
    expect(gate.observe(frame('p4','morning',{visible:false}))).toBe(false)
    expect(gate.observe(frame('p4','morning'))).toBe(false)
    expect(gate.observe(frame('p5','morning',{mayor:true}))).toBe(false)
  })
  it('never replays the initial event on remount/reconnect; new events are unique to a GameSession',()=>{
    const gate=createCityNarrationGate()
    expect(gate.observe(frame('phase1'))).toBe(false)
    expect(gate.activate(frame('phase1'))).toBe(true)
    expect(gate.observe(frame('phase2','killer-turn',{connected:false}))).toBe(false)
    expect(gate.observe(frame('phase2','killer-turn'))).toBe(false)
    expect(gate.observe(frame('phase2','killer-turn',{sessionId:'session2'}))).toBe(false)
    expect(gate.observe(frame('phase3','doctor-turn',{sessionId:'session2'}))).toBe(true)
  })
})
