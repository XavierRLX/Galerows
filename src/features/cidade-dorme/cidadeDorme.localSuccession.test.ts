import { describe, expect, it } from 'vitest'
import { createDefaultCidadeDormeSettings } from './cidadeDorme.setup'
import { createCidadeDormeSession, migrateCidadeDormeSession, recordKillerTarget, resolveCurrentVoting, resolveCurrentNight } from './cidadeDorme.session'

const players=Array.from({length:12},(_,i)=>({id:'player-'+i,name:'Pessoa '+i}))
const config={...createDefaultCidadeDormeSettings(12),enableDoctor:false,enableDetective:true,enableJester:false,killersCount:3}
const random=()=>.99999
describe('one-device Cidade Dorme succession persists through manual mayor narration',()=>{
  it('persists sorted private priority in the session, and changes active night actor when leader is voted out',()=>{
    const fresh=createCidadeDormeSession(players,config,random)
    expect(fresh.murderOrder).toHaveLength(3)
    const [killer,first,second]=fresh.murderOrder!
    expect(fresh.players.find(p=>p.id===killer)?.roleKey).toBe('killer')
    expect(fresh.players.find(p=>p.id===first)?.roleKey).toBe('traitor')
    expect(fresh.players.find(p=>p.id===second)?.roleKey).toBe('traitor')
    const night={...fresh,phase:'killerTurn' as const}
    expect(recordKillerTarget(night,first,'player-9')).toBe(night)
    expect(recordKillerTarget(night,killer,first)).toBe(night)
    expect(recordKillerTarget(night,killer,'player-9').currentNightAction.killerActorId).toBe(killer)
    const day={...fresh,phase:'voting' as const}
    const afterVote=resolveCurrentVoting(day,{kind:'eliminated',playerId:killer})
    expect(afterVote.phase).toBe('nightIntro')
    const promoted={...afterVote,phase:'killerTurn' as const}
    expect(recordKillerTarget(promoted,killer,'player-9')).toBe(promoted)
    expect(recordKillerTarget(promoted,first,'player-9').currentNightAction.killerActorId).toBe(first)
    const saved=migrateCidadeDormeSession(JSON.parse(JSON.stringify(promoted)))
    expect(saved?.murderOrder).toEqual([killer,first,second])
  })
  it('keeps a dormant second successor innocent to the detective while first successor is active',()=>{
    const base=createCidadeDormeSession(players,config,random)
    const [killer,first,second]=base.murderOrder!
    const target=players.find(p=>!base.murderOrder?.includes(p.id))!.id
    const after=resolveCurrentVoting({...base,phase:'voting'},{kind:'eliminated',playerId:killer})
    const action=recordKillerTarget({...after,phase:'killerTurn'},first,target)
    const pending=resolveCurrentNight({...action,phase:'nightResolution',currentNightAction:{...action.currentNightAction,detectiveTargetId:second}})
    expect(pending.currentNightAction.detectiveResult).toBe('innocent')
    const after2=resolveCurrentVoting({...after,phase:'voting'},{kind:'eliminated',playerId:first})
    const secondActive=recordKillerTarget({...after2,phase:'killerTurn'},second,target)
    const next=resolveCurrentNight({...secondActive,phase:'nightResolution',currentNightAction:{...secondActive.currentNightAction,detectiveTargetId:second}})
    expect(next.currentNightAction.detectiveResult).toBe('suspect')
  })
  it('restores legacy sessions that lack murder order without modifying existing assigned roles',()=>{
    const base=createCidadeDormeSession(players,config,random)
    const legacy={...base}
    delete legacy.murderOrder
    const restored=migrateCidadeDormeSession(legacy)
    expect(restored?.players).toEqual(base.players)
    expect(restored?.murderOrder?.[0]).toBe(base.murderOrder?.[0])
    const previousVersion={...legacy,players:base.players.map(p=>p.roleKey==='traitor'?{...p,roleKey:'killer' as const}:p)}
    const migratedOld=migrateCidadeDormeSession(previousVersion)
    expect(migratedOld?.murderOrder).toHaveLength(3)
    expect(new Set(migratedOld?.murderOrder)).toEqual(new Set(previousVersion.players.filter(p=>p.roleKey==='killer').map(p=>p.id)))
  })
})
